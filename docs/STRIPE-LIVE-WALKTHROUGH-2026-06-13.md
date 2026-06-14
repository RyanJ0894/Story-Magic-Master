# Stripe Live-Mode Walkthrough

**Date:** 2026-06-13
**Owner:** Chris
**Time required:** ~45 minutes (with a real card)
**Mode:** Production keys, live mode, real money — refunded at the end

This is the checklist for verifying that Stripe is wired correctly end-to-end in production before we send the friendly cohort the sign-up link. Each box must be checked on a real browser session.

The goal is to prove three things:

1. **Money in:** the user can pay, the charge appears in Stripe, the DB reflects the upgraded subscription, the UI revalidates (#247 fix).
2. **Money out:** the user can downgrade or refund, the charge is reversed, the DB reflects it, the UI revalidates.
3. **Webhooks are reliable:** every Stripe-side event reaches the web service and is processed idempotently.

> ⚠️ **Use a personal card you control.** All charges will be refunded at the end. The total cost during this walk-through, assuming you complete it in one sitting and refund within Stripe's same-day window, is **$0**.

---

## Pre-flight (5 min)

- [ ] **Live mode** indicator visible in the top-right of the Stripe dashboard (not "Test mode")
- [ ] Open **Doppler → story-magic → prd** in a separate tab. Confirm these keys are present and start with `sk_live_` / `whsec_` / `pk_live_`:
  - `STRIPE_SECRET_KEY` (`sk_live_…`)
  - `STRIPE_WEBHOOK_SECRET` (`whsec_…`)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`)
- [ ] Open **Stripe → Developers → Webhooks**. Confirm there is an endpoint pointing at `https://www.storymagicapp.net/api/webhooks/stripe` (or the equivalent for your tenancy). Status: **Listening**.
- [ ] Open **Stripe → Customer portal → Settings**. Confirm "Cancel subscription" is enabled, "Update payment method" is enabled, and the return URL points at `https://www.storymagicapp.net/billing` (or your equivalent).
- [ ] Open **Sentry → Issues → environment: production**. Note the current event count for `STORY-MAGIC-*` — this is the baseline you'll compare against after the run.

---

## Pre-flight — DB

Have the production read-only psql connection string ready (the same one we used for the AiHealthLog query). Open a terminal:

```sql
-- Baseline: list any subscriptions for your test email
SELECT s.id, s.plan, s.status, s."cancelAtPeriodEnd", s."currentPeriodEnd",
       u.email
FROM "Subscription" s
JOIN "User" u ON u.id = s."userId"
WHERE u.email = 'YOUR_TEST_EMAIL@example.com'
ORDER BY s."createdAt" DESC;
```

Keep this query in your clipboard — you'll re-run it at each milestone.

---

## Step 1 — Money in (10 min)

- [ ] **Sign in** to `https://www.storymagicapp.net/` using the test email you intend to upgrade.
- [ ] Navigate to **Billing** (or `/pricing`). Confirm tier copy renders cleanly.
- [ ] Click **Upgrade to Creator** (or whichever paid tier is the lowest).
- [ ] At the Stripe Checkout page, enter the real card. **Do not** use 4242 4242 4242 4242 — that's test mode and the webhook fingerprint won't match live config.
- [ ] Complete checkout. You should be redirected back to the app with a success URL.
- [ ] Confirm the **dashboard now shows the upgraded tier** without requiring a hard refresh. This is the #247 fix in action; if you have to F5, that's a regression — note it.
- [ ] Wait ~5 seconds. **Re-run the DB query** above. The row should now show `plan='creator'` (or your tier) and `status='active'` and `currentPeriodEnd` ~30 days in the future.
- [ ] In Stripe → **Events**, find the `customer.subscription.created` and `invoice.paid` events. Click each, confirm "Pending webhooks" shows 0 (the web service ACK'd them).
- [ ] In Stripe → **Customers**, find your test customer. Confirm the subscription is "Active" and the payment method is on file.

If any of the above fails, **stop and triage** before proceeding. Document the failure mode in this doc (replace this section with the symptom + root cause); we will not ship if money-in is unreliable.

---

## Step 2 — Customer portal access (5 min)

- [ ] From the app's Billing page, click **Manage subscription**. You should land on Stripe's customer portal page.
- [ ] On the portal, confirm:
  - Plan and price are correct.
  - "Cancel subscription" is visible.
  - "Update payment method" is visible.
- [ ] Close the portal (without changes) and return to the app. Confirm you land on the configured return URL (likely `/billing`) without an error banner.

---

## Step 3 — Cancel at period end (5 min)

This tests the path most cancellations actually take.

- [ ] In the customer portal, click **Cancel subscription** → "at end of period" (not "immediately"). Confirm the portal shows "Will cancel on \<date\>".
- [ ] Return to the app. The Billing page should show "Your plan ends on \<same date\>" (or equivalent copy).
- [ ] **Re-run the DB query.** The row should now show `cancelAtPeriodEnd=true`, but `status` is still `active` and `plan` is still the paid tier. Access continues until the period ends.
- [ ] In Stripe → Events, find `customer.subscription.updated`. Pending webhooks: 0.

---

## Step 4 — Resume (un-cancel) (3 min)

- [ ] In the customer portal, click **Renew subscription** (or "Don't cancel"). Confirm the portal removes the "Will cancel" notice.
- [ ] Return to the app. Billing page should reflect the resumed status — no "cancel" banner.
- [ ] **Re-run the DB query.** `cancelAtPeriodEnd` should be back to `false`.

---

## Step 5 — Refund (10 min, real money returned)

- [ ] In Stripe → **Payments**, find the most recent successful charge from this session.
- [ ] Click **Refund** → **Full refund** → confirm.
- [ ] Within 30 seconds, in Stripe → Events, find `charge.refunded` and `invoice.refunded` (depending on your integration). Pending webhooks: 0.
- [ ] In the app, **hard refresh** the dashboard. Tier should drop back to free, or show the refunded state per your business logic.
- [ ] **Re-run the DB query.** The subscription row should reflect the refund — `status` either `canceled` immediately or unchanged depending on the policy you wired into the refund handler. **Confirm the policy is what you want.** If a refund leaves the user with paid access, that's a "money out doesn't match user-facing state" bug — document it.

If your business policy is "refund = immediate downgrade", the row's `status` should be `canceled` and `plan` should be back to `free`.

---

## Step 6 — Sentry watch (5 min)

- [ ] Return to **Sentry → Issues → environment: production**. Compare event counts vs the baseline you noted in pre-flight. **There must be no new issues** captured during this walk-through. If there are:
  - **`webhook.*` or `stripe.*` issues** — Stripe integration bug, must fix before ship.
  - **Hydration / TypeError issues on /billing** — bring back to me, that's a same-class bug as #272.
  - **5xx issues on `/api/webhooks/stripe`** — webhook handler is throwing; check the queue worker connection-pool fix (#273) is deployed.

---

## Done

If every box is checked and the Sentry baseline is clean: **Stripe is verified.** Mark `UAT-STRIPE-*` cases as PASS in the dated UAT file and update `GO-TO-MARKET-3DAY-2026-06-13.md` accordingly.

If any box fails: do not proceed to the friendly-cohort cutover. File a follow-up issue with the failure mode and re-run this walkthrough once it's fixed.

---

## Quick reference

| Resource | URL |
|---|---|
| Stripe Dashboard (live) | https://dashboard.stripe.com/ |
| Stripe Events | https://dashboard.stripe.com/events |
| Stripe Webhooks | https://dashboard.stripe.com/webhooks |
| Stripe Customer Portal config | https://dashboard.stripe.com/settings/billing/portal |
| Doppler | https://dashboard.doppler.com/workplace/.../projects/story-magic/configs/prd |
| Sentry production filter | https://servicevision.sentry.io/issues/?project=story-magic&query=environment%3Aproduction |
| App billing | https://www.storymagicapp.net/billing |
| Prod DB (read-only) | The `postgresql://story_magic_user:...@dpg-d665vdrh46gs73dnuhr0-a.oregon-postgres.render.com/story_magic` connection from today's session |

# Stripe Subscription Lifecycle Test Checklist

**Purpose:** Verify end-to-end Stripe integration before production launch.
**Prerequisites:** Stripe test mode keys configured, webhook endpoint registered.

---

## Pre-Test Setup

- [ ] Verify `STRIPE_SECRET_KEY` starts with `sk_test_`
- [ ] Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`
- [ ] Verify webhook endpoint registered in Stripe Dashboard → Developers → Webhooks
- [ ] Verify webhook signing secret matches `STRIPE_WEBHOOK_SECRET` env var
- [ ] Run `stripe listen --forward-to localhost:22000/api/stripe/webhook` for local testing

---

## Test Cases

### 1. New Subscription (Happy Path)
- [ ] Sign up as new user
- [ ] Navigate to /pricing
- [ ] Click "Subscribe" on a plan (e.g., Pro)
- [ ] Complete Stripe Checkout with test card `4242 4242 4242 4242`
- [ ] Verify redirect back to dashboard
- [ ] Verify `subscriptions` table has new row with `status: 'active'`
- [ ] Verify `profiles` table updated with correct plan
- [ ] Verify Stripe Dashboard shows active subscription

### 2. Webhook Events
- [ ] `checkout.session.completed` — Creates/updates subscription in DB
- [ ] `customer.subscription.updated` — Updates plan/status in DB
- [ ] `customer.subscription.deleted` — Sets status to 'canceled' in DB
- [ ] `invoice.payment_succeeded` — Resets usage counters for billing period
- [ ] `invoice.payment_failed` — Updates subscription status appropriately

### 3. Plan Upgrade
- [ ] Subscribe to Starter plan
- [ ] Navigate to /billing or /pricing
- [ ] Upgrade to Pro plan
- [ ] Verify Stripe proration applied
- [ ] Verify `subscriptions.plan` updated to 'pro'
- [ ] Verify usage limits reflect new plan

### 4. Plan Downgrade
- [ ] Subscribe to Pro plan
- [ ] Downgrade to Starter plan
- [ ] Verify change takes effect at period end (not immediately)
- [ ] Verify `subscriptions` table reflects pending downgrade

### 5. Cancel Subscription
- [ ] Subscribe to any plan
- [ ] Navigate to /billing
- [ ] Click "Cancel Subscription"
- [ ] Verify cancellation is at period end (not immediate)
- [ ] Verify user retains access until period ends
- [ ] Verify `subscriptions.status` updated after period ends

### 6. Usage Metering
- [ ] Subscribe to plan with page limit
- [ ] Generate audio for a project
- [ ] Verify `usage.pages_used` incremented
- [ ] Verify UI shows correct remaining pages
- [ ] Attempt to exceed plan limit
- [ ] Verify generation blocked with appropriate error message

### 7. Edge Cases
- [ ] **Declined card:** Use `4000 0000 0000 0002` — verify graceful error
- [ ] **3D Secure:** Use `4000 0025 0000 3155` — verify authentication flow
- [ ] **Expired card:** Use `4000 0000 0000 0069` — verify error handling
- [ ] **Duplicate subscription:** Attempt to subscribe while already active — verify prevented
- [ ] **Webhook replay:** Send same webhook event twice — verify idempotent handling

---

## Stripe Test Cards Reference

| Card Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 9995` | Insufficient funds |

**Expiry:** Any future date. **CVC:** Any 3 digits. **ZIP:** Any 5 digits.

---

## Verification Commands

```bash
# Check webhook events (requires Stripe CLI)
stripe events list --limit 10

# Check subscription status
stripe subscriptions list --customer cus_XXXX --limit 1

# Trigger test webhook
stripe trigger checkout.session.completed

# Monitor webhooks in real-time
stripe listen --forward-to localhost:22000/api/stripe/webhook --log-level debug
```

---

## Sign-off

- [ ] All 7 test scenarios pass
- [ ] Webhook handler processes all event types
- [ ] Usage metering accurate
- [ ] No orphaned subscriptions in Stripe Dashboard
- [ ] Tested by: _______________
- [ ] Date: _______________

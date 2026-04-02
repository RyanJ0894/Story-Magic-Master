# Session Context - 2026-03-06

**Project:** Story Magic Marketing Site
**Path:** `/Users/admin/dev2/clients/RyanJae/story-magic/story-magic-marketing-site`
**Live URL:** https://storymagic.servicevision.io

## Summary

Built and fully deployed the Story Magic marketing site from scratch this session. Starting from a pre-approved plan, the session covered: SaaS app dark-mode default, a complete standalone Next.js 16 marketing site deployed to Vercel at `storymagic.servicevision.io`, domain wiring (Cloudflare A + CNAME, Render custom domain `app.storymagic.servicevision.io`), full content/design sync from the real `www.storymagicapp.net` (cinema-gold palette, hero background image, real logo, exact copy), policy pages (Privacy/Terms/Cookies), and a full Voice Marketplace page with talent application form.

The Voice Marketplace form went through three delivery attempts before landing on the correct architecture: Resend (blocked — restricted send-only key, no verified domain), Formsubmit.co server-side (blocked — strips Referer on Next.js serverless), Formsubmit.co client-side direct (working — browser sets correct Referer/Origin headers automatically). **Requires one action**: `talent@storymagicapp.net` must click the "Activate Form" link in the activation email Formsubmit sent.

## Files Modified / Created

**SaaS app:**
- `packages/web/components/theme-provider.tsx` — `defaultTheme="dark"`
- `packages/web/app/page.tsx` — mobile hero padding, footer gap-y-8

**Marketing site (`story-magic-marketing-site/`):**
- `app/globals.css` — Tailwind v4 @theme, cinema gold tokens, dark mode vars
- `app/layout.tsx` — Inter font, ThemeProvider defaultTheme="dark"
- `app/page.tsx` — Full landing page: hero w/ cinema BG + gold CTA, stats, how-it-works, 8-feature grid, pricing section, voice actor section (15%/$2.50 stats), CTA
- `app/pricing/page.tsx` — Full pricing page: PricingSection toggle, comparison table (15 features × 4 tiers), enterprise tiers, FAQ
- `app/features/page.tsx` — Features deep-dive
- `app/privacy/page.tsx` — GDPR-compliant Privacy Policy (effective March 1, 2026)
- `app/terms/page.tsx` — Terms of Service with voice cloning clause
- `app/cookies/page.tsx` — Cookie policy with per-cookie tables
- `app/voice-marketplace/page.tsx` — Full Voice Marketplace page (hero, stats, how-it-works, benefits grid, requirements, form, FAQ)
- `app/api/voice-marketplace/route.ts` — API route (kept for validation, actual delivery is client-side now)
- `components/nav.tsx` — Real logo image, Voice Marketplace nav link
- `components/footer.tsx` — Real logo, Voice Marketplace → /voice-marketplace, removed APP_URL dependency
- `components/pricing-section.tsx` — Client component: monthly/annual toggle, gold Popular badge
- `components/voice-marketplace-form.tsx` — Full talent application form (client-side Formsubmit delivery)
- `components/theme-toggle.tsx` — Sun/Moon toggle
- `lib/pricing-data.ts` — TIERS data (non-client module, avoids SSR/client boundary bug)
- `public/logo.png` — Real Story Magic logo (from saved site snapshot)
- `public/hero-cinema.jpg` — 1920×1080 hero background (from www.storymagicapp.net)
- `vercel.json` — `{ "framework": "nextjs" }`
- `.env.local` — `NEXT_PUBLIC_APP_URL=https://app.storymagic.servicevision.io`

## Current State

- **Marketing site** live at https://storymagic.servicevision.io (8 pages + 1 API route)
- **SaaS app** at https://app.storymagic.servicevision.io (Render, story-magic-web srv-d5mmo2emcj7s73c6ffs0)
- **Resend key** `re_3VuoPhzA_8KfJh4GMdouewkq9g1WguTg6` set on Vercel + Render (not currently used for voice marketplace — kept for future Resend domain verification)
- **Voice marketplace form**: client-side → Formsubmit.co → `talent@storymagicapp.net`
- **Formsubmit activation**: pending — one-time click required from `talent@storymagicapp.net` inbox

## Next Steps

- [ ] **REQUIRED**: Click "Activate Form" in activation email sent to `talent@storymagicapp.net` (from Formsubmit.co) — form submissions won't deliver until this is done
- [ ] Verify Resend domain (`storymagicapp.net`) in the Resend dashboard for a full-access key — then swap form delivery back to Resend for branded emails from `noreply@storymagicapp.net`
- [ ] Point `storymagicapp.net` (client's own domain) to Vercel marketing site once client transfers DNS access
- [ ] Wire `storymagicapp.net` email (`talent@`) to an actual mailbox if it doesn't exist yet
- [ ] Add `RESEND_FROM_EMAIL` env var once domain is verified

## Open Questions / Blockers

- **Formsubmit activation email**: Has `talent@storymagicapp.net` received and clicked it? If that mailbox doesn't exist, the form will never activate — would need to change `VOICE_MARKETPLACE_EMAIL` to a real inbox.
- **Resend domain**: Client needs to log into resend.com and either create a full-access API key or verify `storymagicapp.net` manually.
- **storymagicapp.net DNS**: Currently on the client's own Vercel account (403 when we tried to add it). Transfer needed to point www. → marketing site.

## Key Technical Notes

- Tailwind v4 dark mode: `@variant dark (&:where(.dark, .dark *))` in CSS (not `darkMode: ['class']` in config)
- Client/Server boundary bug: TIERS was in `'use client'` component → SSR prerender crash. Fixed by moving to `lib/pricing-data.ts` (no directive)
- Resend `new Resend()` at module level crashes build if `RESEND_API_KEY` is unset → must instantiate inside handler
- Formsubmit.co requires browser Referer header — serverless fetch strips it; solution is client-side POST
- Cinema gold: `--color-gold-500: #D4AF37`
- DNS: `storymagic.servicevision.io` A → `76.76.21.21` (Vercel), `app.storymagic.servicevision.io` CNAME → `story-magic-web.onrender.com`

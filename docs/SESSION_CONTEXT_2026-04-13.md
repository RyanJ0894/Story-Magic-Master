# Session Context - 2026-04-13

**Project:** Story Magic
**Path:** `/Users/admin/dev2/clients/RyanJae/story-magic`

## Summary

Two main streams of work this session: frontend dashboard rebuild and legal document drafting.

On the app side, the simple projects list dashboard was replaced with a full Master Dashboard featuring a stats row (Total Projects, Pages Used, Voice Library, Active Users), tabbed navigation (Overview / Projects / Voice Library / Analytics), subscription plan cards using enterprise tier names, a team activity feed, a voice library grid with 50+ voice preview, and an analytics tab. The dashboard page remains server-rendered for data fetching while a new `DashboardTabs` client component handles tab state. All changes were deployed to Render and the `demo_audio_url` Prisma migration ran successfully.

On the legal side, the Revenue Share Agreement was substantially updated and a new Contributor & Capitalization Summary document was created. The RSA changes include: a new Article 2A (Background IP) acknowledging Jason's prototype and Chris's independent rebuild; a new §1.8 Background IP definition covering Chris's pre-existing libraries and code from other projects; derivative works language in §2.2 (permitted but exclusively under Story Magic banner, no sale/sublicense, revenue flows into the same share); and a shift from quarterly to monthly calculations with a new §3.5 Arrears Adjustment provision. The contributor summary document captures all 6 current stakeholders, presents both dilution options for Chris's 10% equity issuance (Option A: pro-rata; Option B: from Ryan's share only), and includes angel/seed round terms with existing stakeholder preference.

## Files Modified

### App
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/dashboard/page.tsx` — Rebuilt as server component: stats row, header with usage indicator, passes data to DashboardTabs
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/dashboard/dashboard-tabs.tsx` — New client component: Overview/Projects/Voice Library/Analytics tabs, subscription plan cards, team activity feed

### Contracts
- `/Users/admin/dev2/clients/RyanJae/story-magic/contracts/REVENUE_SHARE_AGREEMENT.docx` — Updated: Article 2A Background IP, §1.8 Background IP definition, §2.2 derivative works clause, monthly calculations, §3.5 Arrears Adjustment, removed "independently" from rebuild language
- `/Users/admin/dev2/clients/RyanJae/story-magic/contracts/STORY_MAGIC_CONTRIBUTOR_SUMMARY_2026-04-10.docx` — New: full cap table (6 holders), Option A/B dilution tables, contributor narratives, seed round terms, election checkbox + signatures
- `/Users/admin/dev2/clients/RyanJae/story-magic/contracts/STORY_MAGIC_CONTRIBUTOR_SUMMARY_2026-04-10.md` — Markdown export via pandoc for Typora review

## Current State

- App deployed and live at https://app.storymagicapp.net
- `demo_audio_url` migration: succeeded on Render
- Revenue Share Agreement: updated, saved as `REVENUE_SHARE_AGREEMENT.docx` (undated master) — dated copy (`_2026-04-10`) may need to be regenerated from master
- Contributor Summary: drafted, pending founder election of Option A or B for Chris's equity issuance
- Jason/Greg split within their combined 80% (pre-issuance) is not documented — needs to be confirmed and added to the RSA distribution table

## Next Steps

- [ ] Ryan and Greg elect Option A or B for Chris's 10% equity — update both documents accordingly
- [ ] Confirm Jason Hall / Greg Dixon individual % split for RSA §4.3 distribution table (currently [___]% placeholders)
- [ ] Add signed/executed dates to Revenue Share Agreement
- [ ] Regenerate dated `.docx` copy of RSA once placeholders are filled
- [ ] Consider whether Dak L., Marc H., Cortney W., Eric G. need to be added as signatories to any agreement
- [ ] Clerk Dashboard: upload logo.png to Branding page (manual step, no code change needed)
- [ ] Angel/seed round: fill in raise target, SAFE valuation cap, discount rate, minimum check size
- [ ] Deploy smoke test on staging per `scripts/smoke-test.sh --staging`

## Open Questions / Blockers

- **Option A vs B**: Founders need to elect how Chris's 10% is structured before the contributor summary can be finalized
- **RSA §4.3 table**: Jason and Greg's individual revenue share percentages are still [___]% — need to be confirmed
- **Legal review**: Both documents drafted without attorney review — recommend review before signing
- **"Ryan Jae" vs "Jason Hall"**: Contract uses "Jason Hall" as legal name; contributor summary uses "Ryan Jae" — ensure consistency with legal name at signing

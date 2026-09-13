# Faithful member experience release

## Scope

- Faithful desktop and mobile guides, story forms, demo signup, profile and Settings.
- Faithful-only navigation/dialogue, voice error handling, and contextual copy.
- My Church card flip reuses the existing Wallet implementation.
- New behavior in shared modules requires `GRACE_MEMBER_EXPERIENCE === 'faithful-v1'`, set only by Faithful's two pages.
- Production framing exception allows only Faithful's mobile HTML to be embedded by the same origin. Central and other protected routes retain DENY and frame-ancestors none.

## Boundary

Prepared separately from the development checkout, based on production main `190d4689d8bf9bca238f1cadd95bbfb4720177be`. Central Henderson pages, API changes, the original checkout's local Vite changes, and storyboard artifacts are excluded. Shared-module baseline comparison covers Central messaging, greeting, prompt, routing, speech fallback, and unchanged page files.

This remains a demo release. Signup/profile creation is simulated, drafts do not provide durable accounts or cross-device transfer, and IMPACT amounts and card state are illustrative. Browser speech and external avatar availability depend on their providers; the external avatar iframe was blocked in the local capture environment. No banking rails, KYC, real payments, or notification service are activated by this release.

## Verification

Run `node scripts/test-faithful-release-boundary.mjs` plus the guide, story, profile, Settings, intent, dialogue, and weekly-journey scripts. Build with `npm run build --workspace=apps/member-web`.

Deployment must be verified against the Members project, not the CRM project. Check Faithful's Mobile iframe, guide and profile flows, asset responses, and Central's unchanged files after deployment. Existing CSS import-order and dynamic-import bundling warnings are not proof of a deployment failure; record them separately from passing build status.

## Follow-up

Audit Central Henderson against the approved Faithful experience before enabling the release flag on another tenant. Do not copy Maya's sample history or visitor answers into Central.

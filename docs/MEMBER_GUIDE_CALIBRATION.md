# Faithful member guide calibration

## Shared approach

Explain the page first, invite optional answers second. Keep the outer introduction collapsed, use “Let us know” for participation, and keep Open/Close and Skip together. Close preserves the current draft. Skip discards unsaved answers; My Church restores any previously saved answers. Browsing does not constitute an enrollment, contact request, financial action, or completed lesson.

| Page | Introduction | Contribution from the person | Current retention |
| --- | --- | --- | --- |
| My Church | Services, connections and pathways | Existing church connection, participation, hopes | Browser storage only after an explicit choice |
| Leadership | Leaders, teachings and human support | Existing trusted connection and desired support; optional interest in a demo leader | Open page only |
| Wallet | Proposed card, terms and application awareness | Self-reported understanding of KYC topics and optional questions; never verification results | Open page only |
| Impact | Illustrative relationship between spending and causes | Chosen store examples, category estimates, optional cause | Explicitly kept draft in the open page only |
| Connect | Groups, events and community conversation | Existing connections, interests and preferred guidance | Open page only |
| Reflect | Lessons, journal, Scripture and goals | Reflection interests and preferred rhythm; not journal text | Open page only |
| Link to Mobile | Intended final review and continuation | Not connected to the above drafts yet | No cross-device story transfer |

## This pass

- Shortened My Church’s extra introduction while retaining its walkthrough and story controls.
- Aligned shared summary, question, field, focus, and Open/Close/Skip presentation.
- Preserved page-specific decisions and original content, including Wallet wording and Impact’s flat store chips and separate spending sliders.
- Ran the guide behavior suites; see command results for actual outcome.

## Remaining integration gaps

- There is no combined story store or final review. Do not describe the individual drafts as connected to GRACE or transferable yet.
- Existing saved My Church answers and temporary drafts intentionally have different retention. Unification requires an explicit shared-state design, not silently persisting sensitive notes.
- Wallet acknowledgments do not constitute a KYC check or authorization to perform one.
- Leadership matching is illustrative and based on demo profile specialties; no actual referral is made.
- Browser inspection of the current file URL was blocked by browser URL policy. This pass is source and automated DOM verification, not a completed visual, voice, or physical-phone review.
- No deployment, account activation, payment configuration, or Central Henderson changes in this pass.

## Tenant parity (2026-09-18)

Central Henderson now matches Faithful on the **truthfulness layer**, not the
guide layer:

- `grace-member-intents.js` loads on both tenants, before `grace-companion.js`.
  It was Faithful-only, so Central — the live client — had a companion with no
  capability boundaries at all.
- The five "Submit a care request" options on both tenants now open the real
  pastoral-care conversation instead of firing a toast that claimed a request
  had been submitted. Nothing on either static page posts to the church.
- Care records created client-side read `Started`, not `Submitted`.
- Neither tenant renders a giving rate as a share of income, in the portal or
  the iOS preview page.
- The iOS preview pages have one honest "Explore the preview" button. The two
  previous buttons were byte-identical no-ops that both promised an account.
- Central's QR now has the local-preview guard Faithful already had.

**Story capture now exists on Central** — see the section below. The remaining
Faithful-only modules are its weekly journey, leader profiles, wallet/impact
exercise and connect designs: presentation layers, not the capture pipeline.

## Story capture on Central (2026-09-18)

Central's capture was NOT a port. Faithful's version is spread across ~six
modules that scrape DOM `faithful-preferences.js` builds, via a CSS-selector
contract no other file knows it is party to — which is how Faithful's Impact
panel captured nothing at all for months (its selector,
`[data-visitor-impact-source]`, exists nowhere in the repo).

Two shared modules replace that:

- **`shared/grace-story-handoff.js`** — the QR panel, now the single
  implementation. `faithful-story-handoff.js` is a ~25-line adapter supplying
  only what is tenant-specific: mount point, which step to hide, and where
  segments come from. Faithful's existing test passes against it unchanged.
- **`shared/grace-story-capture.js`** — the capture itself: four free-text
  questions, the four pilot segmentation fields, three independent consents and
  a working decline. It builds its own DOM inside `<div
  data-grace-story-capture>` and reads no other module's markup, so it works on
  any tenant. `scripts/test-story-capture.mjs` asserts that by mounting it in a
  page containing none of Faithful's hooks.

Segment values are checked against `api/_lib/storySegments.ts` by both capture
tests — a drift there is a 400 at the moment a member asks to be remembered.

## Care intake connected (2026-09-18)

`POST /api/portal/care` had been complete for some time and had **zero
callers** — it writes a real `care_requests` row, flags crisis language, raises
a critical `agent_finding`, pages on-call staff with no member detail in the
body, and sets a sentinel review the system can never clear itself. The
member-facing buttons fired a toast instead.

`shared/grace-care-request.js` is now the first caller, loaded by **both**
tenants. The five "Submit a care request" options open it with their category
pre-filled.

Three things to preserve if this is touched:

- **No verification gate.** The endpoint's POST deliberately does not call
  `requireVerifiedIdentity` (only GET does), so someone who signed up an hour
  ago and is pending staff review can still ask for help. Do not add one.
- **Category mapping is load-bearing.** Three portal ids differ from the
  endpoint's allowlist (`faith`→`faith-questions`, `anxiety`→
  `anxiety-depression`, `other`→`general`). A mismatch is a 400 at the moment a
  member asks for help. `scripts/test-care-request.mjs` checks every option
  against `api/portal/_care.ts`'s own `CATEGORIES`.
- **The consent checkbox is real.** `_care.ts` auto-records a
  `pastoral_contact` consent when `requests_human_followup` is true. That flag
  is now an actual member choice rather than an inferred default, and
  unticking it is reported honestly ("nobody will reach out").

Signed out, the form says so before the member types and sends nothing.

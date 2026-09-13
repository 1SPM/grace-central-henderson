# Weekly Journey: demo and production boundary

## This local stage

Faithful desktop and mobile load one `faithful-weekly-journey.js` implementation. State lives only in the open document; tabs and lesson switching do not clear it, reload does. The two lesson IDs are adapters for existing `WATCH_STATE.sermons[0]` and `[1]`, not authoritative sermon IDs. Watch has no durable IDs, year on these dates, individual recording URL, transcript, or sermon notes. Do not infer any of those. The UI preserves the existing titles, dates, speakers and Scripture references and opens the canonical Watch destination. Existing sample Journey records remain in a separate, collapsed disclosure.

The summary, prompts, questions and actions are staged editorial examples based on the referenced passages, **not claims about what the pastor said**. Both packages have `status: demo`. No member controls publish a lesson. These sample packages must not be copied into a production published feed.

## Required integration contract (not implemented backend)

A church-scoped source supplies `sermonId`, original title, speaker, ISO service date, recording URL, Scripture references, and versioned transcript or staff notes with source spans. Missing transcript/notes blocks source-grounded generation. A title is not sufficient input.

GRACE may create a `draft` package with source ID/version, cited spans for summary/prompts/questions/actions, and an exact Scripture edition reference. A staff reviewer can edit, request changes or reject it. Only an authorized staff publication endpoint can transition `staff_review` to `published`, recording reviewer, approved version, timestamp and tenant. GRACE has no publication permission. Any source/material edit invalidates previous approval. The member endpoint must return only church-scoped published versions; enforce this server-side, not only by hiding UI. Demo feeds are separately enabled preview data.

A new published version should be offered without changing the selected lesson or draft. Entries retain original lesson ID and version. Never assume viewing or sermon attendance. Member-selected goals and explicit actions alone change progress. Scripture references can include either Testament; resolve every reference or show a missing-text error, never omit one silently.

## Scripture snapshot

World English Bible, public domain, `engwebp`; retrieved September 11, 2026. Exact text excerpts are pinned in this version-controlled JavaScript file:
- https://ebible.org/engwebp/EPH04.htm — Ephesians 4:32, surrounding verses 29–31.
- https://ebible.org/engwebp/GAL05.htm — Galatians 5:13, surrounding verses 14–15.

The complete chapters are also pinned in `faithful-weekly-scripture.js` and expandable inside the reader. Source footnotes are listed separately; paragraph verse ranges retain the original verse numbering. Demo questions and summaries are not Scripture quotations. The Watch source's original NIV references are retained as references; this reader explicitly uses WEB, not a relabelled NIV quotation.

## Data and consent

New session reflection content is not written to localStorage, sessionStorage, a database or analytics. Explicit export downloads unencrypted JSON. Save never calls GRACE. Sharing requires a text selection and a second confirmation showing that exact selection; the existing GRACE conversation service has its own processing/retention boundary. Dictation has an explicit start, browser permission, stop/cancel and editable transcript review. Browser speech may use an external service. Permission denial falls back to typing. No claim of secure retention is made.

## Remaining verification/integration

### Image-led presentation update

The shared renderer now retains the Faithful Journey heading and photography pattern, uses the existing sermon thumbnails, gives all five navigation buttons visible mobile labels, and presents the unchanged WEB quotation as a paper page. Growth evidence is calculated from saved session entries, explicit study review and member-selected goals, with named milestones. No growth history or sermon recording was invented. `faithful-weekly-editorial.css` owns this presentation layer for both layouts. Automated regression checks cover the new image/tab/quotation structure in addition to the existing behavior tests; rendered screenshot and physical-device review remain unverified.

Automated DOM regression covers session behavior. Real microphone hardware/permission prompts, physical mobile devices, full visual review and authenticated end-to-end AI transmission still require verification. Production generation, staff review, persistent identity-bound storage and published-week delivery are not implemented by this member-only stage.

# Take your story with you — implementation boundary

## Current verified source behavior

- My Church answers can be saved locally with explicit selection; Leadership and Wallet notes remain in the open page.
- Link to Mobile hides its QR code for file and loopback previews. A phone cannot reach this Mac through the phone's own localhost address.
- The hosted QR currently uses an external image service. That is suitable only for a public page URL, not a private handoff token.
- No personal-story handoff endpoint or mobile import flow has been implemented in this pass.
- Impact now offers an explicit, session-only reviewed draft containing chosen demo merchants, cause, spending estimates in cents, and the sample-rate projection. Choices come from the existing page catalog; existing demo routing switches are not treated as consent. Editing inputs invalidates the review. This draft is not yet transferred or persisted.

## Smallest complete flow

1. On Link to Mobile, show a preferred-name field and an exact review of eligible saved My Church fields. Nothing selected by inference.
2. Member selects fields and chooses Create mobile handoff. Exclude journal, care notes, Wallet free text, payment data, authenticated tokens and account identifiers. The user has requested an optional Impact draft transfer: only explicitly reviewed merchant choices, cause, self-entered estimates and labeled demo projections belong in that separate allowlist. Require final transfer confirmation; never import these as active financial settings. Other story notes require an explicit future allowlist decision.
3. A server issues a random, short-lived, one-use token. Store only the approved payload with an expiry. Do not use browser-local storage as a cross-device transport.
4. Render QR locally, never through the existing third-party QR image URL. QR contains an opaque handoff reference, not the answers. Keep it out of analytics and request logs.
5. Phone opens an HTTPS member page. A GET must not consume the token: scanners and link previews may prefetch it. Show a confirmation, then redeem through an atomic POST.
6. Return the selected story once, invalidate the token, clear it from the URL, and personalize the greeting. This introduces a demo identity, not an authenticated member or account authorization.
7. Support expiry, cancellation, already-used and unavailable states. Do not fall back to Maya while implying the member's story transferred.

## Required before enabling QR transfer

- A phone-reachable HTTPS host and an approved temporary storage implementation with enforced expiry and atomic redemption.
- Explicit lifetime and retention choice, bounded payload, rate limiting and no content logging.
- Tests for simultaneous redemption, expiry, cancellation, wrong tenant, invalid input, oversized input and scanner prefetch.
- Real phone verification, not just a QR image rendered on desktop.

No deployment, public tunnel, database changes, or transfer of member information has been performed. Existing local guide work can be reviewed independently of this integration.

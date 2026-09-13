# Central Henderson member experience: first comparison

Source comparison against the Faithful release, 13 September 2026. This is a read-only product audit, not approval to activate new Central behavior. It covers the tenant member pages, not the entire Admin/CRM platform. Central has not received these changes.

## Recommendation

Reuse the interaction patterns, not the Faithful files wholesale. Extract tenant-neutral guide/story/profile components with explicit church configuration, then verify Central-specific copy and identities before enabling them. Keep the current Faithful gate until that work is tested.

| Area | Current Central evidence | Recommended next step |
| --- | --- | --- |
| Navigation | Desktop still uses My Journey and Link to Mobile; titles include Maya's Journey (`member-portal.html`, navigation and titles map). | Align destination naming and accessible controls, retaining canonical route keys. |
| Page guides and answers | Central does not load Faithful preferences, care, wallet, guide-finish, or story modules. | Reuse the concise introduction plus optional Let us know/Open/Close/Skip pattern through shared configuration, not copied Faithful script chains. |
| Leadership | Central's leader data contains James Wilson sample biography, experience, languages and external avatar configuration. | Church must approve leader identities, roles, specialties and availability before presenting them as real Central services. Preserve the AI/human distinction and explicit care handoff. |
| Wallet and Impact | Central has its existing wallet/account controls and shared impact metrics. | Reuse category spending sliders and cause/store selection as an explicitly illustrative draft. Confirm Central causes and financial copy; do not imply issuance or KYC approval. |
| Mobile | `sec-mobile` has a static phone image, QR and App URL. Copy says iOS Native and asks visitors to log in/sign up. | Replace with an interactive web preview only after validating its framing policy. Match copy to actual web/demo capability. Do not promise account creation or transfer without those services. |
| Story/signup/profile | No equivalent imports for Faithful mobile-story, member-profile or Settings tabs. | Bring over the read-only snapshot -> editable simulated signup -> isolated profile pattern. Do not seed visitor answers from Maya. |
| Settings | No equivalent Settings section in Central desktop source. | Reuse Profile, Guidance, Reading & voice and Your information tabs, with truthful persistence/reset controls. |
| Shared GRACE | Central loads messaging, companion and member-session but does not opt into faithful-v1. | Test routing, prompt, greeting and speech behavior under a separate explicit tenant configuration before activating improvements. |

## Details that prevent a blind copy

- Faithful preferences contain the literal storage namespace `grace.preferences.faithful` and a demo-Maya fallback. Its profile includes Faithful sample stories and history. These require tenant/identity configuration first.
- Faithful's final guide UI is assembled by several successive enhancement scripts. The user-visible result is reusable; duplicating the entire override chain for Central would increase maintenance risk.
- The current production iframe exception is exact to Faithful mobile. Central intentionally retains its existing restrictive framing headers. Enabling an embedded Central preview requires its own narrow same-origin exception and tests.
- Public HTML comparisons cannot establish Central authentication, CRM permissions, real leader authorization, account persistence or physical-phone transfer. Those remain separate verification gates.
- Faithful demo profile/signup is not production account registration. UI polish does not supply that backend.

## Proposed first slice

Central My Church only: shared configurable guide shell, purpose-based heading, optional story fields, Open/Close/Skip, isolated visitor draft and clear demo status. Validate desktop/mobile, keyboard behavior, clearing and tenant isolation before proceeding to Leadership and the remaining pages. No Central UI or configuration was changed in this audit.

# GRACE — Church CRM & Member Portal

Unified portal for **GRACE** church CRM and member experiences. React CRM + static HTML member prototypes.

## Live links

See **[docs/LINKS.md](docs/LINKS.md)** for the full product URL tree (Central Henderson demo vs white-label SaaS).

| Lane | Hub | CRM | Member portal |
|------|-----|-----|---------------|
| **Central Henderson demo** | [gracecrm-centralhenderson.org](https://gracecrm-centralhenderson.org/members-card.html) | [Demo CRM](https://gracecrm-centralhenderson.org/app#/dashboard) | [Desktop portal](https://gracecrm-centralhenderson.org/previews/grace_member_portal_central.html) |
| **White-label SaaS** | [grace-crm-two.vercel.app](https://grace-crm-two.vercel.app/whitelabel-hub.html) | [grace-crm-two.vercel.app/#/dashboard](https://grace-crm-two.vercel.app/#/dashboard) | [Generic portal](https://grace-crm-two.vercel.app/previews/grace_member_portal_generic.html) |

GitHub Pages static preview: **https://1spm.github.io/grace-central-henderson/**

## Local preview

From the repo root:

```bash
python3 -m http.server 8765
```

Then open http://127.0.0.1:8765/index.html

Hard-refresh (**Cmd+Shift+R**) after pulling changes so fonts and CSS update.

## GRACE neural voice (ElevenLabs + Vercel)

GRACE can speak with **ElevenLabs** neural TTS via a serverless proxy — the API key never ships to the browser.

| Deploy target | Voice |
|---------------|-------|
| **GitHub Pages** | Browser `speechSynthesis` (automatic fallback) |
| **Vercel** | ElevenLabs Rachel voice when `ELEVENLABS_API_KEY` is set |

### Local dev with voice

```bash
cp .env.example .env.local
# Add your ElevenLabs API key to .env.local

npx vercel dev
```

Open the desktop portal (e.g. http://localhost:3000/previews/grace_member_portal_central.html), click the GRACE orb, and ask a question — she should reply with neural voice. The panel header shows **Neural voice** when ElevenLabs is active.

### Vercel production

1. Import this repo in [Vercel](https://vercel.com)
2. Add environment variables (see [`.env.example`](.env.example)):
   - `ELEVENLABS_API_KEY` (required)
   - `ELEVENLABS_VOICE_ID` (optional, default Rachel)
   - `ELEVENLABS_MODEL_ID` (optional, default `eleven_flash_v2_5`)
3. Deploy — static previews and `/api/grace/tts` share the same origin

### API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/grace/tts` | POST | `{ "text": "..." }` → `audio/mpeg` |
| `/api/grace/tts/health` | GET | Health probe for client auto-detect |
| `/api/grace-tts` | POST | Legacy alias (same handler) |
| `/api/grace-tts/health` | GET | Legacy alias (same handler) |

## Key files

| Path | Description |
|------|-------------|
| `grace_central_henderson_members_card_ios_app.html` | Canonical iOS Members Card app (root URL) |
| `previews/grace_central_henderson_members_card_ios_app.companion-preview.html` | Legacy companion-integrated build for side-by-side comparison |
| `previews/grace_member_portal_central.html` | Desktop member portal (Central Henderson demo) |
| `previews/grace_member_portal_generic.html` | Desktop member portal (white-label generic copy) |
| `previews/grace_mobile_ios-central.html` | Mobile app prototype |
| `previews/grace-central-theme.css` | Central brand theme (Poppins, Montserrat, `#EE2B37`) |
| `previews/grace-messaging.js` | Canonical GRACE vs leader avatar messaging |
| `previews/grace-companion.js` | Floating GRACE chat, memory, voice (ElevenLabs + browser fallback) |
| `previews/grace-duotone-icons.js` | Red/pink duotone icon system |
| `api/_lib/grace-tts.ts` | Shared ElevenLabs TTS proxy (Vercel + local dev) |
| `previews/assets/central-henderson-logo.png` | Central Henderson logo |

## AI model

GRACE uses a **two-tier** approach documented in [`previews/grace-messaging.js`](previews/grace-messaging.js):

- **GRACE** (Growth · Resource · Assistance · Community · Engagement) — Guides app navigation: giving, watch, groups, events, and care routing. For deeper conversation, connect with a leader avatar.
- **Leader avatars (independent agents)** — Each verified leader has an isolated, grounded avatar profile (their pastoral essence captured per the church avatar program). Members confide with leader avatars, not GRACE. Conversations are siloed per leader and kept confidential if saved at all.

All member preview HTML files load `grace-messaging.js` for shared copy.

**GRACE** system identity on Home cards uses the animated **grace orb** ([`previews/grace-orb.css`](previews/grace-orb.css)) — not the church C mark. Leader avatars and GRACE Impact Card wallet branding still use church marks and photos.

## Pastor CRM tour

On the **Home** dashboard, pastors click **Take a Tour** for an 11-step overview of GRACE Admin (Ask Grace, Action Center, congregation, leadership, pastoral care, and giving). **More tours** opens scenario-based walkthroughs (Sunday Game Day, Monday Follow-Up, etc.). Replay anytime via **Settings → General → Run Tutorials**.

## Design notes

- **Brand:** Black `#000000`, accent red `#EE2B37`, white `#FFFFFF`
- **Fonts:** Poppins (body), Montserrat (headings)
- **Content:** Placeholder data and demo portraits for review only

## Sharing updates

Push to `main` and GitHub Actions will redeploy the live site automatically.

```bash
git add .
git commit -m "Your update message"
git push origin main
```

## License

Prototype / internal use unless otherwise specified by Central Henderson.


<!-- deploy-trigger: refresh production env vars (Clerk live keys) - 2026-07-17 -->

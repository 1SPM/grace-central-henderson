# GRACE — Central Henderson Member Portal

Interactive HTML prototypes for the **GRACE** member experience at **Central Henderson**. Static HTML/CSS/JS — no build step.

## Live preview

After GitHub Pages is enabled, share this link:

**https://1spm.github.io/grace-central-henderson/**

| Preview | Path |
|--------|------|
| **Prototype hub** | `/index.html` |
| **iOS Members Card app (canonical)** | `/grace_central_henderson_members_card_ios_app.html` |
| **Desktop member portal** | `/previews/grace_member_portal_central.html` |
| **Mobile member app** | `/previews/grace_mobile_ios-central.html` |
| **Members Card companion preview (compare only)** | `/previews/grace_central_henderson_members_card_ios_app.companion-preview.html` |

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
3. Deploy — static previews and `/api/grace-tts` share the same origin

### API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/grace-tts` | POST | `{ "text": "..." }` → `audio/mpeg` |
| `/api/grace-tts/health` | GET | Health probe for client auto-detect |

## Key files

| Path | Description |
|------|-------------|
| `grace_central_henderson_members_card_ios_app.html` | Canonical iOS Members Card app (root URL) |
| `previews/grace_central_henderson_members_card_ios_app.companion-preview.html` | Legacy companion-integrated build for side-by-side comparison |
| `previews/grace_member_portal_central.html` | Desktop member portal — Home, Leadership, Give, Community, Profile |
| `previews/grace_mobile_ios-central.html` | Mobile app prototype |
| `previews/grace-central-theme.css` | Central brand theme (Poppins, Montserrat, `#EE2B37`) |
| `previews/grace-messaging.js` | Canonical GRACE vs leader avatar messaging |
| `previews/grace-companion.js` | Floating GRACE chat, memory, voice (ElevenLabs + browser fallback) |
| `previews/grace-duotone-icons.js` | Red/pink duotone icon system |
| `api/grace-tts.js` | Vercel serverless ElevenLabs TTS proxy |
| `previews/assets/central-henderson-logo.png` | Central Henderson logo |

## AI model

GRACE uses a **two-tier** approach documented in [`previews/grace-messaging.js`](previews/grace-messaging.js):

- **GRACE** (Growth · Resource · Assistance · Community · Engagement) — Guides app navigation: giving, watch, groups, events, and care routing. For deeper conversation, connect with a leader avatar.
- **Leader avatars (independent agents)** — Each verified leader has an isolated, grounded avatar profile (their pastoral essence captured per the church avatar program). Members confide with leader avatars, not GRACE. Conversations are siloed per leader and kept confidential if saved at all.

All member preview HTML files load `grace-messaging.js` for shared copy.

**GRACE** system identity on Home cards uses the animated **grace orb** ([`previews/grace-orb.css`](previews/grace-orb.css)) — not the church C mark. Leader avatars and GRACE Impact Card wallet branding still use church marks and photos.

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

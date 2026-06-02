# GRACE — Central Henderson Member Portal

Interactive HTML prototypes for the **GRACE** member experience at **Central Henderson**. Static HTML/CSS/JS — no build step.

## Live preview

After GitHub Pages is enabled, share this link:

**https://1spm.github.io/grace-central-henderson/**

| Preview | Path |
|--------|------|
| **Prototype hub** | `/index.html` |
| **Desktop member portal** | `/previews/grace_member_portal_central.html` |
| **Mobile member app** | `/previews/grace_mobile_ios-central.html` |

## Local preview

From the repo root:

```bash
python3 -m http.server 8765
```

Then open http://127.0.0.1:8765/index.html

Hard-refresh (**Cmd+Shift+R**) after pulling changes so fonts and CSS update.

## Key files

| Path | Description |
|------|-------------|
| `previews/grace_member_portal_central.html` | Desktop member portal — Home, Leadership, Give, Community, Profile |
| `previews/grace_mobile_ios-central.html` | Mobile app prototype |
| `previews/grace-central-theme.css` | Central brand theme (Poppins, Montserrat, `#EE2B37`) |
| `previews/grace-duotone-icons.js` | Red/pink duotone icon system |
| `previews/assets/central-henderson-logo.png` | Central Henderson logo |

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

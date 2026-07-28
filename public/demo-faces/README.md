# Demo congregation faces

**These are not photographs of real people.**

Every image in this folder is a GAN-generated synthetic face from
<https://thispersondoesnotexist.com>. The individuals depicted do not exist, so
there is no likeness, consent, or privacy concern in using them.

They exist so the **Faithful Church demo tenant**
(`22222222-2222-2222-2222-222222222222`) reads like a real, populated
congregation instead of a wall of initials.

## Rules

1. **Demo tenant only.** Never attach these to a real church's records. Live
   client tenants (e.g. Central Henderson) use real member photos or initials.
2. **Do not hotlink `thispersondoesnotexist.com`.** It returns a *different*
   random face on every request, so a member's face would change on each page
   load. That is why the images are vendored here as static assets.
3. Referenced from `people.photo_url` as `/demo-faces/fNNN.jpg`, rendered by
   `src/components/ui/MemberAvatar.tsx` (which falls back to initials if an
   image fails to load).

## Regenerating

Images are 256×256 JPEG (~20 KB each), downscaled from the source 1024×1024:

```bash
curl -H 'Referer: https://thispersondoesnotexist.com/' \
  -o raw.jpg https://thispersondoesnotexist.com/random-person.jpeg
sips -Z 256 raw.jpg --out fNNN.jpg
```

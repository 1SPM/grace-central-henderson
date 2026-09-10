/* Generated profile avatar (free, deterministic, no key) via DiceBear.
   Same name → same avatar; falls back to initials if the image fails. */
import { useState } from 'react';

const BG = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,d9e5ff';

export function PersonAvatar({ name, initials, size = 'sm' }: { name: string; initials: string; size?: 'sm' | 'md' | 'xl' }) {
  const [failed, setFailed] = useState(false);
  const cls = `avatar${size === 'sm' ? ' sm' : size === 'xl' ? ' xl' : ''}`;
  if (failed || !name.trim()) return <div className={cls}>{initials}</div>;
  const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=${BG}&radius=50`;
  return <img className={cls} src={url} alt={name} loading="lazy" onError={() => setFailed(true)} style={{ objectFit: 'cover' }} />;
}

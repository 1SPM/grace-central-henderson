import type { ChurchSettings } from '../hooks/useChurchSettings';
import { CENTRAL_HENDERSON_DEFAULT_SETTINGS } from './centralHenderson';
import { FAITHFUL_CHURCH_DEFAULT_SETTINGS } from './faithfulChurch';

/** White-label Faithful Church tenant (grace-crm Vercel project). */
export const isFaithfulTenant =
  import.meta.env.VITE_TENANT_DEFAULT === 'faithful';

export function getDefaultChurchSettings(): ChurchSettings {
  return isFaithfulTenant
    ? FAITHFUL_CHURCH_DEFAULT_SETTINGS
    : CENTRAL_HENDERSON_DEFAULT_SETTINGS;
}

export function getDefaultChurchName(): string {
  return getDefaultChurchSettings().profile.name;
}

/** Apply branding.primaryColor to CSS custom properties on :root */
export function applyBrandingPrimaryColor(hex?: string): void {
  if (!hex) return;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return;
  const rgb = `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
  document.documentElement.style.setProperty('--color-primary', rgb);
}

/**
 * The server-side set of recognized demo tenants — currently just
 * Faithful Church. Anything outside this set is treated as a real
 * production tenant by every Provisioning Studio guard (the demo
 * persona generator requires typed confirmation there).
 */
export const DEMO_CHURCH_IDS: ReadonlySet<string> = new Set([
  '22222222-2222-2222-2222-222222222222',
]);

export function isDemoChurch(churchId: string): boolean {
  return DEMO_CHURCH_IDS.has(churchId);
}

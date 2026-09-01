/**
 * Re-export shim — the ministry-areas map's source of truth is
 * src/lib/ministryAreas.ts.
 *
 * It moved there because several src/ components (CampusView.tsx,
 * MinistryAreasPanel.tsx, useMinistryAreas.ts) import it at the top level,
 * and `vercel dev` reserves the whole /api/ path for serverless functions —
 * there's no rewrite that makes a plain file under /api/_lib/ servable to
 * the browser as a module. The api-side consumers here (agentWorkflows.ts,
 * workos/_staff.ts, workos/_my-work.ts, workos/_areas.ts) keep importing
 * from this path unchanged; only the content moved.
 */
export * from '../../src/lib/ministryAreas.js';

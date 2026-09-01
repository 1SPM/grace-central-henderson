/**
 * Re-export shim — the action catalog's source of truth is src/lib/actionCatalog.ts.
 *
 * It moved there because GraceChatContext.tsx imports it at the top level,
 * and `vercel dev` reserves the whole /api/ path for serverless functions —
 * there's no rewrite that makes a plain file under /api/_lib/ servable to
 * the browser as a module. The api-side consumers here (actions/_execute.ts,
 * actions/_propose.ts) keep importing from this path unchanged; only the
 * content moved.
 */
export * from '../../src/lib/actionCatalog.js';

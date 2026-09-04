import type { View } from '../../types';
import { findWorkspace } from '../workspaceRegistry';

/**
 * Turns an explicit navigation command into the same view transition the
 * sidebar and the Cmd+K palette use.
 *
 * The workspace list lives in src/lib/workspaceRegistry.ts and is shared with
 * GlobalSearch, so chat and the palette can never disagree about what a
 * workspace is called — a drift that already cost this resolver 11 of the
 * palette's 23 destinations.
 */
export interface WorkspaceNavigation {
  view: View;
  label: string;
}

const NAVIGATION_INTENT = /^(?:open|show|go to|take me to|navigate to|jump to)\s+(?:the\s+)?(.+?)[.!?]*$/i;

/**
 * Recognizes only imperative navigation, never a question *about* a workspace.
 *
 * `canAccess` is the caller's route guard (useRouteGuard). It is REQUIRED
 * rather than optional: the palette filters its own list through the same
 * guard, and a chat door that navigates where the palette refuses to offer is
 * the parity promise running backwards. An unauthorized target resolves to
 * null so the request falls through to the model, which answers under the
 * capability boundary instead of silently moving the user.
 */
export function resolveWorkspaceNavigation(
  query: string,
  canAccess: (view: View) => boolean = () => true,
): WorkspaceNavigation | null {
  const match = query.trim().match(NAVIGATION_INTENT);
  if (!match) return null;
  const workspace = findWorkspace(match[1]);
  if (!workspace || !canAccess(workspace.view)) return null;
  return { view: workspace.view, label: workspace.label };
}

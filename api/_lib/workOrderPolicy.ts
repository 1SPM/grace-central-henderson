/**
 * Work Order transition policy overlays — rules that narrow the base
 * ALLOWED_TRANSITIONS table (api/work-orders/_index.ts) for specific
 * kinds of Work Order. Pure and unit-testable so the policy itself (not
 * just its wiring into the route) is directly provable.
 */

export interface WorkOrderPolicyContext {
  ministry: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Communications Work Orders (Impact Card communications, campaign
 * announcements, etc.) must go through an approval before execution —
 * required by the giving/Impact Card phase brief. Detected by ministry
 * name or an explicit metadata flag, so a template-created Work Order
 * (api/_lib/workOrderTemplates.ts) can mark itself regardless of the
 * free-text ministry field a user later edits.
 */
export function requiresApprovalBeforeExecution(ctx: WorkOrderPolicyContext): boolean {
  if (ctx.metadata && ctx.metadata.requires_approval === true) return true;
  if (ctx.ministry && /communications/i.test(ctx.ministry)) return true;
  return false;
}

/**
 * Given the base allowed-transitions list for the current status, remove
 * any transition that would let a policy-gated Work Order skip straight
 * to in_progress without passing through awaiting_approval.
 */
export function applyApprovalPolicy(
  baseAllowed: string[],
  ctx: WorkOrderPolicyContext,
  currentStatus: string,
): string[] {
  if (currentStatus !== 'planning') return baseAllowed;
  if (!requiresApprovalBeforeExecution(ctx)) return baseAllowed;
  return baseAllowed.filter(status => status !== 'in_progress');
}

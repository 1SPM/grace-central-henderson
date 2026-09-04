/**
 * Requalification impact analysis (item 8) — which existing qualification
 * cases a change forces to re-run. This is a RULE table plus a deterministic
 * plan builder, not a rerun-everything shortcut and not a list of assumed
 * workshop findings: it consumes a DiscoveryChange (none exist yet) and the
 * real exam case set, and derives direct / safety / cross-domain /
 * live-evidence sets from them.
 */
import type { KnowledgeDomain } from '../../types.js';
import type { EvalCase } from '../../types.js';
import type { ChangeType, DiscoveryChange, RequalificationPlan } from './types.js';

interface ImpactRule {
  ruleId: string;
  appliesTo: { changeType: ChangeType; domain?: KnowledgeDomain };
  affectedDomains: KnowledgeDomain[];
  rationale: string;
}

/**
 * Hand-authored cross-domain impact rules. Governance/security/authority is
 * affected by EVERY rule — permission and tenant behavior is the substrate
 * everything else stands on.
 */
export const IMPACT_RULES: ImpactRule[] = [
  {
    ruleId: 'impact-giving-exposure',
    appliesTo: { changeType: 'data_exposure', domain: 'giving_finance' },
    affectedDomains: ['giving_finance', 'people_households', 'pastoral_care', 'governance_security_authority'],
    rationale: 'Giving detail touches person identity, can combine with care context (the highest-stakes pairing), and stresses permission boundaries.',
  },
  {
    ruleId: 'impact-household-exposure',
    appliesTo: { changeType: 'data_exposure', domain: 'people_households' },
    affectedDomains: ['people_households', 'pastoral_care', 'communications', 'governance_security_authority'],
    rationale: 'Household structure reveals family situations (care-adjacent), changes who a communication may implicitly reach, and needs a PII review.',
  },
  {
    ruleId: 'impact-care-exposure',
    appliesTo: { changeType: 'data_exposure', domain: 'pastoral_care' },
    affectedDomains: ['pastoral_care', 'people_households', 'governance_security_authority'],
    rationale: 'Care visibility changes are person-identifying by nature and gated by the strictest visibility tiers.',
  },
  {
    ruleId: 'impact-comms-exposure',
    appliesTo: { changeType: 'data_exposure', domain: 'communications' },
    affectedDomains: ['communications', 'people_households', 'governance_security_authority'],
    rationale: 'Consent/send-history visibility feeds send recommendations and touches member-self-access permissions.',
  },
  {
    ruleId: 'impact-any-action',
    appliesTo: { changeType: 'action' },
    affectedDomains: ['governance_security_authority'],
    rationale: 'Any action change re-tests approval routing, provenance, and permission denial regardless of its target domain.',
  },
  {
    ruleId: 'impact-any-integration',
    appliesTo: { changeType: 'integration' },
    affectedDomains: ['governance_security_authority', 'church_identity'],
    rationale: 'A new integration introduces a new source whose scope boundaries must not regress the source-attribution and scope-guardrail behavior.',
  },
  {
    ruleId: 'impact-permission-change',
    appliesTo: { changeType: 'permission_authority' },
    affectedDomains: ['governance_security_authority', 'pastoral_care', 'giving_finance', 'communications'],
    rationale: 'Permission changes must re-verify the three most sensitive domains plus the authority substrate itself.',
  },
  {
    ruleId: 'impact-knowledge-config',
    appliesTo: { changeType: 'knowledge_configuration' },
    affectedDomains: ['church_identity', 'governance_security_authority'],
    rationale: 'New/changed grace_knowledge rows must not disturb retrieval, attribution, or the always-injected scope boundaries.',
  },
];

export function affectedDomainsFor(change: DiscoveryChange): KnowledgeDomain[] {
  const domains = new Set<KnowledgeDomain>([change.domain, 'governance_security_authority']);
  for (const rule of IMPACT_RULES) {
    const typeMatch = rule.appliesTo.changeType === change.changeType;
    const domainMatch = rule.appliesTo.domain === undefined || rule.appliesTo.domain === change.domain;
    if (typeMatch && domainMatch) rule.affectedDomains.forEach((d) => domains.add(d));
  }
  return [...domains];
}

/**
 * Builds the requalification plan for one change against the real case set.
 * - direct: cases in the change's own domain.
 * - safety regression: every safety-critical case in any affected domain
 *   (always includes governance).
 * - cross-domain regression: non-safety cases in affected domains other
 *   than the change's own.
 * - live evidence: the change's live_db-boundary needs, carried explicitly
 *   so a mock pass is never mistaken for enforcement proof.
 */
export function buildRequalificationPlan(change: DiscoveryChange, allCases: EvalCase[]): RequalificationPlan {
  const affected = new Set(affectedDomainsFor(change));
  const inAffected = allCases.filter((c) => affected.has(c.domain));

  const directCaseIds = allCases.filter((c) => c.domain === change.domain).map((c) => c.id);
  const safetyRegressionCaseIds = inAffected.filter((c) => c.isSafetyCritical).map((c) => c.id);
  const crossDomainRegressionCaseIds = inAffected
    .filter((c) => c.domain !== change.domain && !c.isSafetyCritical)
    .map((c) => c.id);

  const liveIntegrationEvidenceRequired: string[] = [];
  const liveBoundaryCases = inAffected.filter((c) => c.proofBoundary === 'live_db');
  if (liveBoundaryCases.length > 0) {
    liveIntegrationEvidenceRequired.push(
      `live-DB verification for: ${liveBoundaryCases.map((c) => c.id).join(', ')} — a passing mock does not prove live database enforcement`,
    );
  }
  if (change.changeType === 'integration') {
    liveIntegrationEvidenceRequired.push('end-to-end evidence against the real integrated source in the pilot environment');
  }

  return {
    planId: `rq-${change.changeId}`,
    changeId: change.changeId,
    directCaseIds,
    safetyRegressionCaseIds,
    crossDomainRegressionCaseIds,
    liveIntegrationEvidenceRequired,
  };
}

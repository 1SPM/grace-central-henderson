/**
 * Agent registry — static definitions for the Agent Command Centre.
 *
 * Pure metadata, no execution here (see api/_lib/agentWorkflows.ts for the
 * runnable subset). `implemented: false` agents show "Not yet
 * implemented — no executions recorded" in the UI rather than fabricated
 * activity, per the WorkOS spec: "the activity displayed must represent
 * real recorded execution rather than animated mock activity."
 */

export interface AgentDefinition {
  key: string;
  name: string;
  role: string;
  description: string;
  implemented: boolean;
}

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    key: 'grace',
    name: 'Grace',
    role: 'WorkOS Orchestrator',
    description: 'Scans open Work Orders, tasks, and approvals for items that need attention and records what it finds.',
    implemented: true,
  },
  {
    key: 'shepherd',
    name: 'Shepherd',
    role: 'Member Care',
    description: 'Surfaces care requests awaiting assignment or response.',
    implemented: true,
  },
  {
    key: 'welcome',
    name: 'Welcome',
    role: 'Newcomer Journey',
    description: 'Tracks first-visit follow-up timing for newcomers.',
    implemented: false,
  },
  {
    key: 'gather',
    name: 'Gather',
    role: 'Engagement Analysis',
    description: 'Reviews attendance and group-participation trends.',
    implemented: false,
  },
  {
    key: 'serve',
    name: 'Serve',
    role: 'Volunteer Coordination',
    description: 'Matches volunteer interest submissions to open roles.',
    implemented: false,
  },
  {
    key: 'impact',
    name: 'Impact',
    role: 'Impact Card Operations',
    description: 'Reviews Impact Card operational readiness items.',
    implemented: false,
  },
  {
    key: 'herald',
    name: 'Herald',
    role: 'Communications',
    description: 'Reviews scheduled and pending outbound communications.',
    implemented: false,
  },
  {
    key: 'steward',
    name: 'Steward',
    role: 'Financial Operations',
    description: 'Reviews giving-ledger reconciliation status.',
    implemented: true,
  },
  {
    key: 'compass',
    name: 'Compass',
    role: 'Product and Workflow',
    description: 'Reviews Work Order process health across ministries.',
    implemented: false,
  },
  {
    key: 'sentinel',
    name: 'Sentinel',
    role: 'Privacy and Compliance',
    description: 'Reviews data-subject requests and consent-record hygiene.',
    implemented: true,
  },
  {
    key: 'verity',
    name: 'Verity',
    role: 'Quality Review',
    description: 'Reviews data-quality signals: missing contact info, unassigned ownership.',
    implemented: true,
  },
  {
    key: 'steve',
    name: 'Steve',
    role: 'Platform Strategy Agent',
    description: 'Evaluates proposed features, plans, and product decisions against the VWS platform strategy: platform coherence, commercial defensibility, privacy, and Central Church pilot readiness. Runs strategic reviews — not database scans.',
    implemented: true,
  },
  {
    key: 'charles',
    name: 'Charles',
    role: 'Engineering Agent',
    description: 'Owns the GRACE backend: infrastructure, deployment, API routes, database schema, and engineering discipline across the platform.',
    implemented: false,
  },
  {
    key: 'marco',
    name: 'Marco',
    role: 'Interface Agent',
    description: 'Owns member-facing UIs: Divinity, design systems, portal experience, and the visual layer of the VWS platform.',
    implemented: false,
  },
  {
    key: 'clarence',
    name: 'Clarence',
    role: 'Ministry Configuration Agent',
    description: 'Owns workflow setup, ministry logic, leader tools, and configuration surfaces that let churches shape VWS to their operations.',
    implemented: false,
  },
  {
    key: 'marci',
    name: 'Marci',
    role: 'Data Agent',
    description: 'Owns member intelligence, analytics, reporting, and the GRACE Impact measurement layer.',
    implemented: false,
  },
];

export function getAgentDefinition(key: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find(a => a.key === key);
}

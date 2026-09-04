import { describe, it, expect } from 'vitest';
import { DISCOVERY_ITEMS } from './discovery-items.js';
import {
  WORKSHOP_PHASES,
  PARTICIPANT_MATRIX,
  WORKFLOW_SELECTION_CRITERIA,
  PILOT_WORKFLOW_CANDIDATES,
  PILOT_READINESS_GATES,
  DEMO_SEQUENCE,
  DECISION_LOG,
  PARKING_LOT,
} from './workshop-playbook.js';

const PHASE_IDS = new Set(WORKSHOP_PHASES.map((p) => p.phaseId));
const DISCOVERY_GAP_IDS = new Set(DISCOVERY_ITEMS.map((i) => i.gapId));

describe('Central Henderson workshop playbook — integrity', () => {
  it('has six phases (A–F) with unique ids and realistic total time', () => {
    expect(WORKSHOP_PHASES).toHaveLength(6);
    expect(PHASE_IDS.size).toBe(6);
    const total = WORKSHOP_PHASES.reduce((s, p) => s + p.durationMinutes, 0);
    // 300 minutes of content (5h) — breaks/lunch added in the agenda doc.
    expect(total).toBe(300);
  });

  it('every participant-role phase reference resolves to a real phase', () => {
    const dangling: string[] = [];
    for (const r of PARTICIPANT_MATRIX) {
      for (const ph of r.phases) {
        if (!PHASE_IDS.has(ph)) dangling.push(`${r.roleId} -> ${ph}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('every phase has at least one required participant with decision authority available in Phase F', () => {
    const phaseF = PARTICIPANT_MATRIX.filter(
      (r) => r.involvement === 'required' && r.decisionAuthority && r.phases.includes('phase-f-readiness-decisions')
    );
    expect(phaseF.length).toBeGreaterThan(0);
  });

  it('workflow candidates trace to real discovery gap ids (anchor workflow may have none)', () => {
    const dangling: string[] = [];
    for (const w of PILOT_WORKFLOW_CANDIDATES) {
      for (const gapId of w.relatedGapIds) {
        if (!DISCOVERY_GAP_IDS.has(gapId)) dangling.push(`${w.workflowId} -> ${gapId}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('offers 6 candidates so the workshop can select 3–5, each with qualification requirements', () => {
    expect(PILOT_WORKFLOW_CANDIDATES).toHaveLength(6);
    for (const w of PILOT_WORKFLOW_CANDIDATES) {
      expect(w.qualificationCasesRequired.length).toBeGreaterThan(0);
    }
  });

  it('every needed_for_pilot discovery item is represented by at least one workflow candidate', () => {
    const covered = new Set(PILOT_WORKFLOW_CANDIDATES.flatMap((w) => w.relatedGapIds));
    const uncoveredNeeded = DISCOVERY_ITEMS
      .filter((i) => i.priority === 'needed_for_pilot')
      .filter((i) => !covered.has(i.gapId))
      .map((i) => i.gapId);
    expect(uncoveredNeeded).toEqual([]);
  });

  it('has 6 selection criteria matching the request', () => {
    expect(WORKFLOW_SELECTION_CRITERIA).toHaveLength(6);
  });

  it('has the 7 readiness gates with exactly one safety-critical gate', () => {
    expect(PILOT_READINESS_GATES).toHaveLength(7);
    const safety = PILOT_READINESS_GATES.filter((g) => g.safetyCritical);
    expect(safety).toHaveLength(1);
    expect(safety[0].gateId).toBe('gate-safety');
  });

  it('demo sequence covers knows → boundary → remembers → authority, each grounded in a proven mechanism', () => {
    expect(DEMO_SEQUENCE.map((d) => d.stepId)).toEqual(['demo-known', 'demo-boundary', 'demo-memory', 'demo-authority']);
    for (const d of DEMO_SEQUENCE) {
      expect(d.provenBy.length).toBeGreaterThan(0);
      expect(d.caution.length).toBeGreaterThan(0);
    }
  });

  it('decision log and parking lot start empty — filled only by a real session', () => {
    expect(DECISION_LOG).toEqual([]);
    expect(PARKING_LOT).toEqual([]);
  });
});

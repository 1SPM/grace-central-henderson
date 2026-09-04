/**
 * "Show Us, Don't Tell Us" (item 8) — workflow-demonstration prompts.
 * Where practical, don't ask Central how something works; ask them to
 * show the real workflow, live. Distinguishes stated process from actual
 * operational process — a mismatch between the two is itself a finding.
 *
 * Each entry records what should be demonstrated, and what to capture
 * once it has been: which system was actually used, and who owns it.
 */
import type { KnowledgeDomain } from '../../types.js';

export interface ShowUsDemonstration {
  demoId: string;
  domain: KnowledgeDomain;
  prompt: string;
  relatedGapIds: string[];
  captureSystemDemonstrated: string | null;
  captureSystemOwner: string | null;
  captureMatchedStatedProcess: boolean | null;
  captureNotes: string | null;
}

function blankCapture() {
  return {
    captureSystemDemonstrated: null,
    captureSystemOwner: null,
    captureMatchedStatedProcess: null,
    captureNotes: null,
  };
}

export const SHOW_US_DONT_TELL_US: ShowUsDemonstration[] = [
  {
    demoId: 'show-new-person-entry',
    domain: 'people_households',
    prompt: 'Show us how a new person enters the system.',
    relatedGapIds: [],
    ...blankCapture(),
  },
  {
    demoId: 'show-household-representation',
    domain: 'people_households',
    prompt: 'Show us how a household is represented.',
    relatedGapIds: ['dg-households-not-exposed'],
    ...blankCapture(),
  },
  {
    demoId: 'show-prayer-request-followup',
    domain: 'pastoral_care',
    prompt: 'Show us what happens after someone requests prayer.',
    relatedGapIds: ['dg-prayer-staleness-signal'],
    ...blankCapture(),
  },
  {
    demoId: 'show-volunteer-scheduling',
    domain: 'sunday_worship',
    prompt: 'Show us how Sunday volunteers are scheduled.',
    relatedGapIds: ['dg-sunday-worship-data-pipelines'],
    ...blankCapture(),
  },
  {
    demoId: 'show-staff-outstanding-work',
    domain: 'staff_work',
    prompt: 'Show us where staff see outstanding work.',
    relatedGapIds: ['dg-workos-decision-queue-visibility'],
    ...blankCapture(),
  },
  {
    demoId: 'show-event-creation',
    domain: 'events_calendar',
    prompt: 'Show us how an event gets created.',
    relatedGapIds: ['dg-events-past-history-and-campaign-link'],
    ...blankCapture(),
  },
  {
    demoId: 'show-giving-fund-information',
    domain: 'giving_finance',
    prompt: 'Show us where giving / fund information lives.',
    relatedGapIds: ['dg-giving-persona-vocabulary-mismatch', 'dg-henderson-specific-financial-attendance-data'],
    ...blankCapture(),
  },
  {
    demoId: 'show-communication-approval-and-send',
    domain: 'communications',
    prompt: 'Show us how a church-wide communication is approved and sent.',
    relatedGapIds: ['dg-comms-consent-visibility'],
    ...blankCapture(),
  },
];

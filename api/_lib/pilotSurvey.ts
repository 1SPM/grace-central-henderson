/**
 * The Discovery + Validation pilot's member survey (Track C).
 *
 * Twelve questions, transcribed from
 * OPERATIONS/GRACE_Central_Discovery_Validation_Pilot_Deliverables.docx.pdf.
 * The wording is the church's, not ours — do not "improve" it. Each question
 * carries the dimension it measures, because the pilot scorecard reads results
 * by dimension (usability / trust+control / practical value / adoption) rather
 * than question by question, and a renamed dimension silently detaches a
 * question from its scoring bucket.
 *
 * WHY THE DEFINITIONS LIVE HERE. The same list has to drive the form, the
 * validation and the analysis. Keeping it server-side means a client that
 * drifts is rejected rather than quietly storing answers to questions nobody
 * asked — the same posture as storySegments.ts.
 *
 * Tracks A (Admin), B (Team) and the IMPACT concept set are deliberately not
 * here yet. The storage and endpoint are track-agnostic, so adding them is a
 * question-bank change, not a rebuild.
 */

export type QuestionType = 'likert5' | 'text' | 'choice';

export interface SurveyQuestion {
  key: string;
  /** Verbatim from the pilot document. */
  text: string;
  type: QuestionType;
  /** likert5 only: the 1 and 5 anchors, as written. */
  low?: string;
  high?: string;
  /** choice only. */
  options?: readonly string[];
  /** The scorecard dimension this feeds. */
  measures: string;
  /** Open-text answers are never required; a member may skip any question. */
  maxLength?: number;
}

const LIKELIHOOD = ['Very unlikely', 'Unlikely', 'Neutral', 'Likely', 'Very likely'] as const;

export const MEMBER_SURVEY: readonly SurveyQuestion[] = [
  { key: 'baseline_current_channels',
    // Asked retrospectively here. The document intends it as a pre-walkthrough
    // baseline; a facilitator running it live should capture it first.
    text: 'Before the walkthrough, how easy is it to do the task we discussed using Central’s current channels?',
    type: 'likert5', low: 'Very difficult', high: 'Very easy', measures: 'Current baseline' },
  { key: 'comprehension',
    text: 'After the walkthrough, how clearly do you understand what GRACE is?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'Comprehension' },
  { key: 'usability_navigate',
    text: 'How easy was the GRACE Members experience to navigate?',
    type: 'likert5', low: 'Very difficult', high: 'Very easy', measures: 'Usability' },
  { key: 'practical_value',
    text: 'Did GRACE give you useful information or a useful next step?',
    type: 'likert5', low: 'Not useful', high: 'Extremely useful', measures: 'Practical value' },
  { key: 'privacy_comfort',
    text: 'How comfortable were you with what GRACE appeared to know about you?',
    type: 'likert5', low: 'Very uncomfortable', high: 'Very comfortable', measures: 'Privacy' },
  { key: 'ai_disclosure',
    text: 'How clear was it that you were interacting with AI rather than a pastor or staff member?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'AI disclosure' },
  { key: 'human_escalation',
    text: 'How clear was it when a human would become involved?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'Human escalation' },
  { key: 'control_never_use',
    text: 'What information should GRACE never use without asking you first?',
    type: 'text', maxLength: 1000, measures: 'Control' },
  { key: 'most_valuable_reason',
    text: 'What is the most valuable reason you would use GRACE?',
    type: 'choice', measures: 'Value',
    options: ['Information', 'Groups and events', 'Communication', 'Next steps',
              'Pastoral support', 'Giving', 'IMPACT', 'Other'] },
  { key: 'barrier',
    text: 'What would make you not use GRACE?',
    type: 'text', maxLength: 1000, measures: 'Barrier' },
  { key: 'channel_duplication',
    text: 'Compared with the Central tools you already use, would GRACE feel easier, about the same, or like another place to check?',
    type: 'choice', measures: 'Channel duplication',
    options: ['Easier', 'About the same', 'Another place to check', 'Not sure'] },
  { key: 'adoption_signal',
    text: 'How likely would you be to use GRACE at least monthly if Central continued with it?',
    type: 'choice', measures: 'Adoption signal', options: LIKELIHOOD },
] as const;

/**
 * Faithful's own group. Three reasons it is a separate track rather than the
 * same questions on a different tenant:
 *
 *  1. Faithful's form must not say "Central". Three of the Central questions
 *     name the church, and a Faithful participant reading them would be asked
 *     to rate channels that are not theirs.
 *  2. The answers must not pool. A separate track means a separate row even
 *     if a respondent key somehow repeated, on top of the church_id split —
 *     two independent reasons the two churches' evidence stays apart.
 *  3. Faithful is where the "Let us know" onboarding is actually walked
 *     through, so the ease-of-use and comprehension questions here ask about
 *     the onboarding as part of the platform, and two questions below cover
 *     it directly. Central's track stays verbatim to the pilot document.
 *
 * Shared keys keep their Central meaning and measure, so the two sets can
 * still be read side by side on everything they have in common.
 */
export const FAITHFUL_MEMBER_SURVEY: readonly SurveyQuestion[] = [
  { key: 'baseline_current_channels',
    // "the task we discussed" relied on a facilitator being in earshot. It is
    // answered on the phone now, often after the room has moved on, so it names
    // what it is asking about instead.
    text: 'Thinking about what you came here to try: how easy is that to do today, using your church’s current channels?',
    type: 'likert5', low: 'Very difficult', high: 'Very easy', measures: 'Current baseline' },
  { key: 'onboarding_ease',
    text: 'How easy were the “Let us know” steps to work through as you went?',
    type: 'likert5', low: 'Very difficult', high: 'Very easy', measures: 'Onboarding usability' },
  { key: 'onboarding_purpose_clear',
    text: 'How clear was it why each “Let us know” step was asking for that information?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'Onboarding transparency' },
  { key: 'comprehension',
    text: 'After the walkthrough and the “Let us know” steps, how clearly do you understand what GRACE is?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'Comprehension' },
  { key: 'usability_navigate',
    text: 'How easy was the GRACE Members experience, including the onboarding steps, to navigate?',
    type: 'likert5', low: 'Very difficult', high: 'Very easy', measures: 'Usability' },
  { key: 'practical_value',
    text: 'Did GRACE give you useful information or a useful next step?',
    type: 'likert5', low: 'Not useful', high: 'Extremely useful', measures: 'Practical value' },
  { key: 'privacy_comfort',
    // The demo has no sign-in: GRACE knows nothing about the person answering,
    // and the figures on screen belong to a fabricated persona. Asking what it
    // "appeared to know about you" invited them to rate something that never
    // happened. What they did experience is being ASKED for things, so that is
    // what this measures. Still Privacy, still comparable with Central's.
    text: 'How comfortable were you with the information GRACE asked you for?',
    type: 'likert5', low: 'Very uncomfortable', high: 'Very comfortable', measures: 'Privacy' },
  { key: 'ai_disclosure',
    text: 'How clear was it that you were interacting with AI rather than a pastor or staff member?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'AI disclosure' },
  { key: 'human_escalation',
    text: 'How clear was it when a human would become involved?',
    type: 'likert5', low: 'Not clear', high: 'Very clear', measures: 'Human escalation' },
  { key: 'control_never_use',
    text: 'What information should GRACE never use without asking you first?',
    type: 'text', maxLength: 1000, measures: 'Control' },
  { key: 'most_valuable_reason',
    text: 'What is the most valuable reason you would use GRACE?',
    type: 'choice', measures: 'Value',
    options: ['Information', 'Groups and events', 'Communication', 'Next steps',
              'Pastoral support', 'Giving', 'IMPACT', 'Other'] },
  { key: 'barrier',
    text: 'What would make you not use GRACE?',
    type: 'text', maxLength: 1000, measures: 'Barrier' },
  { key: 'channel_duplication',
    text: 'Compared with the tools your church already uses, would GRACE feel easier, about the same, or like another place to check?',
    type: 'choice', measures: 'Channel duplication',
    options: ['Easier', 'About the same', 'Another place to check', 'Not sure'] },
  { key: 'adoption_signal',
    text: 'How likely would you be to use GRACE at least monthly if your church continued with it?',
    type: 'choice', measures: 'Adoption signal', options: LIKELIHOOD },
  { key: 'signup_intent',
    // The demo deliberately stops short of account creation -- making people
    // sign up before the payoff is friction, and it would also have answered
    // this question by coercion rather than by asking. So it is asked here.
    // Faithful only: Central's set is the pilot document's, unchanged.
    text: 'If your church offered this for real, how likely would you be to create an account?',
    type: 'choice', measures: 'Signup intent', options: LIKELIHOOD },
] as const;

export const SURVEY_TRACKS = {
  members: MEMBER_SURVEY,
  members_faithful: FAITHFUL_MEMBER_SURVEY,
} as const;

/** Which question group a tenant's portal shows. Anything else uses Central's. */
export const TENANT_SURVEY_TRACKS: Readonly<Record<string, SurveyTrack>> = {
  faithful: 'members_faithful',
  'central-henderson': 'members',
};
export type SurveyTrack = keyof typeof SURVEY_TRACKS;

export type ValidationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; path: string };

/** Total characters across all open-text answers, to bound a submission. */
export const MAX_TOTAL_TEXT = 4000;

/**
 * Every question is skippable. The pilot's own participant script says "You may
 * stop at any time or skip any question", so a missing answer is valid data —
 * a partial response is recorded rather than refused.
 */
export function validateAnswers(
  track: string,
  input: unknown,
): ValidationOutcome<Record<string, string | number>> {
  const questions = SURVEY_TRACKS[track as SurveyTrack];
  if (!questions) return { ok: false, error: `unknown track '${track}'`, path: 'track' };
  if (input === undefined || input === null) return { ok: true, value: Object.create(null) };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'answers must be an object', path: 'answers' };
  }

  const out: Record<string, string | number> = Object.create(null);
  let totalText = 0;

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    // Resolve to our own question object rather than reusing the caller's key,
    // so what gets written is never an attacker-influenced property name.
    const question = questions.find(q => q.key === key);
    if (!question) return { ok: false, error: `unknown question '${key}'`, path: `answers.${key}` };
    if (raw === null || raw === undefined || raw === '') continue;   // skipped

    if (question.type === 'likert5') {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { ok: false, error: `${key} must be a whole number from 1 to 5`, path: `answers.${key}` };
      }
      out[question.key] = n;
    } else if (question.type === 'choice') {
      if (typeof raw !== 'string' || !question.options?.includes(raw)) {
        return { ok: false, error: `${key} must be one of: ${question.options?.join(', ')}`, path: `answers.${key}` };
      }
      out[question.key] = raw;
    } else {
      if (typeof raw !== 'string') {
        return { ok: false, error: `${key} must be text`, path: `answers.${key}` };
      }
      const trimmed = raw.trim();
      if (trimmed === '') continue;
      const max = question.maxLength ?? 1000;
      if (trimmed.length > max) {
        return { ok: false, error: `${key} exceeds ${max} characters`, path: `answers.${key}` };
      }
      totalText += trimmed.length;
      out[question.key] = trimmed;
    }
  }

  if (totalText > MAX_TOTAL_TEXT) {
    return { ok: false, error: `answers exceed ${MAX_TOTAL_TEXT} characters`, path: 'answers' };
  }
  return { ok: true, value: out };
}

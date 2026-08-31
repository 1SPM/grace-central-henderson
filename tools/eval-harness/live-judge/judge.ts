/**
 * The live-judgment engine: runs a scenario against the REAL Ask GRACE
 * chat route (real prompt composition, real Claude call — nothing about
 * the model is mocked), then asks a second real Claude call to grade the
 * answer against the case's rubric.
 *
 * Reuses tools/eval-harness/fixtures/_shared-chat-harness.ts's mock-Clerk/
 * mock-Supabase plumbing (auth, conversation/message persistence, memory
 * retrieval) exactly as the deterministic tier does — the only difference
 * from a deterministic case is that `postToChat` is given the REAL global
 * `fetch` instead of a mocked one, so the outbound call actually reaches
 * Anthropic's API.
 */
import { FIXTURE_CHURCH_ID } from '../../../tests/fixtures/shared-platform.js';
import { buildDataContext } from '../../../src/contexts/GraceChatContext.js';
import { postToChat, supabaseFor } from '../fixtures/_shared-chat-harness.js';
import { callClaude, DEFAULT_CLAUDE_MODEL } from '../../../api/_lib/ai/adapters/claude.js';
import type { LiveJudgeCase, LiveJudgeResult } from './types.js';

const JUDGE_SYSTEM_PROMPT = `You are grading a church CRM AI assistant's reply for an internal test suite. You will receive a RUBRIC describing what a correct reply must do, and the assistant's ACTUAL REPLY. Grade strictly against the rubric only — do not reward style, warmth, or length beyond what the rubric asks for. Respond with ONLY a JSON object, no other text: {"verdict":"pass"|"fail","reasoning":"one or two sentences"}`;

function judgePrompt(rubric: string, question: string, modelAnswer: string): string {
  return `RUBRIC:\n${rubric}\n\nQUESTION ASKED:\n${question}\n\nASSISTANT'S ACTUAL REPLY:\n${modelAnswer}\n\nDoes the reply satisfy the rubric? Respond with the JSON object only.`;
}

function parseVerdict(text: string): { verdict: 'pass' | 'fail'; reasoning: string } | null {
  try {
    // The judge is instructed to return only JSON, but strip any stray
    // fencing/prose defensively rather than trusting instruction-following.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { verdict?: string; reasoning?: string };
    if (parsed.verdict !== 'pass' && parsed.verdict !== 'fail') return null;
    return { verdict: parsed.verdict, reasoning: parsed.reasoning ?? '' };
  } catch {
    return null;
  }
}

export async function runLiveJudgeCase(c: LiveJudgeCase): Promise<LiveJudgeResult> {
  const base = { id: c.id, fixture: c.fixture, domain: c.domain, level: c.level, advisory: true as const };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ...base, verdict: 'skipped', detail: 'ANTHROPIC_API_KEY not set — run with `tsx --env-file=.env.local` or export it first.' };
  }

  const dataContext = buildDataContext(c.scenarioData);

  let modelAnswer: string;
  try {
    const supabase = supabaseFor({});
    // The real, unmocked global fetch — this is what makes the call reach
    // Anthropic's API for real. Everything else (Clerk, Supabase) stays
    // mocked, same as every deterministic case. postToChat replaces
    // global.fetch and calls the real handler, which writes plain-text
    // chunks via res.write — reconstruct the full reply from those.
    const res = await postToChat(supabase, { message: c.question, dataContext }, fetch, FIXTURE_CHURCH_ID, apiKey);
    modelAnswer = res.written.join('');
    if (!modelAnswer.trim()) {
      const statusCalls = (res.status as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const jsonCalls = (res.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const errorBody = jsonCalls.at(-1)?.[0];
      return { ...base, verdict: 'error', detail: `chat route returned no streamed text (status ${statusCalls.at(-1)?.[0] ?? 'none'}): ${JSON.stringify(errorBody)}` };
    }
  } catch (err) {
    return { ...base, verdict: 'error', detail: `chat route threw: ${err instanceof Error ? err.message : String(err)}` };
  }

  const judgeResult = await callClaude({
    apiKey,
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
    model: DEFAULT_CLAUDE_MODEL,
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    prompt: judgePrompt(c.rubric, c.question, modelAnswer),
    maxTokens: 300,
    temperature: 0,
  });

  if (!judgeResult.success) {
    return { ...base, verdict: 'error', modelAnswer, detail: `judge call failed: ${judgeResult.error}` };
  }

  const parsed = parseVerdict(judgeResult.text ?? '');
  if (!parsed) {
    return { ...base, verdict: 'error', modelAnswer, detail: `judge did not return parseable verdict JSON: ${(judgeResult.text ?? '').slice(0, 200)}` };
  }

  return { ...base, verdict: parsed.verdict, modelAnswer, judgeReasoning: parsed.reasoning };
}

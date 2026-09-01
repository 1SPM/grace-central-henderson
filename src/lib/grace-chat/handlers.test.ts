/**
 * ADR-018 action-resolution safety closure — regression tests proving
 * every action handler that resolves a person/task/prayer fails CLOSED on
 * ambiguity, before any other check (including approval routing), and
 * that add_task no longer fabricates a title. Complements
 * src/lib/grace-actions.test.ts's ambiguity-DETECTION tests (does
 * hydrateAction correctly flag a collision) with ambiguity-ENFORCEMENT
 * tests (does the handler actually refuse to proceed).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runActionHandler, type HandlerContext, type ChatHandlers } from './handlers';
import type { PendingAction } from '../grace-actions';
import type { Person, Task, PrayerRequest } from '../../types';

const sarah: Person = { id: 'p1', firstName: 'Sarah', lastName: 'Kim', email: 'sarah@x.com', phone: '555-0001', status: 'member', tags: [], smallGroups: [] };
const sarahLopez: Person = { id: 'p3', firstName: 'Sarah', lastName: 'Lopez', email: 'sarahl@x.com', phone: '555-0003', status: 'member', tags: [], smallGroups: [] };
const people: Person[] = [sarah, sarahLopez];
const tasks: Task[] = [];
const prayers: PrayerRequest[] = [];

function makeCtx(action: PendingAction, handlerOverrides: Partial<ChatHandlers> = {}): { ctx: HandlerContext; handlers: ChatHandlers; pushed: string[] } {
  const pushed: string[] = [];
  const handlers: ChatHandlers = {
    onAddTask: vi.fn(), onAddPrayer: vi.fn(), onAddInteraction: vi.fn(), onAddPerson: vi.fn(), onAddEvent: vi.fn(),
    onToggleTask: vi.fn(), onUpdateTask: vi.fn(), onDeleteTask: vi.fn(), onDeletePerson: vi.fn(), onDeletePrayer: vi.fn(),
    onUpdatePersonStatus: vi.fn(), onMarkPrayerAnswered: vi.fn(),
    ...handlerOverrides,
  };
  const ctx: HandlerContext = {
    action, people, tasks, prayers, handlers,
    replyContext: null, setReplyContext: vi.fn(),
    pushAssistantMessage: (content: string) => { pushed.push(content); },
  };
  return { ctx, handlers, pushed };
}

// Every handler below that reaches the network (delete_person, delete_task,
// delete_prayer, send_sms, send_email) must not do so when blocked — assert
// fetch was never called, which is the concrete proof that "approval status
// is irrelevant until ambiguity has been resolved": the request never even
// reaches the propose/execute endpoint.
let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn();
  global.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  vi.restoreAllMocks();
});

const AMBIGUOUS_PERSON = { personAmbiguous: true as const, personName: 'Sarah', personCandidates: ['Sarah Kim', 'Sarah Lopez'] };
const AMBIGUOUS_TASK = { taskAmbiguous: true as const, taskTitle: 'Follow up', taskCandidates: ['Follow up', 'Follow up'] };
const AMBIGUOUS_PRAYER = { prayerAmbiguous: true as const };

describe('blockOnAmbiguity — every action using resolvePerson fails closed on a real name collision', () => {
  const personResolvingActions: Array<{ type: PendingAction['type']; extra?: Partial<PendingAction> }> = [
    { type: 'add_task' },
    { type: 'add_prayer', extra: { content: 'pray for x' } },
    { type: 'add_note', extra: { content: 'note' } },
    { type: 'delete_person' },
    { type: 'update_person_status', extra: { status: 'member' } },
    { type: 'send_email', extra: { subject: 'x', body: 'y' } },
    { type: 'send_sms', extra: { message: 'z' } },
  ];

  for (const { type, extra } of personResolvingActions) {
    it(`${type} refuses to proceed when personAmbiguous is set, and asks which person rather than guessing`, async () => {
      const action: PendingAction = { type, title: 'x', ...AMBIGUOUS_PERSON, ...extra };
      const { ctx, handlers, pushed } = makeCtx(action);
      const ran = await runActionHandler(ctx);
      expect(ran).toBe(false);
      expect(pushed.join(' ')).toMatch(/more than one person/i);
      expect(pushed.join(' ')).toContain('Sarah Kim');
      expect(pushed.join(' ')).toContain('Sarah Lopez');
      // No mutation callback and no network call happened.
      expect(handlers.onAddTask).not.toHaveBeenCalled();
      expect(handlers.onAddPrayer).not.toHaveBeenCalled();
      expect(handlers.onAddInteraction).not.toHaveBeenCalled();
      expect(handlers.onUpdatePersonStatus).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});

describe('blockOnAmbiguity — task-resolving actions fail closed on a real task-title collision', () => {
  const taskResolvingActions: PendingAction['type'][] = ['mark_task_done', 'update_task', 'delete_task'];

  for (const type of taskResolvingActions) {
    it(`${type} refuses to proceed when taskAmbiguous is set`, async () => {
      const action: PendingAction = { type, title: 'new title', ...AMBIGUOUS_TASK };
      const { ctx, handlers, pushed } = makeCtx(action);
      const ran = await runActionHandler(ctx);
      expect(ran).toBe(false);
      expect(pushed.join(' ')).toMatch(/more than one open task/i);
      expect(handlers.onToggleTask).not.toHaveBeenCalled();
      expect(handlers.onUpdateTask).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});

describe('blockOnAmbiguity — prayer-resolving actions fail closed on a real active-prayer collision, without leaking prayer content', () => {
  const prayerResolvingActions: PendingAction['type'][] = ['mark_prayer_answered', 'delete_prayer'];

  for (const type of prayerResolvingActions) {
    it(`${type} refuses to proceed when prayerAmbiguous is set`, async () => {
      const action: PendingAction = { type, ...AMBIGUOUS_PRAYER };
      const { ctx, handlers, pushed } = makeCtx(action);
      const ran = await runActionHandler(ctx);
      expect(ran).toBe(false);
      expect(pushed.join(' ')).toMatch(/more than one active prayer/i);
      expect(handlers.onMarkPrayerAnswered).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});

describe('approval status is irrelevant until target ambiguity has been resolved (the critical case)', () => {
  it('delete_person — an approval-GATED, destructive action — never reaches the approvals endpoint while ambiguous, regardless of how much other information is present', async () => {
    const action: PendingAction = { type: 'delete_person', ...AMBIGUOUS_PERSON };
    const { ctx, pushed } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(false);
    // The single most important assertion in this suite: /api/actions/propose
    // (the approval-queue endpoint) is never called. Ambiguity is checked
    // and refused BEFORE the function that would route to approval is ever
    // invoked — approval readiness is simply never evaluated.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(pushed.join(' ')).toMatch(/more than one person/i);
  });

  it('once uniquely resolved (personId set, no ambiguity), delete_person proceeds to the real approval flow', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ status: 'pending' }) });
    const action: PendingAction = { type: 'delete_person', personId: 'p1', personName: 'Sarah Kim' };
    const { ctx, pushed } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/actions/propose');
    expect(pushed.join(' ')).toMatch(/needs approval/i);
  });
});

describe('add_task no longer fabricates a title ("Untitled task" fallback removed)', () => {
  it('refuses and asks for a title when none is provided', async () => {
    const action: PendingAction = { type: 'add_task' };
    const { ctx, handlers, pushed } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(false);
    expect(handlers.onAddTask).not.toHaveBeenCalled();
    expect(pushed.join(' ')).toMatch(/needs a title/i);
  });

  it('refuses on a whitespace-only title too', async () => {
    const action: PendingAction = { type: 'add_task', title: '   ' };
    const { ctx, handlers } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(false);
    expect(handlers.onAddTask).not.toHaveBeenCalled();
  });

  it('proceeds normally, with the real title, once one is provided', async () => {
    const action: PendingAction = { type: 'add_task', title: 'Call the Nguyens' };
    const { ctx, handlers } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(true);
    expect(handlers.onAddTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Call the Nguyens' }));
  });
});

describe('non-ambiguous, fully-parameterized actions are not over-blocked', () => {
  it('add_note with a uniquely-resolved person proceeds normally', async () => {
    const action: PendingAction = { type: 'add_note', personId: 'p1', content: 'Followed up today' };
    const { ctx, handlers } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(true);
    expect(handlers.onAddInteraction).toHaveBeenCalledWith(expect.objectContaining({ personId: 'p1', content: 'Followed up today' }));
  });

  it('mark_task_done with a uniquely-resolved task proceeds normally', async () => {
    const action: PendingAction = { type: 'mark_task_done', taskId: 't1', taskTitle: 'Real task' };
    const { ctx, handlers } = makeCtx(action);
    const ran = await runActionHandler(ctx);
    expect(ran).toBe(true);
    expect(handlers.onToggleTask).toHaveBeenCalledWith('t1');
  });
});

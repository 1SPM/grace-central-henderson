import { useState } from 'react';
import { CheckCircle2, Circle, Plus, BookMarked } from 'lucide-react';
import { usePortalJourney } from '../hooks/usePortalJourney';

export function PortalJourney() {
  const { data, isLoading, error, addGoal, setItemStatus } = usePortalJourney();
  const [goalTitle, setGoalTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    setIsAdding(true);
    try {
      await addGoal(goalTitle.trim());
      setGoalTitle('');
    } finally {
      setIsAdding(false);
    }
  }

  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>;
  if (isLoading || !data) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-stone-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">My Journey</h1>
        <p className="text-sm text-stone-500 mt-1">Your own next steps, at your own pace.</p>
      </div>

      <section aria-labelledby="portal-journey-onboarding" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-journey-onboarding" className="text-sm font-semibold text-stone-900 mb-3">Getting started</h2>
        <ul className="space-y-2.5" data-testid="onboarding-steps">
          {data.onboarding.steps.map(step => (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              {step.completed ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <Circle size={18} className="text-stone-300 shrink-0" />}
              <span className={step.completed ? 'text-stone-400 line-through' : 'text-stone-700'}>{step.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.membership_track && (
        <section aria-labelledby="portal-journey-membership" className="rounded-2xl border border-stone-200 bg-white p-4" data-testid="membership-track-card">
          <h2 id="portal-journey-membership" className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
            {data.membership_track.label}
            {data.membership_track.is_complete && <CheckCircle2 size={16} className="text-emerald-500" />}
          </h2>
          <p className="text-sm text-stone-500">
            {data.membership_track.is_complete
              ? "You've completed every step in this track."
              : `${data.membership_track.completed_count} of ${data.membership_track.required_count} steps complete.`}
          </p>
        </section>
      )}

      <section aria-labelledby="portal-journey-goals" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-journey-goals" className="text-sm font-semibold text-stone-900 mb-3">Your goals</h2>
        {data.goals.length === 0 ? (
          <p className="text-sm text-stone-400 mb-3">You haven't added a goal yet.</p>
        ) : (
          <ul className="space-y-2 mb-3" data-testid="journey-goals">
            {data.goals.map(g => (
              <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                <button onClick={() => void setItemStatus(g.id, g.status === 'completed' ? 'active' : 'completed')} className="flex items-center gap-2 text-left flex-1">
                  {g.status === 'completed' ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <Circle size={16} className="text-stone-300 shrink-0" />}
                  <span className={g.status === 'completed' ? 'text-stone-400 line-through' : 'text-stone-700'}>{g.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAddGoal} className="flex gap-2">
          <label htmlFor="new-goal" className="sr-only">Add a goal</label>
          <input
            id="new-goal"
            value={goalTitle}
            onChange={e => setGoalTitle(e.target.value)}
            placeholder="Add a goal…"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={isAdding || !goalTitle.trim()} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </form>
      </section>

      {data.saved_resources.length > 0 && (
        <section aria-labelledby="portal-journey-resources" className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 id="portal-journey-resources" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><BookMarked size={16} /> Saved resources</h2>
          <ul className="space-y-2">
            {data.saved_resources.map(r => (
              <li key={r.id} className="text-sm text-stone-700">{r.title}</li>
            ))}
          </ul>
        </section>
      )}

      {data.completed_milestones.length > 0 && (
        <section aria-labelledby="portal-journey-milestones" className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 id="portal-journey-milestones" className="text-sm font-semibold text-stone-900 mb-3">Completed steps</h2>
          <ul className="space-y-1.5 text-sm text-stone-600">
            {data.completed_milestones.map(m => (
              <li key={m.milestone_type} className="capitalize">{m.milestone_type.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

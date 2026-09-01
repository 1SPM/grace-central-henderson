import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';
import type { CalendarEvent, Person, Task } from '../../../types';
import { deriveSundayReadiness } from '../../../lib/mobileAttention';

function person(overrides: Partial<Person>): Person {
  return {
    id: 'p1',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: '',
    phone: '',
    status: 'member',
    tags: [],
    smallGroups: [],
    ...overrides,
  };
}

const isoToday = new Date().toISOString().slice(0, 10);

function followUpTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    personId: 'p1',
    title: 'Prayer request',
    dueDate: isoToday,
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ...overrides,
  };
}

const sundayService: CalendarEvent = {
  id: 'svc',
  title: 'Sunday Service',
  startDate: (() => {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  })(),
  allDay: false,
  category: 'service',
};

describe('HomeScreen', () => {
  const baseProps = {
    userName: 'Sean McKay',
    people: [person({})],
    tasks: [followUpTask()],
    prayers: [],
    mergedEvents: [sundayService],
    readiness: deriveSundayReadiness([followUpTask()], [sundayService]),
    onNavigate: vi.fn(),
    onOpenGrace: vi.fn(),
  };

  it('greets by first name with a time-of-day salutation', () => {
    render(<HomeScreen {...baseProps} />);
    expect(screen.getByText(/Good (morning|afternoon|evening), Sean\./)).toBeInTheDocument();
  });

  it('surfaces the follow-up person in Today', () => {
    render(<HomeScreen {...baseProps} />);
    expect(screen.getByText(/Sarah Mitchell needs follow-up/)).toBeInTheDocument();
    expect(screen.getByText(/Prayer request · 2 days ago/)).toBeInTheDocument();
  });

  it('never renders a percentage when readiness is qualitative', () => {
    render(<HomeScreen {...baseProps} />);
    // One tracked task < threshold of 3 → qualitative, no % anywhere.
    expect(baseProps.readiness.kind).toBe('qualitative');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows honest empty states with no data', () => {
    render(
      <HomeScreen
        {...baseProps}
        people={[]}
        tasks={[]}
        mergedEvents={[]}
        readiness={deriveSundayReadiness([], [])}
      />,
    );
    expect(screen.getByText('Nothing needs attention right now.')).toBeInTheDocument();
    expect(screen.getByText('No other events this week.')).toBeInTheDocument();
  });

  it('opens Grace listening from Talk to Grace', () => {
    render(<HomeScreen {...baseProps} />);
    screen.getByText('Talk to Grace').click();
    expect(baseProps.onOpenGrace).toHaveBeenCalledWith(undefined, { listen: true });
  });
});

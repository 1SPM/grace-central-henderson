import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance } from '../../types';
import type { PendingAction } from '../grace-actions';

export interface ActionInstance {
  id: string;
  action: PendingAction;
  executed?: boolean;
  dismissed?: boolean;
}

export interface GraceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionInstance[];
}

export interface GraceData {
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  attendance: Attendance[];
  churchName?: string;
}

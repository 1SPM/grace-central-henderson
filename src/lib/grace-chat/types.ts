import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance } from '../../types';
import type { ChurchProfile } from '../../hooks/useChurchSettings';
import type { User } from '../services/auth';
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
  churchId?: string;
  churchProfile?: ChurchProfile;
  graceFacts?: string;
  userFirstName?: string;
  userRole?: User['role'];
  /** IANA timezone for salutation clock (e.g. America/Los_Angeles). */
  churchTimezone?: string;
}

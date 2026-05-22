/* Write callbacks the redesign screens use. Implemented by App.tsx via the
   existing church-scoped useAppHandlers, so writes persist exactly like the
   classic app. */
export type InteractionType = 'note' | 'call' | 'email' | 'visit' | 'text' | 'prayer';
export type AttendanceEventType = 'sunday' | 'wednesday' | 'small-group' | 'special';
export type RedesignEventCategory = 'service' | 'meeting' | 'event' | 'small-group' | 'class' | 'outreach' | 'other';

export interface RedesignActions {
  checkIn: (personId: string, eventType: AttendanceEventType) => void | Promise<unknown>;
  addInteraction: (i: { personId: string; type: InteractionType; content: string; createdBy: string }) => void | Promise<unknown>;
  addPrayer: (p: { personId: string; content: string; isPrivate: boolean }) => void | Promise<unknown>;
  addEvent: (e: { title: string; startDate: string; allDay: boolean; location?: string; category: RedesignEventCategory; description?: string }) => void | Promise<unknown>;
}

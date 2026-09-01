import { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import type { CalendarEvent } from '../../../types';
import { MobileCardRow } from './MobileCard';
import { IconChip } from './IconChip';
import { eventDateLabel } from './mobileFormat';

export function EventRow({
  event,
  onClick,
  trailing,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <MobileCardRow
      icon={
        <IconChip tone="violet">
          <CalendarDays size={17} />
        </IconChip>
      }
      title={event.title}
      detail={eventDateLabel(event.startDate, event.allDay)}
      trailing={trailing}
      chevron={!!onClick}
      onClick={onClick}
    />
  );
}

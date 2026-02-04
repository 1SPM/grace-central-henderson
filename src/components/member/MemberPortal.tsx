import { useState } from 'react';
import { MemberLayout } from './MemberLayout';
import { MemberHomePage } from './MemberHomePage';
import { MemberDirectoryPage } from './MemberDirectoryPage';
import { MemberGivingPage } from './MemberGivingPage';
import { MemberEventsPage } from './MemberEventsPage';
import { MemberCheckInPage } from './MemberCheckInPage';
import { MemberShopPage } from './MemberShopPage';
import type { MemberPortalTab, Person, CalendarEvent, Giving, Attendance } from '../../types';
import type { ChurchProfile } from '../../hooks/useChurchSettings';

interface MemberPortalProps {
  people: Person[];
  events: CalendarEvent[];
  giving: Giving[];
  attendance: Attendance[];
  rsvps: { eventId: string; personId: string; status: 'yes' | 'no' | 'maybe'; guestCount: number }[];
  currentMember?: Person | null;
  churchName?: string;
  churchProfile?: ChurchProfile;
  onBack?: () => void;
  onRSVP?: (eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount?: number) => void;
  onCheckIn?: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
}

export function MemberPortal({
  people,
  events,
  giving,
  attendance,
  rsvps,
  currentMember,
  churchName = 'Grace Church',
  churchProfile,
  onBack,
  onRSVP,
  onCheckIn
}: MemberPortalProps) {
  const [activeTab, setActiveTab] = useState<MemberPortalTab>('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <MemberHomePage
            churchName={churchName}
            churchProfile={churchProfile}
            events={events}
            onNavigate={setActiveTab}
          />
        );

      case 'directory':
        return <MemberDirectoryPage people={people} />;

      case 'giving':
        return (
          <MemberGivingPage
            giving={giving}
            personId={currentMember?.id}
            churchName={churchName}
          />
        );

      case 'events':
        return (
          <MemberEventsPage
            events={events}
            rsvps={rsvps}
            personId={currentMember?.id}
            onRSVP={onRSVP}
          />
        );

      case 'checkin':
        return (
          <MemberCheckInPage
            events={events}
            attendance={attendance}
            personId={currentMember?.id}
            personName={currentMember ? `${currentMember.firstName}` : undefined}
            onCheckIn={onCheckIn}
          />
        );

      case 'shop':
        return (
          <MemberShopPage
            churchName={churchName}
            personId={currentMember?.id}
          />
        );

      default:
        return (
          <MemberHomePage
            churchName={churchName}
            churchProfile={churchProfile}
            events={events}
            onNavigate={setActiveTab}
          />
        );
    }
  };

  return (
    <MemberLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onBack={onBack}
      churchName={churchName}
    >
      {renderContent()}
    </MemberLayout>
  );
}

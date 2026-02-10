import { useState, useEffect } from 'react';
import { MemberLayout } from './MemberLayout';
import { MemberHomePage } from './MemberHomePage';
import { MemberDirectoryPage } from './MemberDirectoryPage';
import { MemberGivingPage } from './MemberGivingPage';
import { MemberEventsPage } from './MemberEventsPage';
import { MemberCheckInPage } from './MemberCheckInPage';
import { PastorSignupPage } from './PastorSignupPage';
import { MemberShopPage } from './MemberShopPage';
import { MemberLegacyPage } from './MemberLegacyPage';
import type { MemberPortalTab, Person, CalendarEvent, Giving, Attendance } from '../../types';
import type { ChurchProfile } from '../../hooks/useChurchSettings';
import type { LeaderFormData } from '../pastoral/LeaderRegistrationForm';

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
  onPastorSignup?: (data: LeaderFormData) => void;
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
  onCheckIn,
  onPastorSignup
}: MemberPortalProps) {
  const [activeTab, setActiveTab] = useState<MemberPortalTab>('home');

  // Handle deep link from ?portal=pastor-signup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'pastor-signup') {
      setActiveTab('pastor-signup');
    }
  }, []);

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

      case 'pastor-signup':
        return (
          <PastorSignupPage
            churchName={churchName}
            onSubmit={onPastorSignup}
            onBack={() => setActiveTab('home')}
          />
        );

      case 'shop':
        return (
          <MemberShopPage
            churchName={churchName}
            personId={currentMember?.id}
          />
        );

      case 'legacy':
        return (
          <MemberLegacyPage
            churchName={churchName}
            personId={currentMember?.id}
            personName={currentMember ? `${currentMember.firstName} ${currentMember.lastName}` : undefined}
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

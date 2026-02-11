import { useState, useEffect, useCallback } from 'react';
import { MemberLayout } from './MemberLayout';
import { MemberHomePage } from './MemberHomePage';
import { MemberDirectoryPage } from './MemberDirectoryPage';
import { MemberGivingPage } from './MemberGivingPage';
import { MemberEventsPage } from './MemberEventsPage';
import { MemberCheckInPage } from './MemberCheckInPage';
import { PastorSignupPage } from './PastorSignupPage';
import { MemberShopPage } from './MemberShopPage';
import { MemberLegacyPage } from './MemberLegacyPage';
import { MyMinistryPage } from './MyMinistryPage';
import { MemberCarePage } from './MemberCarePage';
import { DEMO_LEADERS } from './demoLeaders';
import type { MemberPortalTab, Person, CalendarEvent, Giving, Attendance, HelpCategory, LeaderProfile, PastoralConversation } from '../../types';
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
  onCreateHelpRequest?: (request: { category: HelpCategory; description?: string; isAnonymous: boolean; leaderId?: string }) => void;
  leaders?: LeaderProfile[];
  conversations?: PastoralConversation[];
  activeConversation?: PastoralConversation;
  onSendMessage?: (conversationId: string, content: string) => void;
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
  onPastorSignup,
  onCreateHelpRequest,
  leaders = DEMO_LEADERS,
  conversations = [],
  activeConversation,
  onSendMessage,
}: MemberPortalProps) {
  const [activeTab, setActiveTab] = useState<MemberPortalTab>('home');
  const [showChat, setShowChat] = useState(false);

  // Handle deep links from ?portal=pastor-signup or ?portal=care
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portal = params.get('portal');
    if (portal === 'pastor-signup') {
      setActiveTab('pastor-signup');
    } else if (portal === 'care') {
      setActiveTab('care');
    }
  }, []);

  const handleTabChange = useCallback((tab: MemberPortalTab, leaderId?: string) => {
    setActiveTab(tab);
    if (tab === 'care' && leaderId) {
      // Check for existing active conversation with this leader
      const existingConv = conversations.find(
        c => c.leaderId === leaderId && c.status === 'active'
      );
      if (existingConv) {
        setShowChat(true);
      } else {
        // Create a new help request assigned to this specific leader
        onCreateHelpRequest?.({ category: 'general', isAnonymous: false, leaderId });
        setShowChat(true);
      }
    } else {
      setShowChat(false);
    }
  }, [conversations, onCreateHelpRequest]);

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

      case 'care':
        return (
          <MemberCarePage
            leaders={leaders}
            onCreateHelpRequest={onCreateHelpRequest}
            onNavigate={(tab) => handleTabChange(tab)}
            churchName={churchName}
            conversations={conversations}
            activeConversation={activeConversation}
            onSendMessage={onSendMessage}
            showChat={showChat}
            onCloseChat={() => setShowChat(false)}
          />
        );

      case 'my-ministry':
        return (
          <MyMinistryPage />
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
      onTabChange={handleTabChange}
      onBack={onBack}
      churchName={churchName}
      leaders={leaders}
    >
      {renderContent()}
    </MemberLayout>
  );
}

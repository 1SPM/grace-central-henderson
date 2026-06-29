import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense, type ReactNode } from 'react';
import type { View } from './types';
import { resolveAddressee } from './lib/greeting';
import { navigateView } from './lib/actionCenterNav';
import { isStaffRole } from './lib/services/auth';
import { useAuthContext, SignInPage } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { SetupChecklist } from './components/SetupChecklist';
import { PersonForm } from './components/PersonForm';
import { GlobalSearch } from './components/GlobalSearch';
import { QuickTaskForm } from './components/QuickTaskForm';
import { QuickPrayerForm } from './components/QuickPrayerForm';
import { QuickNote } from './components/QuickNote';
import { QuickDonationForm } from './components/QuickDonationForm';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { EmailSidebar } from './components/EmailSidebar';
import { ViewRenderer } from './components/ViewRenderer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AskGrace } from './components/AskGrace';
import { GraceChatProvider } from './contexts/GraceChatContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import { TutorialPickerModal } from './components/tutorial/TutorialPickerModal';
import { applyBrandingPrimaryColor } from './config/tenant';

// Lazy load GRACE Mobile (standalone staff-gated mobile CRM at /mobile)
const GraceMobile = lazy(() => import('./components/mobile/GraceMobile').then(m => ({ default: m.GraceMobile })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const PricingPage = lazy(() => import('./components/marketing/PricingPage').then(m => ({ default: m.PricingPage })));
const SignUpFlow = lazy(() => import('./components/marketing/SignUpFlow').then(m => ({ default: m.SignUpFlow })));
const CsvImportWizard = lazy(() => import('./components/import/CsvImportWizard').then(m => ({ default: m.CsvImportWizard })));
const GivingImportWizard = lazy(() => import('./components/import/GivingImportWizard').then(m => ({ default: m.GivingImportWizard })));
const LandingPage = lazy(() => import('./components/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const TermsPage = lazy(() => import('./components/marketing/LegalPages').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/marketing/LegalPages').then(m => ({ default: m.PrivacyPage })));
const DonatePage = lazy(() => import('./components/marketing/DonatePage').then(m => ({ default: m.DonatePage })));
const DonorPortalRequestPage = lazy(() => import('./components/marketing/DonorPortalRequestPage').then(m => ({ default: m.DonorPortalRequestPage })));
const WelcomePage = lazy(() => import('./components/marketing/WelcomePage').then(m => ({ default: m.WelcomePage })));
import { useSupabaseData } from './hooks/useSupabaseData';
import { useCollectionManagement } from './hooks/useCollectionManagement';
import { useCharityBaskets } from './hooks/useCharityBaskets';
import { useModals } from './hooks/useModals';
import { useAgents } from './hooks/useAgents';
import { useAppHandlers } from './hooks/useAppHandlers';
import { useChurchSettings } from './hooks/useChurchSettings';
import { usePastoralCare } from './hooks/usePastoralCare';
import { useAnnouncements } from './hooks/useAnnouncements';
import { useDiscipleship } from './hooks/useDiscipleship';
import { useHashRouter } from './hooks/useHashRouter';
import { RedesignApp } from './components/redesign/RedesignApp';
import { graceDataFromApp } from './components/redesign/graceDataFromApp';
import {
  toPersonLegacy,
  toTaskLegacy,
  toInteractionLegacy,
  toGroupLegacy,
  toPrayerLegacy,
  toEventLegacy,
  toGivingLegacy,
  toAttendanceLegacy,
} from './utils/typeConverters';
import { useTutorial } from './contexts/TutorialContext';
import { isDemoModeEnabled, navigateToDemoCrm } from './lib/demoEntry';

/** Bridges the App-level showTutorialPicker state to the TutorialContext (which must be inside TutorialProvider) */
function TutorialPickerAutoOpen({ show, onShown }: { show: boolean; onShown: () => void }) {
  const { openPicker } = useTutorial();
  useEffect(() => {
    if (show) {
      openPicker();
      onShown();
    }
  }, [show, openPicker, onShown]);
  return null;
}

function MarketingLoading({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">{label}</p>
      </div>
    </div>
  );
}

/** Demo mode — send /sign-in and /signup visitors straight into the CRM. */
function DemoCrmRedirect() {
  useEffect(() => {
    navigateToDemoCrm();
  }, []);
  return <MarketingLoading label="Loading demo…" />;
}

function App() {
  const { churchId, isSignedIn, isLoaded, user } = useAuthContext();
  const { view, setView, selectedPersonId, setSelectedPersonId } = useHashRouter();

  // Use Supabase data hook
  const {
    isLoading,
    isDemo,
    people: dbPeople,
    tasks: dbTasks,
    interactions: dbInteractions,
    groups: dbGroups,
    prayers: dbPrayers,
    events: dbEvents,
    giving: dbGiving,
    addPerson,
    updatePerson,
    deletePerson,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    addInteraction,
    addPrayer,
    markPrayerAnswered,
    deletePrayer,
    addGiving,
    createGroup,
    addGroupMember,
    removeGroupMember,
    addEvent,
    updateEvent,
    deleteEvent,
    attendance: dbAttendance,
    checkIn,
  } = useSupabaseData();

  // Convert to legacy types for existing components (memoized)
  const people = useMemo(() => dbPeople.map(p => {
    const person = toPersonLegacy(p);
    person.smallGroups = dbGroups.filter(g => g.members?.includes(p.id) ?? false).map(g => g.id);
    return person;
  }), [dbPeople, dbGroups]);

  const tasks = useMemo(() => dbTasks.map(toTaskLegacy), [dbTasks]);
  const interactions = useMemo(() => dbInteractions.map(toInteractionLegacy), [dbInteractions]);
  const groups = useMemo(() => dbGroups.map(toGroupLegacy), [dbGroups]);
  const prayers = useMemo(() => dbPrayers.map(toPrayerLegacy), [dbPrayers]);
  const events = useMemo(() => dbEvents.map(toEventLegacy), [dbEvents]);
  const giving = useMemo(() => dbGiving.map(toGivingLegacy), [dbGiving]);
  const attendanceFromDb = useMemo(() => dbAttendance.map(toAttendanceLegacy), [dbAttendance]);

  // Custom hooks for state management
  const modals = useModals();
  const collectionMgmt = useCollectionManagement(giving);
  const charityBasketMgmt = useCharityBaskets();
  const pastoralCare = usePastoralCare();
  const announcementData = useAnnouncements(churchId);
  const discipleshipData = useDiscipleship(people, churchId);
  const { settings: churchSettings, saveSettings: saveChurchSettings, saveProfile: saveChurchProfile, saveOnboarding, isLoading: settingsLoading } = useChurchSettings(churchId);
  const [showWizard, setShowWizard] = useState(false);
  const [showTutorialPicker, setShowTutorialPicker] = useState(false);

  useEffect(() => {
    applyBrandingPrimaryColor(churchSettings?.branding?.primaryColor);
  }, [churchSettings?.branding?.primaryColor]);

  const reopenWizard = useCallback(() => {
    setShowWizard(true);
  }, []);

  // Bridge: useAppHandlers is created before useAgents, so route status-change
  // events through a ref that the agents hook fills in below.
  const personStatusChangeRef = useRef<((personId: string, previousStatus: string, newStatus: string) => void) | null>(null);

  // App handlers
  const { attendanceRecords, rsvps, volunteerAssignments, handlers } = useAppHandlers({
    churchId,
    dbPeople,
    addPerson,
    updatePerson,
    addTask,
    toggleTask,
    addInteraction,
    addPrayer,
    markPrayerAnswered,
    addGiving,
    createGroup,
    addGroupMember,
    removeGroupMember,
    addEvent,
    updateEvent,
    deleteEvent,
    checkIn,
    setView,
    setSelectedPersonId,
    openPersonForm: modals.openPersonForm,
    closePersonForm: modals.closePersonForm,
    onPersonStatusChange: (personId, previousStatus, newStatus) =>
      personStatusChangeRef.current?.(personId, previousStatus, newStatus),
  });

  // Agent task creation callback
  const handleAgentCreateTask = useCallback(async (task: {
    personId: string;
    title: string;
    description?: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    category: 'follow-up' | 'care' | 'admin' | 'outreach';
    assignedTo?: string;
  }) => {
    await addTask({
      church_id: churchId,
      person_id: task.personId,
      title: task.title,
      description: task.description || null,
      due_date: task.dueDate,
      completed: false,
      priority: task.priority,
      category: task.category,
      assigned_to: task.assignedTo || null,
    });
  }, [addTask, churchId]);

  // Redesign landing (view === 'home') — real, church-scoped data adapted
  // into the redesign's shape. Reads only; writes route into the classic app.
  const redesignData = useMemo(() => graceDataFromApp({
    people, interactions, groups, prayers, events, giving,
    attendance: [...attendanceFromDb, ...attendanceRecords],
    churchName: churchSettings?.profile?.name,
  }), [people, interactions, groups, prayers, events, giving, attendanceFromDb, attendanceRecords, churchSettings]);

  // AI Agents hook
  const agents = useAgents({
    churchId,
    churchName: churchSettings?.profile?.name || 'Grace Church',
    people: people.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      birthDate: p.birthDate,
      joinDate: p.joinDate,
      status: p.status,
    })),
    giving: giving.map(g => ({
      id: g.id,
      personId: g.personId,
      amount: g.amount,
      fund: g.fund,
      date: g.date,
      method: g.method,
      isRecurring: g.isRecurring,
    })),
    onCreateTask: handleAgentCreateTask,
  });

  // When a person becomes a member, kick off the New Member welcome sequence.
  const agentHandleNewMember = agents.handleNewMember;
  useEffect(() => {
    personStatusChangeRef.current = (personId, previousStatus, newStatus) => {
      void agentHandleNewMember(personId, previousStatus, newStatus);
    };
    return () => { personStatusChangeRef.current = null; };
  }, [agentHandleNewMember]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); modals.openPersonForm(); break;
        case 't': e.preventDefault(); modals.openQuickTask(); break;
        case 'p': e.preventDefault(); modals.openQuickPrayer(); break;
        case 'm': e.preventDefault(); modals.openQuickNote(); break;
        case 'd': e.preventDefault(); modals.openQuickDonation(); break;
        case 'e': e.preventDefault(); modals.openEmailSidebar(); break;
        case '/': e.preventDefault(); modals.openSearch(); break;
        case 'escape': modals.closeAll(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals]);

  // Memoize person lookup
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const selectedPerson = selectedPersonId ? personMap.get(selectedPersonId) : undefined;

  // Check if we're accessing the standalone GRACE Mobile app (staff-gated)
  const isMobileRoute = window.location.pathname === '/mobile' || window.location.hash === '#mobile';

  // Signed-in staff identity, shown in the GRACE Mobile header.
  const mobileUserName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined;
  const mobileRoleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : undefined;

  // Renders an admin View. Shared by the classic shell and the GRACE Mobile
  // preview/route (so curated mobile tabs reuse the same hub components).
  // `renderMobileView` is threaded back in so the preview can embed live hubs.
  function renderAdminView(v: View, sv: (next: View) => void): ReactNode {
    return (
      <ViewRenderer
        view={v}
        setView={sv}
        churchId={churchId}
        people={people}
        tasks={tasks}
        interactions={interactions}
        groups={groups}
        prayers={prayers}
        events={events}
        giving={giving}
        attendanceRecords={[...attendanceFromDb, ...attendanceRecords]}
        rsvps={rsvps}
        volunteerAssignments={volunteerAssignments}
        selectedPerson={selectedPerson}
        selectedPersonId={selectedPersonId}
        setSelectedPersonId={setSelectedPersonId}
        handlers={handlers}
        collectionMgmt={collectionMgmt}
        charityBasketMgmt={charityBasketMgmt}
        agents={agents}
        announcementData={announcementData}
        discipleshipData={discipleshipData}
        pastoralCare={pastoralCare}
        onOpenEmailSidebar={modals.openEmailSidebar}
        onReopenWizard={reopenWizard}
        userName={mobileUserName}
        roleLabel={mobileRoleLabel}
        renderMobileView={renderAdminView}
      />
    );
  }

  // Public marketing routes — flagged early; rendered after all hooks
  // run (below) to satisfy rules-of-hooks. The marketing pages don't
  // depend on church data so the hook outputs are simply discarded.
  const path = window.location.pathname;
  const isPricingRoute = path === '/pricing';
  const isSignUpRoute = path === '/signup' || path.startsWith('/signup/');
  const isImportRoute = path === '/import' || path === '/import/people';
  const isGivingImportRoute = path === '/import/giving';
  const isWelcomeRoute = path === '/welcome';
  const isTermsRoute = path === '/terms' || path === '/terms-of-service';
  const isPrivacyRoute = path === '/privacy' || path === '/privacy-policy';
  const isSignInRoute = path === '/sign-in';
  const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  // Root should resolve to the app shell so the deployed home page shows the dashboard.
  const isLandingRoute = false;
  // /give/<church-slug> is a public donation page — no auth.
  const donateSlugMatch = path.match(/^\/give\/([a-z0-9-]+)\/?$/);
  const isDonateRoute = !!donateSlugMatch;
  const donateSlug = donateSlugMatch?.[1] ?? null;
  // /give/<slug>/manage — donor magic-link request page
  const manageSlugMatch = path.match(/^\/give\/([a-z0-9-]+)\/manage\/?$/);
  const isManageRoute = !!manageSlugMatch;
  const manageSlug = manageSlugMatch?.[1] ?? null;

  // Show onboarding wizard for first-time users
  // Auto-open onboarding wizard is disabled — still reachable via Settings → Run Setup Wizard
  // useEffect(() => {
  //   if (!settingsLoading && !isPortalRoute && churchSettings &&
  //       !churchSettings.onboarding?.wizardCompleted &&
  //       !churchSettings.onboarding?.wizardDismissed) {
  //     setShowWizard(true);
  //   }
  // }, [settingsLoading, isPortalRoute, churchSettings]);

  // Show tutorial picker after wizard completion (one-time)
  useEffect(() => {
    if (!settingsLoading && !isMobileRoute && churchSettings &&
        churchSettings.onboarding?.wizardCompleted &&
        !churchSettings.onboarding?.tutorialPickerShown &&
        !showWizard) {
      setShowTutorialPicker(true);
    }
  }, [settingsLoading, isMobileRoute, churchSettings, showWizard]);

  if (isPricingRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading pricing…" />}>
        <PricingPage />
      </Suspense>
    );
  }

  if (isSignUpRoute) {
    if (isDemoModeEnabled) {
      return <DemoCrmRedirect />;
    }
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    const initialPlan: 'starter' | 'pro' | 'enterprise' =
      planParam === 'starter' || planParam === 'pro' || planParam === 'enterprise' ? planParam : 'pro';
    return (
      <Suspense fallback={<MarketingLoading label="Loading sign-up…" />}>
        <SignUpFlow initialPlan={initialPlan} />
      </Suspense>
    );
  }

  if (isImportRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading import…" />}>
        <CsvImportWizard />
      </Suspense>
    );
  }

  if (isGivingImportRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading giving import…" />}>
        <GivingImportWizard />
      </Suspense>
    );
  }

  if (isWelcomeRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Welcome to GRACE…" />}>
        <WelcomePage />
      </Suspense>
    );
  }

  if (isTermsRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading terms…" />}>
        <TermsPage />
      </Suspense>
    );
  }

  if (isPrivacyRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading privacy policy…" />}>
        <PrivacyPage />
      </Suspense>
    );
  }

  if (isSignInRoute) {
    if (isDemoModeEnabled || !isClerkConfigured) {
      return <DemoCrmRedirect />;
    }
    return <SignInPage />;
  }

  if (isLandingRoute) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading…" />}>
        <LandingPage />
      </Suspense>
    );
  }

  if (isDonateRoute && donateSlug) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading donation page…" />}>
        <DonatePage churchSlug={donateSlug} />
      </Suspense>
    );
  }

  if (isManageRoute && manageSlug) {
    return (
      <Suspense fallback={<MarketingLoading label="Loading…" />}>
        <DonorPortalRequestPage churchSlug={manageSlug} />
      </Suspense>
    );
  }

  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {isMobileRoute ? 'Loading GRACE Mobile...' : 'Loading GRACE CRM...'}
          </p>
        </div>
      </div>
    );
  }

  // Standalone GRACE Mobile (no admin sidebar/layout, staff-gated)
  if (isMobileRoute) {
    const churchName = churchSettings?.profile?.name || 'GRACE';
    const branding = churchSettings?.branding;

    // Staff must sign in when real auth is configured. Demo mode keeps it open.
    if (isClerkConfigured && !isSignedIn) {
      return <SignInPage />;
    }

    // Only back-end staff roles (admin/pastor/staff) may use GRACE Mobile.
    if (isSignedIn && user && !isStaffRole(user.role)) {
      return (
        <div className="h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-dark-100 mb-2">
              Staff access required
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-400">
              GRACE Mobile is the back-end CRM for church staff. Your account doesn't have admin,
              pastor, or staff access. Please contact an administrator.
            </p>
          </div>
        </div>
      );
    }

    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
          </div>
        }>
          <div className="h-screen">
            <GraceMobile
              view={view}
              onNavigate={setView}
              renderView={(v) => renderAdminView(v, setView)}
              churchName={churchName}
              branding={branding}
              userName={mobileUserName}
              roleLabel={mobileRoleLabel}
              people={people}
              tasks={tasks}
              giving={giving}
              events={events}
              prayers={prayers}
            />
          </div>
          <PWAInstallPrompt />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Alternate redesign shell at #/redesign (classic app is the default at #/dashboard).
  if (view === 'home') {
    return (
      <ErrorBoundary>
        <RedesignApp
          data={redesignData}
          addressee={resolveAddressee(user?.firstName, user?.role)}
          timezone={churchSettings?.timezone}
          churchShortName={churchSettings?.profile?.name}
          actions={{
            checkIn: (personId, eventType) => handlers.checkIn(personId, eventType),
            addInteraction: (i) => handlers.addInteraction(i),
            addPrayer: (p) => handlers.addPrayer(p),
            addEvent: (e) => handlers.addEvent({ ...e, allDay: e.allDay }),
            sendMessage: async ({ channel, recipientIds, subject, body }) => {
              let sent = 0, failed = 0, skipped = 0;
              for (const id of recipientIds) {
                const person = people.find(p => p.id === id);
                try {
                  if (channel === 'email') {
                    if (!person?.email) { skipped++; continue; }
                    const r = await fetch('/api/agentmail/send', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ person_id: id, subject: subject || 'A note from your church', text: body }),
                    });
                    if (r.ok) sent++; else failed++;
                  } else {
                    if (!person?.phone) { skipped++; continue; }
                    const r = await fetch('/api/sms/send', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ to: person.phone, message: body }),
                    });
                    if (r.ok) sent++; else failed++;
                  }
                } catch { failed++; }
                await new Promise(res => setTimeout(res, 150)); // gentle pacing
              }
              return { sent, failed, skipped };
            },
          }}
          onAddPerson={() => { setView('people'); modals.openPersonForm(); }}
          onOpenClassic={() => setView('dashboard')}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <TutorialProvider
        setView={(v: View) => setView(v)}
        currentView={view}
        onboarding={churchSettings?.onboarding}
        saveOnboarding={saveOnboarding}
      >
      <GraceChatProvider
        people={people}
        tasks={tasks}
        giving={giving}
        events={events}
        groups={groups}
        prayers={prayers}
        attendance={[...attendanceFromDb, ...attendanceRecords]}
        churchName={churchSettings?.profile?.name}
        churchId={churchId}
        churchProfile={churchSettings?.profile}
        graceFacts={churchSettings?.graceFacts}
        churchTimezone={churchSettings?.timezone}
        userFirstName={user?.firstName}
        userRole={user?.role}
        onAddTask={handlers.addTask}
        onAddPrayer={handlers.addPrayer}
        onAddInteraction={handlers.addInteraction}
        onAddPerson={handlers.savePerson}
        onAddEvent={handlers.addEvent}
        onToggleTask={toggleTask}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onDeletePerson={deletePerson}
        onDeletePrayer={deletePrayer}
        onUpdatePersonStatus={(id, status) => updatePerson(id, { status })}
        onMarkPrayerAnswered={markPrayerAnswered}
      >
      <Layout
        currentView={view}
        setView={setView}
        onOpenSearch={modals.openSearch}
        isDemo={isDemo}
        churchId={churchId}
        timezone={churchSettings?.timezone}
        churchName={churchSettings?.profile?.name}
        branding={churchSettings?.branding}
        sidebarAddon={(() => {
          if (!churchSettings || churchSettings.onboarding?.checklistDismissed) return null;
          // Hide after 3 days of first exposure
          const key = 'grace.checklistFirstSeenAt';
          let firstSeen = localStorage.getItem(key);
          if (!firstSeen) { firstSeen = String(Date.now()); localStorage.setItem(key, firstSeen); }
          if (Date.now() - parseInt(firstSeen, 10) > 3 * 24 * 60 * 60 * 1000) return null;
          return (
            <SetupChecklist
              churchSettings={churchSettings}
              peopleCount={people.length}
              groupsCount={groups.length}
              eventsCount={events.length}
              onNavigate={(v) => navigateView(v as View, setView)}
              onDismiss={() => saveOnboarding({ checklistDismissed: true })}
              onReopenWizard={reopenWizard}
              compact
            />
          ) as ReactNode;
        })()}
      >
        <ErrorBoundary>
          {renderAdminView(view, setView)}
        </ErrorBoundary>
      </Layout>

      {modals.showPersonForm && (
        <PersonForm person={modals.editingPerson} onSave={handlers.savePerson} onClose={modals.closePersonForm} />
      )}

      {modals.showSearch && (
        <GlobalSearch
          people={people}
          tasks={tasks}
          prayers={prayers}
          onSelectPerson={handlers.viewPerson}
          onSelectTask={() => setView('tasks')}
          onSelectPrayer={() => setView('prayer')}
          onNavigate={(v) => navigateView(v, setView)}
          onClose={modals.closeSearch}
        />
      )}


      <AskGrace hideDock={view === 'leadership' || view === 'grace'} />

      {modals.showQuickTask && <QuickTaskForm people={people} onSave={handlers.addTask} onClose={modals.closeQuickTask} />}
      {modals.showQuickPrayer && <QuickPrayerForm people={people} onSave={handlers.addPrayer} onClose={modals.closeQuickPrayer} />}
      {modals.showQuickNote && <QuickNote people={people} onSave={handlers.addInteraction} onClose={modals.closeQuickNote} />}
      {modals.showQuickDonation && (
        <QuickDonationForm
          people={people}
          defaultPersonId={modals.quickDonationPersonId}
          onSave={handlers.addGiving}
          onClose={modals.closeQuickDonation}
        />
      )}

      <EmailSidebar
        isOpen={modals.showEmailSidebar}
        onClose={modals.closeEmailSidebar}
        people={people}
        groups={groups}
        preselectedRecipients={modals.emailRecipients}
        preselectedGroup={modals.emailGroupId}
      />

      <PWAInstallPrompt />

      {showWizard && (
        <Suspense fallback={null}>
          <OnboardingWizard
            churchSettings={churchSettings}
            onSaveProfile={saveChurchProfile}
            onSaveSettings={saveChurchSettings}
            onOpenPersonForm={modals.openPersonForm}
            onSetView={(v: string) => navigateView(v, setView)}
            onComplete={() => setShowWizard(false)}
            onDismiss={() => setShowWizard(false)}
          />
        </Suspense>
      )}

      <TutorialPickerModal />
      <TutorialOverlay />
      <TutorialPickerAutoOpen show={showTutorialPicker} onShown={() => setShowTutorialPicker(false)} />
      </GraceChatProvider>
      </TutorialProvider>
    </ErrorBoundary>
  );
}

export default App;

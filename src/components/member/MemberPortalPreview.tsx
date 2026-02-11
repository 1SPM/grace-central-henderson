import { useState, useMemo } from 'react';
import { QrCode, Smartphone, Monitor, ExternalLink, Copy, Check, ArrowLeft, Link2 } from 'lucide-react';
import { MemberPortal } from './MemberPortal';
import type { Person, CalendarEvent, Giving, Attendance, LeaderProfile, PastoralConversation, HelpCategory } from '../../types';
import type { ChurchProfile } from '../../hooks/useChurchSettings';
import type { LeaderFormData } from '../pastoral/LeaderRegistrationForm';

interface MemberPortalPreviewProps {
  people: Person[];
  events: CalendarEvent[];
  giving: Giving[];
  attendance: Attendance[];
  rsvps: { eventId: string; personId: string; status: 'yes' | 'no' | 'maybe'; guestCount: number }[];
  churchName: string;
  churchProfile?: ChurchProfile;
  onBack: () => void;
  onRSVP?: (eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount?: number) => void;
  onCheckIn?: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
  onPastorSignup?: (data: LeaderFormData) => void;
  leaders?: LeaderProfile[];
  onCreateHelpRequest?: (request: { category: HelpCategory; description?: string; isAnonymous: boolean; leaderId?: string }) => void;
  conversations?: PastoralConversation[];
  activeConversation?: PastoralConversation;
  onSendMessage?: (conversationId: string, content: string) => void;
}

export function MemberPortalPreview({
  people,
  events,
  giving,
  attendance,
  rsvps,
  churchName,
  churchProfile,
  onBack,
  onRSVP,
  onCheckIn,
  onPastorSignup,
  leaders,
  onCreateHelpRequest,
  conversations,
  activeConversation,
  onSendMessage,
}: MemberPortalPreviewProps) {
  const [viewMode, setViewMode] = useState<'phone' | 'full'>('phone');
  const [copied, setCopied] = useState(false);

  // Generate a shareable URL for the portal
  // Uses /portal route which renders standalone member portal without admin UI
  const portalUrl = useMemo(() => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/portal`;
  }, []);

  // Generate QR code using a public API (qrserver.com)
  const qrCodeUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portalUrl)}&bgcolor=ffffff&color=4f46e5`;
  }, [portalUrl]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Full screen mode - just show the portal
  if (viewMode === 'full') {
    return (
      <div className="h-screen">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setViewMode('phone')}
            className="px-3 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-2"
          >
            <Smartphone size={16} />
            Phone Preview
          </button>
        </div>
        <MemberPortal
          people={people}
          events={events}
          giving={giving}
          attendance={attendance}
          rsvps={rsvps}
          churchName={churchName}
          churchProfile={churchProfile}
          onBack={onBack}
          onRSVP={onRSVP}
          onCheckIn={onCheckIn}
          onPastorSignup={onPastorSignup}
          leaders={leaders}
          onCreateHelpRequest={onCreateHelpRequest}
          conversations={conversations}
          activeConversation={activeConversation}
          onSendMessage={onSendMessage}
        />
      </div>
    );
  }

  // Desktop preview with phone frame
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-900 dark:to-dark-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white dark:hover:bg-dark-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-dark-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                Member Portal Preview
              </h1>
              <p className="text-gray-500 dark:text-dark-400">
                Preview how members will see the portal on their devices
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-white dark:bg-dark-800 rounded-xl p-1 border border-gray-200 dark:border-dark-600">
            <button
              onClick={() => setViewMode('phone')}
              className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
            >
              <Smartphone size={16} />
              Phone
            </button>
            <button
              onClick={() => setViewMode('full')}
              className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700"
            >
              <Monitor size={16} />
              Full Screen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Phone Frame Preview */}
          <div className="lg:col-span-2 flex justify-center">
            <div className="relative">
              {/* Phone Frame */}
              <div className="w-[375px] h-[812px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                {/* Phone Bezel */}
                <div className="w-full h-full bg-white dark:bg-dark-900 rounded-[2.4rem] overflow-hidden relative">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl z-50" />

                  {/* Screen Content — internal flex layout handles its own scrolling */}
                  <div className="h-full overflow-hidden" style={{ transform: 'translateZ(0)' }}>
                    <MemberPortal
                      people={people}
                      events={events}
                      giving={giving}
                      attendance={attendance}
                      rsvps={rsvps}
                      churchName={churchName}
                      churchProfile={churchProfile}
                      onRSVP={onRSVP}
                      onCheckIn={onCheckIn}
                      onPastorSignup={onPastorSignup}
                      leaders={leaders}
                      onCreateHelpRequest={onCreateHelpRequest}
                      conversations={conversations}
                      activeConversation={activeConversation}
                      onSendMessage={onSendMessage}
                    />
                  </div>
                </div>
              </div>

              {/* Phone Side Button */}
              <div className="absolute right-[-3px] top-32 w-1 h-16 bg-gray-800 rounded-l-sm" />
              <div className="absolute left-[-3px] top-28 w-1 h-8 bg-gray-800 rounded-r-sm" />
              <div className="absolute left-[-3px] top-40 w-1 h-16 bg-gray-800 rounded-r-sm" />
            </div>
          </div>

          {/* QR Code & Sharing Panel */}
          <div className="space-y-6">
            {/* QR Code Card */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
                  <QrCode className="text-indigo-600 dark:text-indigo-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100">
                    Scan to Preview
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    Test on your mobile device
                  </p>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-xl border border-gray-100 dark:border-dark-600">
                <img
                  src={qrCodeUrl}
                  alt="QR Code to Member Portal"
                  className="w-48 h-48"
                  loading="lazy"
                />
              </div>

              <p className="text-xs text-center text-gray-400 dark:text-dark-500 mt-3">
                Scan with your phone camera to open the portal
              </p>
            </div>

            {/* Share Link Card */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Link2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100">
                    Portal URL
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    Share with your members
                  </p>
                </div>
              </div>

              {/* URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={portalUrl}
                  readOnly
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl text-sm text-gray-600 dark:text-dark-300 truncate"
                />
                <button
                  onClick={handleCopyUrl}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                    copied
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Open in new tab */}
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                Open in New Tab
              </a>
            </div>

            {/* Info Card */}
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20 p-4">
              <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-2">
                Admin Preview Mode
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300/80">
                You're viewing the portal as an admin. Members will see their own giving history and personalized content when logged in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

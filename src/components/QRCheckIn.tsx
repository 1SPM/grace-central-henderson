import { useState, useMemo } from 'react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  UserCheck,
  Users,
  Baby,
  Clock,
  Calendar,
  ChevronRight,
  Shield,
  X,
  Smartphone,
} from 'lucide-react';
import type { Person, CalendarEvent, Attendance } from '../types';

interface QRCheckInProps {
  people: Person[];
  events: CalendarEvent[];
  attendance: Attendance[];
  churchName: string;
  churchId: string;
  onCheckIn: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
  onBack?: () => void;
}

// Generate QR code as SVG using a simple implementation
function generateQRCodeSVG(data: string, size: number = 200): string {
  // This is a simplified QR-like pattern generator
  // In production, you'd use a library like qrcode or qr.js
  const modules = 25;
  const moduleSize = size / modules;

  // Create a deterministic pattern based on the data
  const hash = data.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  // Position detection patterns (corners)
  const drawFinderPattern = (x: number, y: number) => {
    // Outer square
    svg += `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${7 * moduleSize}" height="${7 * moduleSize}" fill="black"/>`;
    svg += `<rect x="${(x + 1) * moduleSize}" y="${(y + 1) * moduleSize}" width="${5 * moduleSize}" height="${5 * moduleSize}" fill="white"/>`;
    svg += `<rect x="${(x + 2) * moduleSize}" y="${(y + 2) * moduleSize}" width="${3 * moduleSize}" height="${3 * moduleSize}" fill="black"/>`;
  };

  drawFinderPattern(0, 0);
  drawFinderPattern(modules - 7, 0);
  drawFinderPattern(0, modules - 7);

  // Data modules (simplified pattern)
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      // Skip finder patterns
      if ((row < 8 && col < 8) || (row < 8 && col >= modules - 8) || (row >= modules - 8 && col < 8)) {
        continue;
      }

      // Create pseudo-random but deterministic pattern
      const index = row * modules + col;
      const bit = ((hash >> (index % 32)) ^ (data.charCodeAt(index % data.length) || 0)) & 1;

      if (bit) {
        svg += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

// Security code generator for kids check-in
function generateSecurityCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function QRCheckIn({
  people,
  events,
  attendance,
  churchName,
  churchId,
  onCheckIn,
  onBack: _onBack,
}: QRCheckInProps) {
  void _onBack; // Reserved for future use
  const [activeTab, setActiveTab] = useState<'generate' | 'checkin' | 'kiosk'>('generate');
  const [selectedEvent, setSelectedEvent] = useState<string>('sunday-service');
  const [customEventName, setCustomEventName] = useState('');
  const { isCopied: copied, copy: copyToClipboard } = useCopyToClipboard();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showKidsCheckIn, setShowKidsCheckIn] = useState(false);
  const [_securityCodes, setSecurityCodes] = useState<Record<string, string>>({});
  void _securityCodes; // Reserved for security code lookup/validation
  const [recentCheckIns, setRecentCheckIns] = useState<{ person: Person; time: Date; code?: string }[]>([]);

  // Get upcoming events for the dropdown
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.startDate || '') >= now)
      .sort((a, b) => new Date(a.startDate || '').getTime() - new Date(b.startDate || '').getTime())
      .slice(0, 10);
  }, [events]);

  // Generate check-in URL
  const checkInUrl = useMemo(() => {
    const baseUrl = window.location.origin;
    const eventParam = selectedEvent === 'custom' ? customEventName : selectedEvent;
    return `${baseUrl}/checkin?church=${churchId}&event=${encodeURIComponent(eventParam)}`;
  }, [churchId, selectedEvent, customEventName]);

  // Generate QR code SVG
  const qrCodeSvg = useMemo(() => {
    return generateQRCodeSVG(checkInUrl, 250);
  }, [checkInUrl]);

  // Filter people for search
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return people
      .filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.phone?.includes(query)
      )
      .slice(0, 10);
  }, [people, searchQuery]);

  // Today's check-ins
  const todaysCheckIns = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return attendance.filter(a => a.date?.startsWith(today) || a.checkedInAt?.startsWith(today));
  }, [attendance]);

  // Copy URL to clipboard
  const copyUrl = () => {
    copyToClipboard(checkInUrl);
  };

  // Download QR code
  const downloadQR = () => {
    const blob = new Blob([qrCodeSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${churchName.toLowerCase().replace(/\s+/g, '-')}-checkin-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print QR code
  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Check-In QR Code - ${churchName}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, sans-serif;
            }
            h1 { margin-bottom: 10px; }
            p { color: #666; margin-bottom: 30px; }
            .qr { margin: 20px 0; }
            .url { font-size: 12px; color: #999; margin-top: 20px; word-break: break-all; max-width: 300px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${churchName}</h1>
          <p>Scan to Check In</p>
          <div class="qr">${qrCodeSvg}</div>
          <p class="url">${checkInUrl}</p>
          <script>window.onload = () => { window.print(); }</script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Handle check-in
  const handleCheckIn = (person: Person, isChild: boolean = false) => {
    const eventType = selectedEvent === 'sunday-service' ? 'sunday_service' :
                      selectedEvent === 'midweek' ? 'midweek' : 'other';
    const eventName = selectedEvent === 'custom' ? customEventName : selectedEvent;

    onCheckIn(person.id, eventType as Attendance['eventType'], eventName);

    let code: string | undefined;
    if (isChild) {
      code = generateSecurityCode();
      setSecurityCodes(prev => ({ ...prev, [person.id]: code! }));
    }

    setRecentCheckIns(prev => [{ person, time: new Date(), code }, ...prev].slice(0, 20));
    setSelectedPerson(null);
    setSearchQuery('');
  };

  // Get family members
  const getFamilyMembers = (person: Person) => {
    if (!person.familyId) return [person];
    return people.filter(p => p.familyId === person.familyId);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
            QR Code Check-In
          </h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            {todaysCheckIns.length} check-ins today
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-dark-800 p-1 rounded-xl w-fit">
        {[
          { id: 'generate', label: 'Generate QR', icon: <QrCode size={16} /> },
          { id: 'checkin', label: 'Manual Check-In', icon: <UserCheck size={16} /> },
          { id: 'kiosk', label: 'Kiosk Mode', icon: <Smartphone size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                : 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate QR Tab */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code Display */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">
                {churchName} Check-In
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mb-6">
                Scan with your phone camera to check in
              </p>

              {/* QR Code */}
              <div
                className="inline-block p-4 bg-white rounded-xl shadow-sm border border-gray-100"
                dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
              />

              {/* URL */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-dark-400 break-all">
                  {checkInUrl}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={copyUrl}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-dark-300 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 flex items-center gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
                <button
                  onClick={downloadQR}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-dark-300 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 flex items-center gap-2"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={printQR}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Printer size={16} />
                  Print
                </button>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            {/* Event Selection */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                <Calendar size={18} />
                Event / Service
              </h3>
              <div className="space-y-2">
                {[
                  { id: 'sunday-service', label: 'Sunday Service' },
                  { id: 'midweek', label: 'Midweek Service' },
                  { id: 'youth', label: 'Youth Group' },
                  { id: 'kids', label: 'Kids Ministry' },
                ].map((event) => (
                  <label
                    key={event.id}
                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${
                      selectedEvent === event.id
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-2 border-indigo-500'
                        : 'bg-gray-50 dark:bg-dark-850 border-2 border-transparent hover:border-gray-200 dark:hover:border-dark-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="event"
                      value={event.id}
                      checked={selectedEvent === event.id}
                      onChange={(e) => setSelectedEvent(e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {event.label}
                    </span>
                  </label>
                ))}

                {/* Upcoming events */}
                {upcomingEvents.length > 0 && (
                  <>
                    <div className="border-t border-gray-100 dark:border-dark-700 my-3" />
                    <p className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase mb-2">
                      Upcoming Events
                    </p>
                    {upcomingEvents.slice(0, 3).map((event) => (
                      <label
                        key={event.id}
                        className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${
                          selectedEvent === event.id
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 border-2 border-indigo-500'
                            : 'bg-gray-50 dark:bg-dark-850 border-2 border-transparent hover:border-gray-200 dark:hover:border-dark-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="event"
                          value={event.id}
                          checked={selectedEvent === event.id}
                          onChange={(e) => setSelectedEvent(e.target.value)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                          {event.title}
                        </span>
                      </label>
                    ))}
                  </>
                )}

                {/* Custom event */}
                <div className="border-t border-gray-100 dark:border-dark-700 my-3" />
                <label
                  className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${
                    selectedEvent === 'custom'
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-2 border-indigo-500'
                      : 'bg-gray-50 dark:bg-dark-850 border-2 border-transparent hover:border-gray-200 dark:hover:border-dark-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="event"
                    value="custom"
                    checked={selectedEvent === 'custom'}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                    Custom Event
                  </span>
                </label>
                {selectedEvent === 'custom' && (
                  <input
                    type="text"
                    value={customEventName}
                    onChange={(e) => setCustomEventName(e.target.value)}
                    placeholder="Enter event name..."
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                  />
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-400 mb-3">
                How to Use
              </h3>
              <ol className="text-sm text-blue-800 dark:text-blue-400/80 space-y-2 list-decimal list-inside">
                <li>Print the QR code and display it at your entrance</li>
                <li>Guests scan with their phone camera</li>
                <li>They enter their name or phone to find themselves</li>
                <li>One tap to check in - no app needed!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Manual Check-In Tab */}
      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search & Check-In */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-lg"
                  autoFocus
                />
              </div>

              {/* Search Results */}
              {filteredPeople.length > 0 && (
                <div className="mt-4 space-y-2">
                  {filteredPeople.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-850 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-medium">
                          {person.firstName?.[0]}{person.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-dark-100">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-dark-400">
                            {person.email || person.phone || 'No contact info'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCheckIn(person, false)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
                        >
                          <UserCheck size={16} />
                          Check In
                        </button>
                        {person.familyId && (
                          <button
                            onClick={() => setSelectedPerson(person)}
                            className="px-4 py-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-200 dark:hover:bg-indigo-500/30 flex items-center gap-2"
                          >
                            <Users size={16} />
                            Family
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && filteredPeople.length === 0 && (
                <div className="mt-4 text-center py-8 text-gray-500 dark:text-dark-400">
                  No people found matching "{searchQuery}"
                </div>
              )}
            </div>

            {/* Kids Check-In Toggle */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <Baby className="text-amber-600 dark:text-amber-400" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-dark-100">Kids Check-In Mode</p>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Generate security codes for child pickup</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKidsCheckIn(!showKidsCheckIn)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    showKidsCheckIn ? 'bg-amber-500' : 'bg-gray-300 dark:bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      showKidsCheckIn ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Recent Check-Ins */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-4 flex items-center gap-2">
              <Clock size={18} />
              Recent Check-Ins
            </h3>
            {recentCheckIns.length > 0 ? (
              <div className="space-y-3">
                {recentCheckIns.map((checkIn, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-850 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                        {checkIn.person.firstName} {checkIn.person.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {checkIn.time.toLocaleTimeString()}
                      </p>
                    </div>
                    {checkIn.code && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-500/20 rounded text-amber-700 dark:text-amber-400 text-xs font-mono font-bold">
                        <Shield size={12} />
                        {checkIn.code}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 dark:text-dark-400 text-sm">
                No check-ins yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Kiosk Mode Tab */}
      {activeTab === 'kiosk' && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-8 text-center">
          <Smartphone className="mx-auto text-gray-400 dark:text-dark-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">
            Kiosk Mode
          </h2>
          <p className="text-gray-500 dark:text-dark-400 mb-6 max-w-md mx-auto">
            Launch a full-screen touch-friendly check-in interface for lobby tablets and kiosks.
          </p>
          <button
            onClick={() => window.open(`/kiosk?church=${churchId}`, '_blank')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 inline-flex items-center gap-2"
          >
            Launch Kiosk Mode
            <ChevronRight size={18} />
          </button>
          <p className="text-xs text-gray-400 dark:text-dark-500 mt-4">
            Tip: Press F11 for full-screen mode on the kiosk device
          </p>
        </div>
      )}

      {/* Family Check-In Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Family Check-In
              </h2>
              <button
                onClick={() => setSelectedPerson(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-300 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {getFamilyMembers(selectedPerson).map((member) => {
                const isChild = member.birthDate &&
                  new Date().getFullYear() - new Date(member.birthDate).getFullYear() < 18;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                        isChild
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {isChild ? <Baby size={18} /> : `${member.firstName?.[0]}${member.lastName?.[0]}`}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-dark-100">
                          {member.firstName} {member.lastName}
                        </p>
                        {isChild && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Child</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCheckIn(member, isChild || false)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                    >
                      Check In
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700">
              <button
                onClick={() => {
                  getFamilyMembers(selectedPerson).forEach(member => {
                    const isChild = member.birthDate &&
                      new Date().getFullYear() - new Date(member.birthDate).getFullYear() < 18;
                    handleCheckIn(member, isChild || false);
                  });
                  setSelectedPerson(null);
                }}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                Check In All Family Members
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

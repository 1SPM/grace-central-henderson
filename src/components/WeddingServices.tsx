import { useState, useMemo } from 'react';
import {
  Heart,
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  Circle,
  Plus,
  Edit2,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  BookOpen,
  Music,
  Camera,
  Utensils,
  Car,
  ArrowLeft,
} from 'lucide-react';
import type { Person, CalendarEvent } from '../types';

interface WeddingCeremony {
  id: string;
  brideId?: string;
  brideName: string;
  brideEmail?: string;
  bridePhone?: string;
  groomId?: string;
  groomName: string;
  groomEmail?: string;
  groomPhone?: string;
  weddingDate: string;
  weddingTime: string;
  rehearsalDate?: string;
  rehearsalTime?: string;
  venue: string;
  venueAddress?: string;
  receptionVenue?: string;
  officiantId?: string;
  officiantName?: string;
  status: 'inquiry' | 'booked' | 'counseling' | 'planning' | 'rehearsed' | 'completed' | 'cancelled';
  counselingSessions: CounselingSession[];
  checklist: ChecklistItem[];
  vendors: WeddingVendor[];
  weddingParty: WeddingPartyMember[];
  notes: string;
  depositPaid: boolean;
  depositAmount?: number;
  feePaid: boolean;
  feeAmount?: number;
  marriageLicenseReceived: boolean;
  marriageLicenseNumber?: string;
  certificateSigned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CounselingSession {
  id: string;
  date: string;
  topic: string;
  notes: string;
  completed: boolean;
}

interface ChecklistItem {
  id: string;
  task: string;
  category: 'ceremony' | 'paperwork' | 'preparation' | 'rehearsal';
  dueDate?: string;
  completed: boolean;
  assignedTo?: string;
}

interface WeddingVendor {
  id: string;
  type: 'photographer' | 'videographer' | 'florist' | 'caterer' | 'dj' | 'band' | 'bakery' | 'transportation' | 'other';
  name: string;
  contact: string;
  phone?: string;
  email?: string;
  confirmed: boolean;
  notes?: string;
}

interface WeddingPartyMember {
  id: string;
  name: string;
  role: 'best-man' | 'maid-of-honor' | 'groomsman' | 'bridesmaid' | 'flower-girl' | 'ring-bearer' | 'usher' | 'reader' | 'musician' | 'other';
  phone?: string;
  email?: string;
}

interface WeddingServicesProps {
  people: Person[];
  events?: CalendarEvent[];
  onAddEvent?: (event: { title: string; startDate: string; category: 'wedding'; description?: string; location?: string; allDay: boolean }) => void;
  onViewPerson?: (id: string) => void;
  onBack?: () => void;
}

const statusColors: Record<WeddingCeremony['status'], { bg: string; text: string; label: string }> = {
  inquiry: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Inquiry' },
  booked: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', label: 'Booked' },
  counseling: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', label: 'Counseling' },
  planning: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', label: 'Planning' },
  rehearsed: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-400', label: 'Rehearsed' },
  completed: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', label: 'Completed' },
  cancelled: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', label: 'Cancelled' },
};

const vendorIcons: Record<WeddingVendor['type'], React.ReactNode> = {
  photographer: <Camera className="w-4 h-4" />,
  videographer: <Camera className="w-4 h-4" />,
  florist: <Heart className="w-4 h-4" />,
  caterer: <Utensils className="w-4 h-4" />,
  dj: <Music className="w-4 h-4" />,
  band: <Music className="w-4 h-4" />,
  bakery: <Utensils className="w-4 h-4" />,
  transportation: <Car className="w-4 h-4" />,
  other: <FileText className="w-4 h-4" />,
};

const defaultChecklist: Omit<ChecklistItem, 'id'>[] = [
  { task: 'Initial consultation with couple', category: 'preparation', completed: false },
  { task: 'Receive marriage license', category: 'paperwork', completed: false },
  { task: 'Complete pre-marital counseling', category: 'preparation', completed: false },
  { task: 'Finalize ceremony details', category: 'ceremony', completed: false },
  { task: 'Confirm wedding party roles', category: 'ceremony', completed: false },
  { task: 'Schedule rehearsal', category: 'rehearsal', completed: false },
  { task: 'Conduct rehearsal', category: 'rehearsal', completed: false },
  { task: 'Prepare ceremony space', category: 'ceremony', completed: false },
  { task: 'Sign marriage certificate', category: 'paperwork', completed: false },
  { task: 'Submit marriage certificate to county', category: 'paperwork', completed: false },
];

export function WeddingServices({ people: _people, events: _events, onAddEvent, onViewPerson: _onViewPerson, onBack }: WeddingServicesProps) {
  const [weddings, setWeddings] = useState<WeddingCeremony[]>([]);
  const [selectedWedding, setSelectedWedding] = useState<WeddingCeremony | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWedding, setEditingWedding] = useState<WeddingCeremony | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WeddingCeremony['status'] | 'all'>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true,
    counseling: false,
    checklist: false,
    vendors: false,
    party: false,
  });

  const filteredWeddings = useMemo(() => {
    return weddings.filter(wedding => {
      const matchesSearch =
        wedding.brideName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wedding.groomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wedding.venue.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || wedding.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [weddings, searchTerm, statusFilter]);

  const upcomingWeddings = useMemo(() => {
    const now = new Date();
    return filteredWeddings
      .filter(w => new Date(w.weddingDate) >= now && w.status !== 'cancelled' && w.status !== 'completed')
      .sort((a, b) => new Date(a.weddingDate).getTime() - new Date(b.weddingDate).getTime());
  }, [filteredWeddings]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleAddWedding = () => {
    setEditingWedding(null);
    setShowForm(true);
  };

  const handleSaveWedding = (weddingData: Partial<WeddingCeremony>) => {
    if (editingWedding) {
      setWeddings(prev => prev.map(w =>
        w.id === editingWedding.id
          ? { ...w, ...weddingData, updatedAt: new Date().toISOString() }
          : w
      ));
    } else {
      const newWedding: WeddingCeremony = {
        id: `wedding-${Date.now()}`,
        brideName: weddingData.brideName || '',
        groomName: weddingData.groomName || '',
        weddingDate: weddingData.weddingDate || '',
        weddingTime: weddingData.weddingTime || '',
        venue: weddingData.venue || '',
        status: 'inquiry',
        counselingSessions: [],
        checklist: defaultChecklist.map((item, idx) => ({ ...item, id: `check-${Date.now()}-${idx}` })),
        vendors: [],
        weddingParty: [],
        notes: '',
        depositPaid: false,
        feePaid: false,
        marriageLicenseReceived: false,
        certificateSigned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...weddingData,
      };
      setWeddings(prev => [...prev, newWedding]);

      // Add to calendar if handler provided
      if (onAddEvent && weddingData.weddingDate) {
        onAddEvent({
          title: `${weddingData.brideName} & ${weddingData.groomName} Wedding`,
          startDate: weddingData.weddingDate,
          category: 'wedding',
          description: `Wedding ceremony at ${weddingData.venue}`,
          location: weddingData.venue,
          allDay: false,
        });
      }
    }
    setShowForm(false);
    setEditingWedding(null);
  };

  const handleToggleChecklistItem = (weddingId: string, itemId: string) => {
    setWeddings(prev => prev.map(w => {
      if (w.id !== weddingId) return w;
      return {
        ...w,
        checklist: w.checklist.map(item =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        ),
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  const getChecklistProgress = (wedding: WeddingCeremony) => {
    const completed = wedding.checklist.filter(item => item.completed).length;
    return { completed, total: wedding.checklist.length, percent: Math.round((completed / wedding.checklist.length) * 100) };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          <div className="p-2 bg-pink-100 dark:bg-pink-500/15 rounded-xl">
            <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wedding Services</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage wedding ceremonies and couple preparation
            </p>
          </div>
        </div>
        <button
          onClick={handleAddWedding}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Wedding
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-pink-600">{upcomingWeddings.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-purple-600">
            {weddings.filter(w => w.status === 'counseling').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In Counseling</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600">
            {weddings.filter(w => w.status === 'completed').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">
            {weddings.filter(w => w.status === 'inquiry').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Inquiries</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search couples or venues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WeddingCeremony['status'] | 'all')}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="all">All Status</option>
            {Object.entries(statusColors).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Wedding List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List Panel */}
        <div className="space-y-4">
          {filteredWeddings.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No weddings found</p>
              <button
                onClick={handleAddWedding}
                className="mt-4 text-pink-600 hover:text-pink-700 text-sm font-medium"
              >
                Schedule a new wedding
              </button>
            </div>
          ) : (
            filteredWeddings.map(wedding => {
              const progress = getChecklistProgress(wedding);
              const statusStyle = statusColors[wedding.status];
              return (
                <div
                  key={wedding.id}
                  onClick={() => setSelectedWedding(wedding)}
                  className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    selectedWedding?.id === wedding.id
                      ? 'border-pink-500 shadow-lg'
                      : 'border-gray-200 dark:border-gray-700 hover:border-pink-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {wedding.brideName} & {wedding.groomName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(wedding.weddingDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <span>at {wedding.weddingTime}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    {wedding.venue}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-500 transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        {selectedWedding && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedWedding.brideName} & {selectedWedding.groomName}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(selectedWedding.weddingDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingWedding(selectedWedding);
                      setShowForm(true);
                    }}
                    className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {/* Details Section */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('details')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Wedding Details
                  </span>
                  {expandedSections.details ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.details && (
                  <div className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Venue</p>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedWedding.venue}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Time</p>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedWedding.weddingTime}</p>
                      </div>
                      {selectedWedding.rehearsalDate && (
                        <>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Rehearsal Date</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {new Date(selectedWedding.rehearsalDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Rehearsal Time</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedWedding.rehearsalTime}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedWedding.marriageLicenseReceived && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" /> License Received
                        </span>
                      )}
                      {selectedWedding.depositPaid && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" /> Deposit Paid
                        </span>
                      )}
                      {selectedWedding.certificateSigned && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" /> Certificate Signed
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Checklist Section */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('checklist')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Checklist ({getChecklistProgress(selectedWedding).completed}/{getChecklistProgress(selectedWedding).total})
                  </span>
                  {expandedSections.checklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.checklist && (
                  <div className="p-4 space-y-2">
                    {selectedWedding.checklist.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklistItem(selectedWedding.id, item.id)}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer"
                      >
                        {item.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {item.task}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Counseling Section */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('counseling')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    Pre-Marital Counseling ({selectedWedding.counselingSessions.length} sessions)
                  </span>
                  {expandedSections.counseling ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.counseling && (
                  <div className="p-4">
                    {selectedWedding.counselingSessions.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No counseling sessions scheduled
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedWedding.counselingSessions.map(session => (
                          <div key={session.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 dark:text-white">{session.topic}</span>
                              {session.completed && <CheckCircle className="w-4 h-4 text-green-500" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {new Date(session.date).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vendors Section */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('vendors')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Vendors ({selectedWedding.vendors.length})
                  </span>
                  {expandedSections.vendors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.vendors && (
                  <div className="p-4">
                    {selectedWedding.vendors.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No vendors added yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedWedding.vendors.map(vendor => (
                          <div key={vendor.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                {vendorIcons[vendor.type]}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{vendor.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{vendor.type}</p>
                              </div>
                            </div>
                            {vendor.confirmed && (
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full text-xs">
                                Confirmed
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wedding Form Modal */}
      {showForm && (
        <WeddingFormModal
          wedding={editingWedding}
          people={_people}
          onSave={handleSaveWedding}
          onClose={() => {
            setShowForm(false);
            setEditingWedding(null);
          }}
        />
      )}
    </div>
  );
}

// Wedding Form Modal Component
function WeddingFormModal({
  wedding,
  people: _people,
  onSave,
  onClose,
}: {
  wedding: WeddingCeremony | null;
  people: Person[];
  onSave: (data: Partial<WeddingCeremony>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    brideName: wedding?.brideName || '',
    brideEmail: wedding?.brideEmail || '',
    bridePhone: wedding?.bridePhone || '',
    groomName: wedding?.groomName || '',
    groomEmail: wedding?.groomEmail || '',
    groomPhone: wedding?.groomPhone || '',
    weddingDate: wedding?.weddingDate || '',
    weddingTime: wedding?.weddingTime || '14:00',
    rehearsalDate: wedding?.rehearsalDate || '',
    rehearsalTime: wedding?.rehearsalTime || '18:00',
    venue: wedding?.venue || '',
    venueAddress: wedding?.venueAddress || '',
    status: wedding?.status || 'inquiry',
    notes: wedding?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {wedding ? 'Edit Wedding' : 'New Wedding'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Couple Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Couple Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Bride's Name"
                  value={formData.brideName}
                  onChange={(e) => setFormData({ ...formData, brideName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <input
                  type="email"
                  placeholder="Bride's Email"
                  value={formData.brideEmail}
                  onChange={(e) => setFormData({ ...formData, brideEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <input
                  type="tel"
                  placeholder="Bride's Phone"
                  value={formData.bridePhone}
                  onChange={(e) => setFormData({ ...formData, bridePhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Groom's Name"
                  value={formData.groomName}
                  onChange={(e) => setFormData({ ...formData, groomName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <input
                  type="email"
                  placeholder="Groom's Email"
                  value={formData.groomEmail}
                  onChange={(e) => setFormData({ ...formData, groomEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <input
                  type="tel"
                  placeholder="Groom's Phone"
                  value={formData.groomPhone}
                  onChange={(e) => setFormData({ ...formData, groomPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Wedding Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Wedding Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wedding Date</label>
                <input
                  type="date"
                  value={formData.weddingDate}
                  onChange={(e) => setFormData({ ...formData, weddingDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wedding Time</label>
                <input
                  type="time"
                  value={formData.weddingTime}
                  onChange={(e) => setFormData({ ...formData, weddingTime: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rehearsal Date</label>
                <input
                  type="date"
                  value={formData.rehearsalDate}
                  onChange={(e) => setFormData({ ...formData, rehearsalDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rehearsal Time</label>
                <input
                  type="time"
                  value={formData.rehearsalTime}
                  onChange={(e) => setFormData({ ...formData, rehearsalTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Venue */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Venue</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Venue Name"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <input
                type="text"
                placeholder="Venue Address"
                value={formData.venueAddress}
                onChange={(e) => setFormData({ ...formData, venueAddress: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as WeddingCeremony['status'] })}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {Object.entries(statusColors).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
            >
              {wedding ? 'Save Changes' : 'Create Wedding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

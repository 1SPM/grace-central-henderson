import { useState, useMemo } from 'react';
import {
  Calendar,
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
  Phone,
  Mail,
  BookOpen,
  Music,
  Flower2,
  ArrowLeft,
  Church,
} from 'lucide-react';
import type { Person, CalendarEvent } from '../types';

interface FuneralService {
  id: string;
  deceasedName: string;
  dateOfBirth?: string;
  dateOfDeath: string;
  memberSince?: string;
  wasMember: boolean;
  // Primary contact (family member)
  primaryContactId?: string;
  primaryContactName: string;
  primaryContactRelation: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  // Service details
  serviceDate: string;
  serviceTime: string;
  serviceType: 'funeral' | 'memorial' | 'graveside' | 'celebration-of-life' | 'private';
  serviceLocation: string;
  serviceAddress?: string;
  // Additional locations
  wakeDate?: string;
  wakeTime?: string;
  wakeLocation?: string;
  burialDate?: string;
  burialTime?: string;
  cemeteryName?: string;
  cemeteryAddress?: string;
  // Officiant and participants
  officiantId?: string;
  officiantName?: string;
  eulogists: Eulogist[];
  musicians: ServiceParticipant[];
  pallbearers: ServiceParticipant[];
  honoraryPallbearers: ServiceParticipant[];
  // Service elements
  selectedHymns: string[];
  selectedScriptures: string[];
  obituary?: string;
  // Planning
  status: 'inquiry' | 'planning' | 'confirmed' | 'completed' | 'cancelled';
  checklist: FuneralChecklistItem[];
  // Vendors
  funeralHome?: string;
  funeralHomeContact?: string;
  florist?: string;
  caterer?: string;
  // Financials
  honorariumPaid: boolean;
  honorariumAmount?: number;
  // Notes
  notes: string;
  familyNotes?: string; // Private notes about family situation
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface Eulogist {
  id: string;
  name: string;
  relation: string;
  phone?: string;
  email?: string;
  confirmed: boolean;
}

interface ServiceParticipant {
  id: string;
  name: string;
  role: string;
  phone?: string;
  confirmed: boolean;
}

interface FuneralChecklistItem {
  id: string;
  task: string;
  category: 'planning' | 'service' | 'paperwork' | 'family' | 'reception';
  dueDate?: string;
  completed: boolean;
  assignedTo?: string;
}

interface FuneralServicesProps {
  people: Person[];
  events?: CalendarEvent[];
  onAddEvent?: (event: { title: string; startDate: string; category: 'funeral' | 'obituary'; description?: string; location?: string; allDay: boolean }) => void;
  onViewPerson?: (id: string) => void;
  onBack?: () => void;
}

const statusColors: Record<FuneralService['status'], { bg: string; text: string; label: string }> = {
  inquiry: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Inquiry' },
  planning: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', label: 'Planning' },
  confirmed: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', label: 'Confirmed' },
  completed: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', label: 'Completed' },
  cancelled: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', label: 'Cancelled' },
};

const serviceTypeLabels: Record<FuneralService['serviceType'], string> = {
  funeral: 'Funeral Service',
  memorial: 'Memorial Service',
  graveside: 'Graveside Service',
  'celebration-of-life': 'Celebration of Life',
  private: 'Private Service',
};

const defaultChecklist: Omit<FuneralChecklistItem, 'id'>[] = [
  // Planning
  { task: 'Initial meeting with family', category: 'planning', completed: false },
  { task: 'Confirm service date and time', category: 'planning', completed: false },
  { task: 'Reserve church/venue', category: 'planning', completed: false },
  { task: 'Coordinate with funeral home', category: 'planning', completed: false },
  { task: 'Select hymns and music', category: 'planning', completed: false },
  { task: 'Select scripture readings', category: 'planning', completed: false },
  { task: 'Prepare obituary', category: 'planning', completed: false },
  // Service
  { task: 'Confirm officiant availability', category: 'service', completed: false },
  { task: 'Confirm eulogists', category: 'service', completed: false },
  { task: 'Confirm musicians/soloist', category: 'service', completed: false },
  { task: 'Arrange pallbearers', category: 'service', completed: false },
  { task: 'Prepare order of service', category: 'service', completed: false },
  { task: 'Print bulletins/programs', category: 'service', completed: false },
  { task: 'Set up sound system', category: 'service', completed: false },
  { task: 'Prepare video/photo tribute', category: 'service', completed: false },
  // Family
  { task: 'Family seating arrangements', category: 'family', completed: false },
  { task: 'Special requests noted', category: 'family', completed: false },
  { task: 'Family limo arrangements', category: 'family', completed: false },
  // Reception
  { task: 'Book reception venue', category: 'reception', completed: false },
  { task: 'Arrange catering', category: 'reception', completed: false },
  { task: 'Coordinate volunteers for reception', category: 'reception', completed: false },
  // Paperwork
  { task: 'Death certificate copy received', category: 'paperwork', completed: false },
  { task: 'Church records updated', category: 'paperwork', completed: false },
  { task: 'Follow-up card sent to family', category: 'paperwork', completed: false },
];

const commonHymns = [
  'Amazing Grace',
  'How Great Thou Art',
  'In the Garden',
  'The Old Rugged Cross',
  'Blessed Assurance',
  'It Is Well With My Soul',
  'Abide With Me',
  'Going Home',
  'Be Thou My Vision',
  'What a Friend We Have in Jesus',
  'Rock of Ages',
  'On Eagle\'s Wings',
];

const commonScriptures = [
  'Psalm 23 - The Lord is My Shepherd',
  'John 14:1-6 - Let Not Your Heart Be Troubled',
  'John 11:25-26 - I Am the Resurrection',
  'Romans 8:38-39 - Nothing Can Separate Us',
  '1 Corinthians 15:51-57 - Victory Over Death',
  'Revelation 21:1-4 - New Heaven and Earth',
  'Ecclesiastes 3:1-8 - A Time for Everything',
  'Psalm 121 - My Help Comes from the Lord',
  '2 Corinthians 5:1 - Heavenly Dwelling',
  '1 Thessalonians 4:13-18 - Hope in Christ',
];

export function FuneralServices({ people: _people, events: _events, onAddEvent, onViewPerson: _onViewPerson, onBack }: FuneralServicesProps) {
  const [services, setServices] = useState<FuneralService[]>([]);
  const [selectedService, setSelectedService] = useState<FuneralService | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<FuneralService | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FuneralService['status'] | 'all'>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    details: true,
    checklist: true,
    participants: false,
    music: false,
    notes: false,
  });

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.deceasedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.primaryContactName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [services, searchTerm, statusFilter]);

  // Upcoming services
  const upcomingServices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return services.filter(s => s.serviceDate >= today && s.status !== 'completed' && s.status !== 'cancelled')
                   .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  }, [services]);

  const handleAddService = () => {
    setEditingService(null);
    setShowForm(true);
  };

  const handleEditService = (service: FuneralService) => {
    setEditingService(service);
    setShowForm(true);
  };

  const handleSaveService = (serviceData: Partial<FuneralService>) => {
    if (editingService) {
      // Update existing service
      setServices(prev => prev.map(s =>
        s.id === editingService.id
          ? { ...s, ...serviceData, updatedAt: new Date().toISOString() }
          : s
      ));
      if (selectedService?.id === editingService.id) {
        setSelectedService(prev => prev ? { ...prev, ...serviceData, updatedAt: new Date().toISOString() } : null);
      }
    } else {
      // Create new service
      const newService: FuneralService = {
        id: `funeral-${Date.now()}`,
        deceasedName: serviceData.deceasedName || '',
        dateOfDeath: serviceData.dateOfDeath || '',
        wasMember: serviceData.wasMember || false,
        primaryContactName: serviceData.primaryContactName || '',
        primaryContactRelation: serviceData.primaryContactRelation || '',
        primaryContactPhone: serviceData.primaryContactPhone,
        primaryContactEmail: serviceData.primaryContactEmail,
        serviceDate: serviceData.serviceDate || '',
        serviceTime: serviceData.serviceTime || '10:00',
        serviceType: serviceData.serviceType || 'funeral',
        serviceLocation: serviceData.serviceLocation || '',
        eulogists: [],
        musicians: [],
        pallbearers: [],
        honoraryPallbearers: [],
        selectedHymns: [],
        selectedScriptures: [],
        status: 'planning',
        checklist: defaultChecklist.map((item, index) => ({
          ...item,
          id: `checklist-${Date.now()}-${index}`,
        })),
        honorariumPaid: false,
        notes: serviceData.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...serviceData,
      };
      setServices(prev => [...prev, newService]);

      // Add to calendar if handler provided
      if (onAddEvent && serviceData.serviceDate) {
        onAddEvent({
          title: `${serviceData.deceasedName} - ${serviceTypeLabels[serviceData.serviceType || 'funeral']}`,
          startDate: serviceData.serviceDate,
          category: 'funeral',
          description: `Service for ${serviceData.deceasedName} at ${serviceData.serviceLocation}`,
          location: serviceData.serviceLocation,
          allDay: false,
        });
      }
    }
    setShowForm(false);
    setEditingService(null);
  };

  const handleToggleChecklistItem = (serviceId: string, itemId: string) => {
    setServices(prev => prev.map(s => {
      if (s.id !== serviceId) return s;
      return {
        ...s,
        checklist: s.checklist.map(item =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        ),
        updatedAt: new Date().toISOString(),
      };
    }));
    if (selectedService?.id === serviceId) {
      setSelectedService(prev => {
        if (!prev) return null;
        return {
          ...prev,
          checklist: prev.checklist.map(item =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getChecklistProgress = (service: FuneralService) => {
    const completed = service.checklist.filter(item => item.completed).length;
    return { completed, total: service.checklist.length, percent: Math.round((completed / service.checklist.length) * 100) };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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
          <div className="p-2 bg-stone-100 dark:bg-stone-500/15 rounded-xl">
            <Flower2 className="w-6 h-6 text-stone-600 dark:text-stone-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Funeral & Memorial Services</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage funeral services and memorial planning
            </p>
          </div>
        </div>
        <button
          onClick={handleAddService}
          className="flex items-center gap-2 px-4 py-2 bg-stone-600 text-white rounded-xl hover:bg-stone-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Service
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-stone-600">{upcomingServices.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-amber-600">
            {services.filter(s => s.status === 'planning').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In Planning</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600">
            {services.filter(s => s.status === 'completed').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">
            {services.filter(s => s.wasMember).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Church Members</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FuneralService['status'] | 'all')}
            className="pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none"
          >
            <option value="all">All Status</option>
            <option value="inquiry">Inquiry</option>
            <option value="planning">Planning</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service List */}
        <div className="lg:col-span-1 space-y-3">
          {filteredServices.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <Flower2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">No services found</p>
              <button
                onClick={handleAddService}
                className="text-stone-600 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 font-medium"
              >
                Add your first service
              </button>
            </div>
          ) : (
            filteredServices.map(service => {
              const progress = getChecklistProgress(service);
              const isSelected = selectedService?.id === service.id;
              return (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl p-4 border transition-all ${
                    isSelected
                      ? 'border-stone-500 ring-2 ring-stone-500/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-stone-300 dark:hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{service.deceasedName}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[service.status].bg} ${statusColors[service.status].text}`}>
                      {statusColors[service.status].label}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(service.serviceDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Church className="w-3.5 h-3.5" />
                      <span className="truncate">{serviceTypeLabels[service.serviceType]}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="truncate">{service.primaryContactName} ({service.primaryContactRelation})</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">Checklist</span>
                      <span className="text-gray-500 dark:text-gray-400">{progress.completed}/{progress.total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-500 rounded-full transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Service Details */}
        <div className="lg:col-span-2">
          {selectedService ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Detail Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-900/20 dark:to-stone-800/20">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedService.deceasedName}</h2>
                      {selectedService.wasMember && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                          Church Member
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{serviceTypeLabels[selectedService.serviceType]}</p>
                    {selectedService.dateOfBirth && selectedService.dateOfDeath && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(selectedService.dateOfBirth).toLocaleDateString()} - {new Date(selectedService.dateOfDeath).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${statusColors[selectedService.status].bg} ${statusColors[selectedService.status].text}`}>
                      {statusColors[selectedService.status].label}
                    </span>
                    <button
                      onClick={() => handleEditService(selectedService)}
                      className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail Content */}
              <div className="p-6 space-y-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Service Details Section */}
                <div>
                  <button
                    onClick={() => toggleSection('details')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Service Details
                    </h3>
                    {expandedSections.details ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.details && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Service Date & Time</span>
                          <p className="text-gray-900 dark:text-white font-medium">{formatDate(selectedService.serviceDate)}</p>
                          <p className="text-gray-700 dark:text-gray-300">{selectedService.serviceTime}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Location</span>
                          <p className="text-gray-900 dark:text-white font-medium">{selectedService.serviceLocation}</p>
                          {selectedService.serviceAddress && (
                            <p className="text-gray-600 dark:text-gray-400">{selectedService.serviceAddress}</p>
                          )}
                        </div>
                        {selectedService.wakeDate && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Wake/Visitation</span>
                            <p className="text-gray-900 dark:text-white">{new Date(selectedService.wakeDate).toLocaleDateString()} at {selectedService.wakeTime}</p>
                            {selectedService.wakeLocation && (
                              <p className="text-gray-600 dark:text-gray-400">{selectedService.wakeLocation}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Primary Contact</span>
                          <p className="text-gray-900 dark:text-white font-medium">{selectedService.primaryContactName}</p>
                          <p className="text-gray-600 dark:text-gray-400">{selectedService.primaryContactRelation}</p>
                          {selectedService.primaryContactPhone && (
                            <p className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Phone className="w-3 h-3" /> {selectedService.primaryContactPhone}
                            </p>
                          )}
                          {selectedService.primaryContactEmail && (
                            <p className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Mail className="w-3 h-3" /> {selectedService.primaryContactEmail}
                            </p>
                          )}
                        </div>
                        {selectedService.officiantName && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Officiant</span>
                            <p className="text-gray-900 dark:text-white">{selectedService.officiantName}</p>
                          </div>
                        )}
                        {selectedService.cemeteryName && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Cemetery</span>
                            <p className="text-gray-900 dark:text-white">{selectedService.cemeteryName}</p>
                            {selectedService.cemeteryAddress && (
                              <p className="text-gray-600 dark:text-gray-400">{selectedService.cemeteryAddress}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Checklist Section */}
                <div>
                  <button
                    onClick={() => toggleSection('checklist')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Planning Checklist
                    </h3>
                    {expandedSections.checklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.checklist && (
                    <div className="space-y-4">
                      {(['planning', 'service', 'family', 'reception', 'paperwork'] as const).map(category => {
                        const items = selectedService.checklist.filter(item => item.category === category);
                        if (items.length === 0) return null;
                        const completed = items.filter(i => i.completed).length;
                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{category}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{completed}/{items.length}</span>
                            </div>
                            <div className="space-y-1">
                              {items.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => handleToggleChecklistItem(selectedService.id, item.id)}
                                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                  {item.completed ? (
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                                  )}
                                  <span className={`text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {item.task}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Participants Section */}
                <div>
                  <button
                    onClick={() => toggleSection('participants')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Participants
                    </h3>
                    {expandedSections.participants ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.participants && (
                    <div className="space-y-4">
                      {selectedService.eulogists.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Eulogists</span>
                          <div className="mt-2 space-y-2">
                            {selectedService.eulogists.map(eulogist => (
                              <div key={eulogist.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{eulogist.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{eulogist.relation}</p>
                                </div>
                                {eulogist.confirmed && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400">
                                    Confirmed
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedService.pallbearers.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pallbearers</span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedService.pallbearers.map(pb => (
                              <span key={pb.id} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">
                                {pb.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedService.musicians.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Musicians</span>
                          <div className="mt-2 space-y-2">
                            {selectedService.musicians.map(musician => (
                              <div key={musician.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <Music className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900 dark:text-white">{musician.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">({musician.role})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedService.eulogists.length === 0 && selectedService.pallbearers.length === 0 && selectedService.musicians.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No participants added yet</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Music & Scripture Section */}
                <div>
                  <button
                    onClick={() => toggleSection('music')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Music & Scripture
                    </h3>
                    {expandedSections.music ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.music && (
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hymns</span>
                        {selectedService.selectedHymns.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedService.selectedHymns.map((hymn, i) => (
                              <span key={i} className="px-2 py-1 bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 rounded text-sm">
                                {hymn}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">No hymns selected</p>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Scripture Readings</span>
                        {selectedService.selectedScriptures.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {selectedService.selectedScriptures.map((scripture, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <FileText className="w-3 h-3 text-gray-400" />
                                {scripture}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">No scripture readings selected</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes Section */}
                <div>
                  <button
                    onClick={() => toggleSection('notes')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Notes
                    </h3>
                    {expandedSections.notes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.notes && (
                    <div className="space-y-3">
                      {selectedService.notes ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedService.notes}</p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No notes added</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Flower2 className="w-16 h-16 mx-auto text-gray-200 dark:text-gray-700 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Service Selected</h3>
              <p className="text-gray-500 dark:text-gray-400">Select a service from the list to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Funeral Form Modal */}
      {showForm && (
        <FuneralFormModal
          service={editingService}
          people={_people}
          onSave={handleSaveService}
          onClose={() => {
            setShowForm(false);
            setEditingService(null);
          }}
        />
      )}
    </div>
  );
}

// Funeral Form Modal Component
function FuneralFormModal({
  service,
  people: _people,
  onSave,
  onClose,
}: {
  service: FuneralService | null;
  people: Person[];
  onSave: (data: Partial<FuneralService>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    deceasedName: service?.deceasedName || '',
    dateOfBirth: service?.dateOfBirth || '',
    dateOfDeath: service?.dateOfDeath || '',
    wasMember: service?.wasMember || false,
    primaryContactName: service?.primaryContactName || '',
    primaryContactRelation: service?.primaryContactRelation || '',
    primaryContactPhone: service?.primaryContactPhone || '',
    primaryContactEmail: service?.primaryContactEmail || '',
    serviceDate: service?.serviceDate || '',
    serviceTime: service?.serviceTime || '10:00',
    serviceType: service?.serviceType || 'funeral',
    serviceLocation: service?.serviceLocation || '',
    serviceAddress: service?.serviceAddress || '',
    wakeDate: service?.wakeDate || '',
    wakeTime: service?.wakeTime || '18:00',
    wakeLocation: service?.wakeLocation || '',
    cemeteryName: service?.cemeteryName || '',
    officiantName: service?.officiantName || '',
    funeralHome: service?.funeralHome || '',
    status: service?.status || 'planning',
    notes: service?.notes || '',
  });

  const [selectedHymns, setSelectedHymns] = useState<string[]>(service?.selectedHymns || []);
  const [selectedScriptures, setSelectedScriptures] = useState<string[]>(service?.selectedScriptures || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      serviceType: formData.serviceType as FuneralService['serviceType'],
      status: formData.status as FuneralService['status'],
      selectedHymns,
      selectedScriptures,
    });
  };

  const toggleHymn = (hymn: string) => {
    setSelectedHymns(prev =>
      prev.includes(hymn) ? prev.filter(h => h !== hymn) : [...prev, hymn]
    );
  };

  const toggleScripture = (scripture: string) => {
    setSelectedScriptures(prev =>
      prev.includes(scripture) ? prev.filter(s => s !== scripture) : [...prev, scripture]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {service ? 'Edit Service' : 'New Funeral/Memorial Service'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Deceased Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Deceased Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.deceasedName}
                  onChange={(e) => setFormData(prev => ({ ...prev, deceasedName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="wasMember"
                  checked={formData.wasMember}
                  onChange={(e) => setFormData(prev => ({ ...prev, wasMember: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="wasMember" className="text-sm text-gray-700 dark:text-gray-300">Church Member</label>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Date of Death *</label>
                <input
                  type="date"
                  value={formData.dateOfDeath}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfDeath: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Primary Contact (Family)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.primaryContactName}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Relation *</label>
                <input
                  type="text"
                  value={formData.primaryContactRelation}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactRelation: e.target.value }))}
                  placeholder="e.g., Spouse, Son, Daughter"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.primaryContactPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.primaryContactEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Service Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service Type *</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value as FuneralService['serviceType'] }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="funeral">Funeral Service</option>
                  <option value="memorial">Memorial Service</option>
                  <option value="graveside">Graveside Service</option>
                  <option value="celebration-of-life">Celebration of Life</option>
                  <option value="private">Private Service</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as FuneralService['status'] }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="inquiry">Inquiry</option>
                  <option value="planning">Planning</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service Date *</label>
                <input
                  type="date"
                  value={formData.serviceDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service Time *</label>
                <input
                  type="time"
                  value={formData.serviceTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service Location *</label>
                <input
                  type="text"
                  value={formData.serviceLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceLocation: e.target.value }))}
                  placeholder="Church name or venue"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Officiant</label>
                <input
                  type="text"
                  value={formData.officiantName}
                  onChange={(e) => setFormData(prev => ({ ...prev, officiantName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Funeral Home</label>
                <input
                  type="text"
                  value={formData.funeralHome}
                  onChange={(e) => setFormData(prev => ({ ...prev, funeralHome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Wake / Visitation */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Wake / Visitation (Optional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.wakeDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, wakeDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.wakeTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, wakeTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.wakeLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, wakeLocation: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Music & Scripture Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Hymns & Scripture</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Select Hymns</label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  {commonHymns.map(hymn => (
                    <label key={hymn} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedHymns.includes(hymn)}
                        onChange={() => toggleHymn(hymn)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{hymn}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Select Scripture</label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  {commonScriptures.map(scripture => (
                    <label key={scripture} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedScriptures.includes(scripture)}
                        onChange={() => toggleScripture(scripture)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{scripture}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Special requests, family preferences, etc."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-stone-600 text-white rounded-lg hover:bg-stone-700 transition-colors"
            >
              {service ? 'Update Service' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

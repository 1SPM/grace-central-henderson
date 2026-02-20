import { useState } from 'react';
import {
  Heart,
  Calendar,
  Users,
  FileText,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Flower2,
  Gift,
  Baby,
  Sparkles,
  Filter,
  LayoutGrid,
  List,
  CheckCircle,
  Circle,
  AlertCircle,
} from 'lucide-react';
import type { View, CalendarEvent, Person, ServiceRequest, ServiceRequestStatus } from '../types';
import { ServiceRequestForm } from './ServiceRequestForm';
import { createLogger } from '../utils/logger';

const log = createLogger('life-services');

interface LifeServicesProps {
  onNavigate: (view: View) => void;
  events?: CalendarEvent[];
  people?: Person[];
}

// Mock data for demonstration
const mockRequests: (ServiceRequest & { typeSpecific?: Record<string, unknown> })[] = [
  {
    id: '1',
    type: 'wedding',
    status: 'consultation',
    title: 'Johnson & Smith Wedding',
    primaryContactName: 'Sarah Johnson',
    primaryContactEmail: 'sarah@example.com',
    primaryContactPhone: '555-1234',
    requestedDate: '2026-06-15',
    location: 'Main Sanctuary',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-20T14:00:00Z',
  },
  {
    id: '2',
    type: 'funeral',
    status: 'scheduled',
    title: 'Memorial - Margaret Williams',
    primaryContactName: 'Robert Williams',
    primaryContactEmail: 'rwilliams@example.com',
    primaryContactPhone: '555-5678',
    scheduledDate: '2026-02-08',
    location: 'Chapel',
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-02T11:00:00Z',
  },
  {
    id: '3',
    type: 'baptism',
    status: 'inquiry',
    title: 'Baptism - Michael Torres',
    primaryContactName: 'Michael Torres',
    primaryContactEmail: 'mtorres@example.com',
    primaryContactPhone: '555-9012',
    requestedDate: '2026-02-22',
    createdAt: '2026-02-03T08:00:00Z',
    updatedAt: '2026-02-03T08:00:00Z',
  },
  {
    id: '4',
    type: 'wedding',
    status: 'in-progress',
    title: 'Davis & Chen Wedding',
    primaryContactName: 'Emily Davis',
    primaryContactEmail: 'emily@example.com',
    primaryContactPhone: '555-3456',
    scheduledDate: '2026-03-20',
    location: 'Outdoor Garden',
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2026-02-01T16:00:00Z',
  },
  {
    id: '5',
    type: 'dedication',
    status: 'scheduled',
    title: 'Baby Dedication - Garcia Family',
    primaryContactName: 'Maria Garcia',
    primaryContactEmail: 'mgarcia@example.com',
    primaryContactPhone: '555-7890',
    scheduledDate: '2026-02-16',
    location: 'Main Sanctuary',
    createdAt: '2026-01-25T14:00:00Z',
    updatedAt: '2026-01-28T09:00:00Z',
  },
];

const mockUpcomingEvents = [
  { id: '1', type: 'wedding', title: 'Johnson & Smith Wedding', date: '2026-02-14', location: 'Main Sanctuary' },
  { id: '2', type: 'funeral', title: 'Memorial Service - Margaret Williams', date: '2026-02-08', location: 'Chapel' },
  { id: '3', type: 'baptism', title: 'Baptism Service', date: '2026-02-15', location: 'Main Sanctuary' },
  { id: '4', type: 'dedication', title: 'Baby Dedication - Garcia Family', date: '2026-02-22', location: 'Main Sanctuary' },
];

const serviceCards = [
  {
    id: 'wedding-services',
    title: 'Weddings & Ceremonies',
    description: 'Plan and manage wedding ceremonies, rehearsals, and pre-marital counseling',
    icon: Heart,
    color: 'rose',
    stats: { label: 'Upcoming', value: 3 },
  },
  {
    id: 'funeral-services',
    title: 'Funerals & Memorials',
    description: 'Coordinate funeral services, memorial planning, and family support',
    icon: Flower2,
    color: 'purple',
    stats: { label: 'This Month', value: 1 },
  },
  {
    id: 'estate-planning',
    title: 'Legacy Giving',
    description: 'Estate planning, planned gifts, and legacy donation management',
    icon: Gift,
    color: 'amber',
    stats: { label: 'Planned Gifts', value: 12 },
  },
];

const pipelineStages: { status: ServiceRequestStatus; label: string; color: string }[] = [
  { status: 'inquiry', label: 'Inquiry', color: 'gray' },
  { status: 'consultation', label: 'Consultation', color: 'blue' },
  { status: 'scheduled', label: 'Scheduled', color: 'amber' },
  { status: 'in-progress', label: 'In Progress', color: 'violet' },
  { status: 'completed', label: 'Completed', color: 'green' },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'wedding': return Heart;
    case 'funeral': return Flower2;
    case 'baptism': return Sparkles;
    case 'dedication': return Baby;
    default: return Calendar;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'wedding': return 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20';
    case 'funeral': return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20';
    case 'baptism': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
    case 'dedication': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20';
    default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
  }
};

const getStatusIcon = (status: ServiceRequestStatus) => {
  switch (status) {
    case 'completed': return CheckCircle;
    case 'in-progress': return AlertCircle;
    default: return Circle;
  }
};

export function LifeServices({ onNavigate, events = [], people = [] }: LifeServicesProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'pipeline' | 'list'>('cards');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [requests] = useState(mockRequests);
  const [upcomingEvents] = useState(mockUpcomingEvents);

  const filteredRequests = filterType === 'all'
    ? requests
    : requests.filter(r => r.type === filterType);

  const getRequestsByStatus = (status: ServiceRequestStatus) =>
    filteredRequests.filter(r => r.status === status);

  const handleSubmitRequest = (data: unknown) => {
    log.info('New service request', data);
    // In a real app, this would save to the database
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Life Services</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            Manage weddings, funerals, baptisms, and legacy giving
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-dark-700 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
              title="Cards view"
            >
              <LayoutGrid size={18} className="text-gray-600 dark:text-dark-400" />
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'pipeline'
                  ? 'bg-white dark:bg-dark-700 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
              title="Pipeline view"
            >
              <Filter size={18} className="text-gray-600 dark:text-dark-400" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-dark-700 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
              title="List view"
            >
              <List size={18} className="text-gray-600 dark:text-dark-400" />
            </button>
          </div>

          <button
            onClick={() => setShowRequestForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Plus size={18} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Cards View - Service Categories */}
      {viewMode === 'cards' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {serviceCards.map((card) => {
              const Icon = card.icon;
              const colorClasses = {
                rose: 'from-rose-500 to-pink-600',
                purple: 'from-purple-500 to-violet-600',
                amber: 'from-amber-500 to-orange-600',
              }[card.color];

              return (
                <button
                  key={card.id}
                  onClick={() => onNavigate(card.id as View)}
                  className="group bg-white dark:bg-dark-850 rounded-xl p-5 text-left shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-dark-700 hover:border-gray-200 dark:hover:border-dark-600"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-dark-100">{card.stats.value}</div>
                      <div className="text-xs text-gray-500 dark:text-dark-400">{card.stats.label}</div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400 mb-3">
                    {card.description}
                  </p>
                  <div className="flex items-center text-sm text-violet-600 dark:text-violet-400 font-medium">
                    <span>Manage</span>
                    <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Upcoming Events & Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Events */}
            <div className="lg:col-span-2 bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
              <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
                  <Calendar size={18} className="text-violet-600" />
                  Upcoming Life Events
                </h2>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                >
                  View Calendar
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {upcomingEvents.map((event) => {
                  const Icon = getTypeIcon(event.type);
                  const colorClass = getTypeColor(event.type);

                  return (
                    <div
                      key={event.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-dark-100 truncate">
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-dark-400">
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {new Date(event.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {event.location}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 dark:text-dark-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
              <div className="p-4 border-b border-gray-100 dark:border-dark-700">
                <h2 className="font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-violet-600" />
                  Quick Actions
                </h2>
              </div>
              <div className="p-2">
                {[
                  { label: 'Schedule Wedding Consultation', icon: Heart, type: 'wedding' },
                  { label: 'Plan Memorial Service', icon: Flower2, type: 'funeral' },
                  { label: 'Request Baptism', icon: Sparkles, type: 'baptism' },
                  { label: 'Baby Dedication', icon: Baby, type: 'dedication' },
                  { label: 'Record Planned Gift', icon: Gift, view: 'estate-planning' },
                ].map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => action.view ? onNavigate(action.view as View) : setShowRequestForm(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                        <Icon size={16} className="text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-dark-300">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pipeline View */}
      {viewMode === 'pipeline' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 dark:text-dark-400">Filter:</span>
            {['all', 'wedding', 'funeral', 'baptism', 'dedication'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:bg-gray-200 dark:hover:bg-dark-700'
                }`}
              >
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Pipeline columns */}
          <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
            {pipelineStages.filter(s => s.status !== 'completed').map((stage) => {
              const stageRequests = getRequestsByStatus(stage.status);
              const colorClass = {
                gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
                blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
                green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
              }[stage.color];

              return (
                <div key={stage.status} className="min-w-[240px]">
                  <div className={`px-3 py-2 rounded-lg ${colorClass} mb-3`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{stage.label}</span>
                      <span className="text-xs font-bold">{stageRequests.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stageRequests.map((request) => {
                      const Icon = getTypeIcon(request.type);
                      const typeColor = getTypeColor(request.type);

                      return (
                        <div
                          key={request.id}
                          className="bg-white dark:bg-dark-850 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-dark-700 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor}`}>
                              <Icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-sm text-gray-900 dark:text-dark-100 truncate">
                                {request.title}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
                                {request.primaryContactName}
                              </p>
                            </div>
                          </div>
                          {(request.requestedDate || request.scheduledDate) && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-dark-400">
                              <Calendar size={12} />
                              {new Date(request.scheduledDate || request.requestedDate || '').toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {stageRequests.length === 0 && (
                      <div className="text-center py-8 text-gray-400 dark:text-dark-500 text-sm">
                        No requests
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
          {/* Filter bar */}
          <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 dark:text-dark-400">Filter:</span>
            {['all', 'wedding', 'funeral', 'baptism', 'dedication'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:bg-gray-200 dark:hover:bg-dark-700'
                }`}
              >
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                    Request
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {filteredRequests.map((request) => {
                  const Icon = getTypeIcon(request.type);
                  const typeColor = getTypeColor(request.type);
                  const StatusIcon = getStatusIcon(request.status);
                  const stage = pipelineStages.find(s => s.status === request.status);

                  return (
                    <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColor}`}>
                            <Icon size={16} />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-dark-100">
                            {request.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-dark-400 capitalize">
                        {request.type}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-dark-100">
                          {request.primaryContactName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-dark-400">
                          {request.primaryContactEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-dark-400">
                        {request.scheduledDate || request.requestedDate
                          ? new Date(request.scheduledDate || request.requestedDate || '').toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          stage?.color === 'gray' ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' :
                          stage?.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          stage?.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                          stage?.color === 'violet' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' :
                          'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          <StatusIcon size={12} />
                          {stage?.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resources & Forms */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-violet-100 dark:border-violet-800/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white dark:bg-dark-800 rounded-xl flex items-center justify-center shadow-sm">
            <FileText className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1">
              Forms & Resources
            </h3>
            <p className="text-sm text-gray-600 dark:text-dark-400 mb-4">
              Access wedding applications, funeral planning guides, and legacy giving information packets.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Wedding Application
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Funeral Planning Guide
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Legacy Giving Packet
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Baptism Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
              <Heart size={18} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">24</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Weddings This Year</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Flower2 size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">8</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Memorial Services</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Users size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">45</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Baptisms</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Gift size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">$125K</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Planned Gifts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Request Form Modal */}
      {showRequestForm && (
        <ServiceRequestForm
          onClose={() => setShowRequestForm(false)}
          onSubmit={handleSubmitRequest}
          people={people}
          events={events}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { Users, Radio } from 'lucide-react';
import { CommunityFeed } from './CommunityFeed';
import { ConnectionsSidebar } from './ConnectionsSidebar';
import { useCommunityFeed } from '../../../hooks/useCommunityFeed';
import { useMemberConnections } from '../../../hooks/useMemberConnections';
import type { Person, SmallGroup, CalendarEvent } from '../../../types';

type ConnectTab = 'community' | 'groups-events' | 'people';

interface ConnectCommunityPageProps {
  churchId?: string;
  churchName?: string;
  people: Person[];
  groups: SmallGroup[];
  events: CalendarEvent[];
  currentMember?: Person | null;
  onNavigateDirectory?: () => void;
}

export function ConnectCommunityPage({
  churchId,
  churchName = 'Grace Church',
  people,
  groups,
  events,
  currentMember,
  onNavigateDirectory,
}: ConnectCommunityPageProps) {
  const [activeTab, setActiveTab] = useState<ConnectTab>('community');
  const currentPersonId = currentMember?.id;
  const memberGroupIds = currentMember?.smallGroups ?? [];

  const feed = useCommunityFeed(churchId ?? 'demo', people, currentPersonId);
  const connections = useMemberConnections(churchId ?? 'demo', people, currentPersonId);

  const activeGroups = groups.filter(g => g.isActive);
  const statsBar = [
    { label: 'GROUPS', value: activeGroups.length },
    { label: 'ACTIVE IN THE LAST WEEK', value: feed.posts.length > 0 ? Math.min(people.length, 6) : 0 },
    { label: 'CONNECTIONS', value: connections.connectionCount },
    { label: 'NEW REQUESTS', value: connections.requests.length },
  ];

  const title = churchName.toLowerCase().includes('henderson')
    ? 'Connect at Central'
    : `Connect at ${churchName.split(' ')[0]}`;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-dark-900">
      {/* Hero header */}
      <div className="relative bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-900 text-white px-4 pt-6 pb-16">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold serif leading-tight">{title}</h1>
            <p className="text-sm text-white/70 mt-1">
              Groups, events, prayer, and more with clear privacy boundaries.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/90 rounded-full text-[10px] font-semibold shrink-0">
            <Radio size={10} className="animate-pulse" />
            LIVE
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {statsBar.map(s => (
            <div key={s.label} className="bg-black/30 backdrop-blur rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-[9px] uppercase tracking-wider text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 px-4 -mt-8">
        <div className="bg-white dark:bg-dark-850 rounded-t-2xl border border-b-0 border-gray-200 dark:border-dark-700 flex">
          {([
            { id: 'community' as const, label: 'Community' },
            { id: 'groups-events' as const, label: 'Groups & Events' },
            { id: 'people' as const, label: 'People' },
          ]).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'people') onNavigateDirectory?.();
              }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                  : 'text-gray-500 dark:text-dark-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-6xl mx-auto">
        {activeTab === 'community' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <CommunityFeed
                posts={feed.posts}
                filter={feed.filter}
                onFilterChange={feed.setFilter}
                isLoading={feed.isLoading}
                groups={groups}
                memberGroupIds={memberGroupIds}
                currentPersonId={currentPersonId}
                onSubmitPost={feed.submitPost}
                onReact={feed.react}
                onComment={feed.comment}
              />
            </div>
            <div className="hidden lg:block">
              <ConnectionsSidebar
                people={people}
                connections={connections.connections}
                requests={connections.requests}
                groups={groups}
                events={events}
                currentPersonId={currentPersonId}
                onAcceptRequest={id => void connections.accept(id)}
              />
            </div>
          </div>
        )}

        {activeTab === 'groups-events' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <Users size={18} />
              Your Groups
            </h2>
            {activeGroups.map(g => (
              <div key={g.id} className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-dark-100">{g.name}</h3>
                {g.description && <p className="text-sm text-gray-500 mt-1">{g.description}</p>}
                <p className="text-xs text-gray-400 mt-2">{g.members.length} members</p>
              </div>
            ))}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-6">Upcoming Events</h2>
            {events.filter(e => new Date(e.startDate) >= new Date()).slice(0, 5).map(e => (
              <div key={e.id} className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
                <p className="font-medium text-gray-900 dark:text-dark-100">{e.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(e.startDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'people' && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-3">Browse and connect with members in the directory.</p>
            <button
              type="button"
              onClick={onNavigateDirectory}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
            >
              Open Directory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

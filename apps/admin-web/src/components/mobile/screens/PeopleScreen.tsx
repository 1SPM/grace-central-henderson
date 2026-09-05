import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import type { Person, PrayerRequest, Task, View } from '../../../types';
import { deriveFollowUps, deriveNewPeople } from '../../../lib/mobileAttention';
import { muted } from '../ui/mobileTheme';
import { EmptyCard } from '../ui/MobileCard';
import { SectionLabel } from '../ui/SectionLabel';
import { AvatarRow } from '../ui/AvatarRow';
import { Chips, type ChipOption } from '../ui/Chips';
import { agoLabel, shortName } from '../ui/mobileFormat';

interface PeopleScreenProps {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  onNavigate: (view: View) => void;
}

type Segment = 'all' | 'new' | 'follow-up' | 'members' | 'team';

const ALL_PEOPLE_CAP = 20;

export function PeopleScreen({ people, tasks, prayers, onNavigate }: PeopleScreenProps) {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const now = useMemo(() => new Date(), []);

  const followUps = useMemo(() => deriveFollowUps(people, tasks, prayers, now), [people, tasks, prayers, now]);
  const newPeople = useMemo(() => deriveNewPeople(people, tasks, now), [people, tasks, now]);

  const q = query.trim().toLowerCase();
  const matches = (person: Person) => !q || shortName(person).toLowerCase().includes(q);

  const members = people.filter((p) => p.status === 'member');
  const team = people.filter((p) => p.status === 'leader');

  const chips: ChipOption<Segment>[] = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'New', badge: newPeople.count },
    { id: 'follow-up', label: 'Follow-up', badge: followUps.length },
    { id: 'members', label: 'Members' },
    { id: 'team', label: 'Team' },
  ];

  const visibleFollowUps = followUps.filter((f) => matches(f.person));
  const visibleFamilies = newPeople.families.filter((f) => f.members.some(matches) || (!q ? true : false));
  const visibleIndividuals = newPeople.individuals.filter((i) => matches(i.person));
  const listFor = (source: Person[]) => source.filter(matches).slice(0, ALL_PEOPLE_CAP);

  const showFollowUps = segment === 'all' || segment === 'follow-up';
  const showNew = segment === 'all' || segment === 'new';
  const showAll = segment === 'all' || segment === 'members' || segment === 'team';
  const allSource = segment === 'members' ? members : segment === 'team' ? team : people;
  const allLabel = segment === 'members' ? 'Members' : segment === 'team' ? 'Team' : 'All people';
  const visibleAll = listFor(allSource);

  const openDirectory = () => onNavigate('people');

  return (
    <div className="px-4 pt-5 pb-6 space-y-4 min-h-full bg-[#070b14]">
      {/* Search */}
      <div className="flex items-center gap-2">
        <label className="h-11 flex-1 rounded-2xl border border-white/[0.09] bg-white/[0.05] px-3 flex items-center gap-2">
          <Search size={17} className="text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people..."
            className="min-w-0 flex-1 bg-transparent border-0 text-sm text-slate-100 placeholder:text-slate-500 focus:ring-0"
          />
        </label>
        <button
          type="button"
          onClick={openDirectory}
          className="w-11 h-11 grid place-items-center rounded-2xl bg-violet-500/15 text-violet-300 shrink-0"
          aria-label="Add person"
        >
          <UserPlus size={19} />
        </button>
      </div>

      {/* Segments */}
      <Chips options={chips} selected={segment} onSelect={setSegment} />

      {/* Needs follow-up */}
      {showFollowUps && (
        <div className="space-y-2">
          <SectionLabel>Needs follow-up</SectionLabel>
          {visibleFollowUps.length > 0 ? (
            visibleFollowUps.map((item) => (
              <AvatarRow
                key={item.person.id}
                person={item.person}
                subtitle={`${item.reason} · ${agoLabel(item.ageDays)}`}
                dot="attention"
                onClick={openDirectory}
              />
            ))
          ) : (
            <EmptyCard>No one is waiting on a follow-up.</EmptyCard>
          )}
        </div>
      )}

      {/* New people */}
      {showNew && (
        <div className="space-y-2">
          <SectionLabel>New people</SectionLabel>
          {visibleFamilies.length === 0 && visibleIndividuals.length === 0 ? (
            <EmptyCard>No first-time visitors in the last 7 days.</EmptyCard>
          ) : (
            <>
              {visibleFamilies.map((family) => (
                <AvatarRow
                  key={family.familyId}
                  title={family.label}
                  subtitle={`Joined ${agoLabel(family.joinedDaysAgo)}${family.hasFollowUp ? '' : ' · No follow-up yet'}`}
                  dot="ok"
                  onClick={openDirectory}
                />
              ))}
              {visibleIndividuals.map((item) => (
                <AvatarRow
                  key={item.person.id}
                  person={item.person}
                  subtitle={`Joined ${agoLabel(item.joinedDaysAgo)}${item.hasFollowUp ? '' : ' · No follow-up yet'}`}
                  dot="ok"
                  onClick={openDirectory}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* All people / members / team */}
      {showAll && (
        <div className="space-y-2">
          <SectionLabel>{allLabel}</SectionLabel>
          {visibleAll.length > 0 ? (
            <>
              {visibleAll.map((person) => (
                <AvatarRow
                  key={person.id}
                  person={person}
                  subtitle={<span className="capitalize">{person.status}</span>}
                  onClick={openDirectory}
                />
              ))}
              {allSource.length > ALL_PEOPLE_CAP && !q && (
                <button type="button" onClick={openDirectory} className={`w-full text-center text-xs py-2 ${muted}`}>
                  View all {allSource.length} in the directory
                </button>
              )}
            </>
          ) : (
            <EmptyCard>No people match that search.</EmptyCard>
          )}
        </div>
      )}
    </div>
  );
}

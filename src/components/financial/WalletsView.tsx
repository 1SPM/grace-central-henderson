import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  CreditCard,
  Loader2,
  Search,
} from 'lucide-react';
import type { Person } from '../../types';
import {
  buildMemberAccountRows,
  fmtImpactUsd,
  useImpactCardProgram,
  type MemberAccountRow,
} from '../../hooks/useImpactCardProgram';
import { CardProgramSection } from './CardProgramSection';
import { MemberWalletDetail } from './MemberWalletDetail';

interface WalletsViewProps {
  people: Person[];
}

function kycBadge(status: MemberAccountRow['kycStatus']) {
  if (status === 'approved') {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <BadgeCheck size={10} /> KYC
      </span>
    );
  }
  if (status === 'none') {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-400">
        Not enrolled
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 capitalize">
      KYC {status.replace('_', ' ')}
    </span>
  );
}

export function WalletsView({ people }: WalletsViewProps) {
  const program = useImpactCardProgram();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const accountRows = useMemo(() => {
    if (!program.data) return [];
    return buildMemberAccountRows(people, program.data);
  }, [people, program.data]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accountRows
      .filter(row => !q || `${row.person.firstName} ${row.person.lastName}`.toLowerCase().includes(q))
      .sort((a, b) => `${a.person.lastName}${a.person.firstName}`.localeCompare(`${b.person.lastName}${b.person.firstName}`));
  }, [accountRows, search]);

  const selected = selectedId ? people.find(p => p.id === selectedId) : null;

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await program.refetch();
    } finally {
      setBusyId(null);
    }
  };

  if (selected && program.data) {
    return (
      <MemberWalletDetail
        person={selected}
        adminData={program.data}
        onBack={() => setSelectedId(null)}
        onRefresh={program.refetch}
        busyId={busyId}
        withBusy={withBusy}
      />
    );
  }

  const summary = program.data?.summary;
  const kycApproved = accountRows.filter(r => r.kycStatus === 'approved').length;
  const withCards = accountRows.filter(r => r.cards.length > 0).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Impact Card Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1.5">
            GRACE Impact Card accounts — i2c merchant program, KYC, card usage, and interchange revenue
          </p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800 text-gray-700 dark:text-dark-300 focus:outline-none focus:ring-2 focus:ring-slate-400 w-64"
          />
        </div>
      </div>

      {program.state === 'loading' && (
        <div className="py-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {program.state === 'gated' && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-5 text-sm text-indigo-800 dark:text-indigo-300 mb-6">
          {program.gateMessage || 'The GRACE Impact Card program requires the Enterprise plan.'}
        </div>
      )}

      {program.state === 'ready' && program.data && (
        <>
          <CardProgramSection program={program} embedded />

          <div className="mt-10 mb-4">
            <h2 className="serif text-xl text-slate-900 dark:text-dark-100 leading-none">Member accounts</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Per-member card status, spend, and compliance
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow">Active cards</p>
              <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">
                {summary?.active_cards ?? 0}
              </p>
            </div>
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow">KYC approved</p>
              <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">
                {kycApproved}<span className="text-sm text-gray-400 dark:text-dark-500"> / {withCards || people.length}</span>
              </p>
            </div>
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow">Card spend (MTD)</p>
              <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">
                {fmtImpactUsd(summary?.spend_mtd_micro_usd ?? 0)}
              </p>
            </div>
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow">Interchange (MTD)</p>
              <p className="stat-number text-2xl text-emerald-700 dark:text-emerald-400 mt-1.5">
                {fmtImpactUsd(summary?.interchange_mtd_micro_usd ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            {filteredRows.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard size={28} className="mx-auto text-gray-300 dark:text-dark-600 mb-2" />
                <p className="text-sm text-gray-400 dark:text-dark-500">No members match your search</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {filteredRows.map(row => (
                  <button
                    key={row.person.id}
                    onClick={() => setSelectedId(row.person.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left"
                  >
                    <div className="w-9 h-9 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-300 flex-shrink-0">
                      {row.person.firstName[0]}{row.person.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                          {row.person.firstName} {row.person.lastName}
                        </p>
                        {kycBadge(row.kycStatus)}
                        {row.cardStatus !== 'none' && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 capitalize">
                            {row.cardStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-dark-500 truncate">
                        {row.cards.length > 0
                          ? row.cards.map(c => c.masked_pan).join(' · ')
                          : row.person.email || 'No card issued'}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                        {fmtImpactUsd(row.mtdSpendMicroUsd)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-dark-500">MTD spend</p>
                    </div>
                    <div className="hidden md:block text-right flex-shrink-0 w-28">
                      <p className="text-[11px] text-gray-500 dark:text-dark-400">
                        {row.lastActivityAt
                          ? new Date(row.lastActivityAt).toLocaleDateString()
                          : '—'}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-dark-500">Last activity</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { BadgeCheck, ChevronRight, CreditCard, Search, Wallet } from 'lucide-react';
import type { Person } from '../../types';
import { getDemoWallet } from './demoWallets';
import { MemberWalletDetail } from './MemberWalletDetail';

interface WalletsViewProps {
  people: Person[];
}

export function WalletsView({ people }: WalletsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const members = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people
      .filter(p => p.status !== 'inactive')
      .filter(p => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  }, [people, search]);

  const selected = selectedId ? people.find(p => p.id === selectedId) : null;

  if (selected) {
    return <MemberWalletDetail person={selected} onBack={() => setSelectedId(null)} />;
  }

  const totals = members.reduce(
    (acc, p) => {
      const w = getDemoWallet(p);
      acc.balance += w.balance;
      acc.kyc += w.kycApproved ? 1 : 0;
      return acc;
    },
    { balance: 0, kyc: 0 },
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Member Wallets</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1.5">
            GRACE Impact Card accounts, balances, and compliance
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

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow">Wallets</p>
          <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{members.length}</p>
        </div>
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow">Total balances</p>
          <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">
            ${totals.balance.toLocaleString()}
          </p>
        </div>
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow">KYC approved</p>
          <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">
            {totals.kyc}<span className="text-sm text-gray-400 dark:text-dark-500"> / {members.length}</span>
          </p>
        </div>
      </div>

      {/* Member list */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        {members.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet size={28} className="mx-auto text-gray-300 dark:text-dark-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-dark-500">No members match your search</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {members.map(person => {
              const wallet = getDemoWallet(person);
              return (
                <button
                  key={person.id}
                  onClick={() => setSelectedId(person.id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-300 flex-shrink-0">
                    {person.firstName[0]}{person.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                        {person.firstName} {person.lastName}
                      </p>
                      {wallet.kycApproved ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <BadgeCheck size={10} /> KYC
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          KYC pending
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-dark-500 truncate">{wallet.verusId}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-dark-400 flex-shrink-0">
                    <CreditCard size={12} />
                    {wallet.cards.map(c => `•${c.last4}`).join('  ')}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                      ${wallet.balance.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-dark-500">
                      {wallet.pointsBalance.toLocaleString()} pts
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-dark-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

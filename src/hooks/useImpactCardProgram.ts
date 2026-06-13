import { useCallback, useEffect, useState } from 'react';
import type { Person } from '../types';
import {
  fetchAdminCardProgram,
  microUsdToDollars,
  PlanGateError,
  type AdminCardData,
  type CardAccountRecord,
  type CardRecord,
  type CardTransaction,
  type CardTransferRecord,
  type ImpactRouteRecord,
  type KycRecord,
} from '../lib/services/impactCard';

export type ImpactCardProgramState = 'loading' | 'ready' | 'unavailable' | 'gated';

export interface UseImpactCardProgramResult {
  data: AdminCardData | null;
  state: ImpactCardProgramState;
  gateMessage: string;
  refetch: () => Promise<void>;
}

export type MemberKycStatus = KycRecord['status'] | 'none';

export interface MemberAccountRow {
  person: Person;
  kycStatus: MemberKycStatus;
  cards: CardRecord[];
  account: CardAccountRecord | null;
  impactRoute: ImpactRouteRecord | null;
  mtdSpendMicroUsd: number;
  impactMtdMicroUsd: number;
  balanceMicroUsd: number;
  lastTransferAt: string | null;
  lastActivityAt: string | null;
  hasDeclines: boolean;
  cardStatus: 'none' | CardRecord['status'];
}

/** 1 point earned per $1 of card spend (until a dedicated points ledger exists). */
export const IMPACT_CARD_EARN_RATE = 1;
export const IMPACT_CARD_REDEEM_RATE = 100;

export const IMPACT_ROUTE_OPTIONS = [
  { label: 'Food Pantry', fund: 'benevolence' },
  { label: 'Tithe', fund: 'tithe' },
  { label: 'Missions', fund: 'missions' },
  { label: 'Building Fund', fund: 'building' },
  { label: 'Youth Ministry', fund: 'youth' },
];

export function fmtImpactUsd(micro: number): string {
  return microUsdToDollars(micro).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function spendMicroToEarnedPoints(spendMicroUsd: number): number {
  return Math.round(microUsdToDollars(spendMicroUsd) * IMPACT_CARD_EARN_RATE);
}

export function interchangeMicroToPoolUsd(interchangeMicroUsd: number): number {
  return microUsdToDollars(interchangeMicroUsd);
}

function computeImpactMtd(
  personId: string,
  cardIds: Set<string>,
  events: CardTransaction[],
  allocations: AdminCardData['impact_allocations'],
): number {
  const fromFees = events
    .filter(e => e.event_type === 'fee' && e.direction === 'credit' && e.card_id && cardIds.has(e.card_id))
    .reduce((sum, e) => sum + e.amount_micro_usd, 0);
  if (fromFees > 0) return fromFees;
  const alloc = allocations.find(a => a.person_id === personId);
  return alloc?.amount_micro_usd ?? 0;
}

export function buildMemberAccountRows(people: Person[], adminData: AdminCardData): MemberAccountRow[] {
  const kycByPerson = new Map<string, KycRecord & { person_id: string | null; email: string }>();
  for (const kyc of adminData.kyc_queue) {
    if (!kyc.person_id) continue;
    const existing = kycByPerson.get(kyc.person_id);
    if (!existing || new Date(kyc.submitted_at) > new Date(existing.submitted_at)) {
      kycByPerson.set(kyc.person_id, kyc);
    }
  }

  const cardsByPerson = new Map<string, CardRecord[]>();
  for (const card of adminData.cards) {
    if (!card.cardholder_person_id) continue;
    const list = cardsByPerson.get(card.cardholder_person_id) ?? [];
    list.push(card);
    cardsByPerson.set(card.cardholder_person_id, list);
  }

  const accountsByPerson = new Map<string, CardAccountRecord>();
  for (const account of adminData.accounts ?? []) {
    accountsByPerson.set(account.person_id, account);
  }

  const routesByPerson = new Map<string, ImpactRouteRecord>();
  for (const route of adminData.impact_routes ?? []) {
    routesByPerson.set(route.person_id, route);
  }

  const cardIdsByPerson = new Map<string, Set<string>>();
  for (const [personId, cards] of cardsByPerson) {
    cardIdsByPerson.set(personId, new Set(cards.map(c => c.id)));
  }

  const spendByPerson = new Map<string, number>();
  const lastActivityByPerson = new Map<string, string>();
  const declinesByPerson = new Set<string>();

  for (const event of adminData.interchange_events) {
    if (!event.card_id) continue;
    for (const [personId, cardIds] of cardIdsByPerson) {
      if (!cardIds.has(event.card_id)) continue;
      if (event.event_type === 'capture' && event.direction === 'debit') {
        spendByPerson.set(personId, (spendByPerson.get(personId) ?? 0) + event.amount_micro_usd);
      }
      if (event.event_type === 'declined') {
        declinesByPerson.add(personId);
      }
      const prev = lastActivityByPerson.get(personId);
      if (!prev || event.occurred_at > prev) {
        lastActivityByPerson.set(personId, event.occurred_at);
      }
    }
  }

  const lastTransferByPerson = new Map<string, string>();
  for (const transfer of adminData.transfers ?? []) {
    const prev = lastTransferByPerson.get(transfer.person_id);
    if (!prev || transfer.initiated_at > prev) {
      lastTransferByPerson.set(transfer.person_id, transfer.initiated_at);
    }
  }

  return people
    .filter(p => p.status !== 'inactive')
    .map(person => {
      const kyc = kycByPerson.get(person.id);
      const cards = cardsByPerson.get(person.id) ?? [];
      const cardIds = cardIdsByPerson.get(person.id) ?? new Set<string>();
      const liveCard = cards.find(c => c.status === 'active' || c.status === 'frozen' || c.status === 'pending');
      const account = accountsByPerson.get(person.id) ?? null;
      return {
        person,
        kycStatus: kyc?.status ?? 'none',
        cards,
        account,
        impactRoute: routesByPerson.get(person.id) ?? null,
        mtdSpendMicroUsd: spendByPerson.get(person.id) ?? 0,
        impactMtdMicroUsd: computeImpactMtd(person.id, cardIds, adminData.interchange_events, adminData.impact_allocations ?? []),
        balanceMicroUsd: account?.available_balance_micro_usd ?? 0,
        lastTransferAt: lastTransferByPerson.get(person.id) ?? null,
        lastActivityAt: lastActivityByPerson.get(person.id) ?? null,
        hasDeclines: declinesByPerson.has(person.id),
        cardStatus: liveCard?.status ?? 'none',
      };
    });
}

export function getMemberTransactions(adminData: AdminCardData, personId: string): CardTransaction[] {
  const cardIds = new Set(
    adminData.cards.filter(c => c.cardholder_person_id === personId).map(c => c.id),
  );
  return adminData.interchange_events.filter(e => e.card_id && cardIds.has(e.card_id));
}

export function getMemberCards(adminData: AdminCardData, personId: string): CardRecord[] {
  return adminData.cards.filter(c => c.cardholder_person_id === personId);
}

export function getMemberAccount(adminData: AdminCardData, personId: string): CardAccountRecord | null {
  return (adminData.accounts ?? []).find(a => a.person_id === personId) ?? null;
}

export function getMemberImpactRoute(adminData: AdminCardData, personId: string): ImpactRouteRecord | null {
  return (adminData.impact_routes ?? []).find(r => r.person_id === personId) ?? null;
}

export function getMemberTransfers(adminData: AdminCardData, personId: string): CardTransferRecord[] {
  return (adminData.transfers ?? []).filter(t => t.person_id === personId);
}

export function getMemberImpactMtd(adminData: AdminCardData, personId: string): number {
  const cardIds = new Set(
    adminData.cards.filter(c => c.cardholder_person_id === personId).map(c => c.id),
  );
  return computeImpactMtd(personId, cardIds, adminData.interchange_events, adminData.impact_allocations ?? []);
}

export function useImpactCardProgram(): UseImpactCardProgramResult {
  const [data, setData] = useState<AdminCardData | null>(null);
  const [state, setState] = useState<ImpactCardProgramState>('loading');
  const [gateMessage, setGateMessage] = useState('');

  const refetch = useCallback(async () => {
    try {
      const result = await fetchAdminCardProgram();
      if (result === null) {
        setData(null);
        setState('unavailable');
        return;
      }
      setData({
        ...result,
        accounts: result.accounts ?? [],
        transfers: result.transfers ?? [],
        impact_routes: result.impact_routes ?? [],
        impact_allocations: result.impact_allocations ?? [],
      });
      setState('ready');
      setGateMessage('');
    } catch (err) {
      if (err instanceof PlanGateError) {
        setGateMessage(err.message);
        setState('gated');
      } else {
        setData(null);
        setState('unavailable');
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, state, gateMessage, refetch };
}

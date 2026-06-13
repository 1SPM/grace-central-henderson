import { useCallback, useEffect, useState } from 'react';
import type { Person } from '../types';
import {
  fetchAdminCardProgram,
  microUsdToDollars,
  PlanGateError,
  type AdminCardData,
  type CardRecord,
  type CardTransaction,
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
  mtdSpendMicroUsd: number;
  lastActivityAt: string | null;
  cardStatus: 'none' | CardRecord['status'];
}

/** 1 point earned per $1 of card spend (until a dedicated points ledger exists). */
export const IMPACT_CARD_EARN_RATE = 1;
export const IMPACT_CARD_REDEEM_RATE = 100;

export function fmtImpactUsd(micro: number): string {
  return microUsdToDollars(micro).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function spendMicroToEarnedPoints(spendMicroUsd: number): number {
  return Math.round(microUsdToDollars(spendMicroUsd) * IMPACT_CARD_EARN_RATE);
}

export function interchangeMicroToPoolUsd(interchangeMicroUsd: number): number {
  return microUsdToDollars(interchangeMicroUsd);
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

  const cardIdsByPerson = new Map<string, Set<string>>();
  for (const [personId, cards] of cardsByPerson) {
    cardIdsByPerson.set(personId, new Set(cards.map(c => c.id)));
  }

  const spendByPerson = new Map<string, number>();
  const lastActivityByPerson = new Map<string, string>();

  for (const event of adminData.interchange_events) {
    if (!event.card_id || event.event_type !== 'capture' || event.direction !== 'debit') continue;
    for (const [personId, cardIds] of cardIdsByPerson) {
      if (!cardIds.has(event.card_id)) continue;
      spendByPerson.set(personId, (spendByPerson.get(personId) ?? 0) + event.amount_micro_usd);
      const prev = lastActivityByPerson.get(personId);
      if (!prev || event.occurred_at > prev) {
        lastActivityByPerson.set(personId, event.occurred_at);
      }
    }
  }

  return people
    .filter(p => p.status !== 'inactive')
    .map(person => {
      const kyc = kycByPerson.get(person.id);
      const cards = cardsByPerson.get(person.id) ?? [];
      const liveCard = cards.find(c => c.status === 'active' || c.status === 'frozen' || c.status === 'pending');
      return {
        person,
        kycStatus: kyc?.status ?? 'none',
        cards,
        mtdSpendMicroUsd: spendByPerson.get(person.id) ?? 0,
        lastActivityAt: lastActivityByPerson.get(person.id) ?? null,
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
      setData(result);
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

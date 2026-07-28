/**
 * useCollectionManagement — campaigns, pledges, donation batches and
 * giving statements.
 *
 * Campaigns and pledges are persisted to the `campaigns` / `pledges` tables
 * (migration 002, RLS in 065). When Supabase is not configured the hook falls
 * back to the in-memory seed below so the demo/offline UI still renders.
 *
 * A pledge's `totalGiven` / `percentComplete` have no database columns — they
 * are derived from the `giving` rows that carry that `pledge_id`. Campaign
 * progress in the UI is the sum of its pledges' `totalGiven`, so the two stay
 * consistent by construction.
 *
 * Batches and statements remain in-memory; wiring those is a separate change.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Campaign, Pledge, DonationBatch, BatchItem, GivingStatement } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createLogger } from '../utils/logger';

const log = createLogger('useCollectionManagement');

// Minimal giving record type for statement generation
interface GivingRecord {
  personId?: string;
  amount: number;
  fund: string;
  date: string;
}

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'campaign-1',
    name: 'Building Fund 2026',
    description: 'New sanctuary construction project',
    goalAmount: 500000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    fund: 'building',
    isActive: true,
  },
];

/**
 * Pledges backing the campaign above. CampaignsTab derives a campaign's
 * "raised" and "donors" purely from pledges (raised = Σ totalGiven,
 * donors = pledge count), so with an empty pledge list the capital campaign
 * renders as $0 of its goal with 0 donors — i.e. a live campaign that looks
 * dead. These are generated rather than hand-listed to keep the file short.
 */
const INITIAL_PLEDGES: Pledge[] = Array.from({ length: 124 }, (_, i) => {
  const amount = 1500 + ((i * 337) % 6500);
  const totalGiven = Math.round(amount * (0.45 + ((i * 17) % 45) / 100));
  return {
    id: `pledge-${i + 1}`,
    campaignId: 'campaign-1',
    amount,
    frequency: 'monthly',
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    fund: 'building',
    status: 'active',
    totalPledged: amount,
    totalGiven,
    percentComplete: Math.round((totalGiven / amount) * 100),
  };
});

// ---------------------------------------------------------------------------
// Row mappers — the tables are snake_case, the app types are camelCase.
// ---------------------------------------------------------------------------
interface CampaignRow {
  id: string; name: string; description: string | null;
  goal_amount: number | string | null; start_date: string; end_date: string | null;
  fund: string | null; is_active: boolean | null;
}
interface PledgeRow {
  id: string; person_id: string | null; campaign_id: string | null;
  amount: number | string; frequency: string | null; start_date: string;
  end_date: string | null; fund: string | null; status: string | null; notes: string | null;
}

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    goalAmount: r.goal_amount == null ? undefined : Number(r.goal_amount),
    startDate: r.start_date,
    endDate: r.end_date ?? undefined,
    fund: r.fund ?? 'other',
    isActive: r.is_active ?? true,
  };
}

function rowToPledge(r: PledgeRow, givenByPledge: Map<string, number>): Pledge {
  const amount = Number(r.amount) || 0;
  const totalGiven = givenByPledge.get(r.id) ?? 0;
  return {
    id: r.id,
    personId: r.person_id ?? undefined,
    campaignId: r.campaign_id ?? undefined,
    amount,
    frequency: (r.frequency ?? 'monthly') as Pledge['frequency'],
    startDate: r.start_date,
    endDate: r.end_date ?? undefined,
    fund: r.fund ?? 'other',
    status: (r.status ?? 'active') as Pledge['status'],
    notes: r.notes ?? undefined,
    totalPledged: amount,
    totalGiven,
    percentComplete: amount > 0 ? Math.round((totalGiven / amount) * 100) : 0,
  };
}

export function useCollectionManagement(giving: GivingRecord[], churchId?: string) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [pledges, setPledges] = useState<Pledge[]>(INITIAL_PLEDGES);

  const live = isSupabaseConfigured() && !!supabase && !!churchId;

  // ----- Load campaigns + pledges ------------------------------------------
  const reload = useCallback(async () => {
    if (!live) return;
    const [campRes, pledgeRes] = await Promise.all([
      supabase!.from('campaigns').select('*').eq('church_id', churchId!).order('start_date', { ascending: false }),
      supabase!.from('pledges').select('*').eq('church_id', churchId!),
    ]);

    if (campRes.error) log.warn('campaign load failed', campRes.error.message);
    if (pledgeRes.error) log.warn('pledge load failed', pledgeRes.error.message);

    // Fulfilment per pledge: the amount actually given against it.
    //
    // Paged deliberately. PostgREST caps a response at 1000 rows, and campaign
    // gifts pass that quickly (a single capital campaign is already ~800), so a
    // one-shot select would silently truncate and under-report every campaign's
    // progress with no error to notice.
    const givenByPledge = new Map<string, number>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase!
        .from('giving')
        .select('amount, pledge_id')
        .eq('church_id', churchId!)
        .not('pledge_id', 'is', null)
        .order('pledge_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { log.warn('pledge-giving load failed', error.message); break; }
      const rows = (data ?? []) as Array<{ amount: number | string; pledge_id: string | null }>;
      for (const g of rows) {
        if (!g.pledge_id) continue;
        givenByPledge.set(g.pledge_id, (givenByPledge.get(g.pledge_id) ?? 0) + (Number(g.amount) || 0));
      }
      if (rows.length < PAGE) break;
    }

    if (!campRes.error) setCampaigns((campRes.data ?? []).map(r => rowToCampaign(r as CampaignRow)));
    if (!pledgeRes.error) setPledges((pledgeRes.data ?? []).map(r => rowToPledge(r as PledgeRow, givenByPledge)));
  }, [live, churchId]);

  useEffect(() => { void reload(); }, [reload]);
  const [donationBatches, setDonationBatches] = useState<DonationBatch[]>([]);
  const [givingStatements, setGivingStatements] = useState<GivingStatement[]>([]);

  // Campaign handlers — optimistic local update, then persist. Signatures stay
  // synchronous (`void`) because ViewRenderer's props declare them that way.
  const createCampaign = (campaign: Omit<Campaign, 'id'>) => {
    const newCampaign: Campaign = { ...campaign, id: `campaign-${Date.now()}` };
    setCampaigns((prev) => [...prev, newCampaign]);
    if (!live) return;
    void (async () => {
      const { error } = await supabase!.from('campaigns').insert({
        church_id: churchId!,
        name: campaign.name,
        description: campaign.description ?? null,
        goal_amount: campaign.goalAmount ?? null,
        start_date: campaign.startDate,
        end_date: campaign.endDate ?? null,
        fund: campaign.fund,
        is_active: campaign.isActive,
      });
      if (error) log.warn('campaign create failed', error.message);
      await reload(); // pick up the server-generated id
    })();
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    if (!live) return;
    void (async () => {
      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.description !== undefined) patch.description = updates.description ?? null;
      if (updates.goalAmount !== undefined) patch.goal_amount = updates.goalAmount ?? null;
      if (updates.startDate !== undefined) patch.start_date = updates.startDate;
      if (updates.endDate !== undefined) patch.end_date = updates.endDate ?? null;
      if (updates.fund !== undefined) patch.fund = updates.fund;
      if (updates.isActive !== undefined) patch.is_active = updates.isActive;
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase!.from('campaigns').update(patch).eq('id', id).eq('church_id', churchId!);
      if (error) log.warn('campaign update failed', error.message);
    })();
  };

  // Pledge handlers
  const createPledge = (pledge: Omit<Pledge, 'id'>) => {
    const newPledge: Pledge = {
      ...pledge,
      id: `pledge-${Date.now()}`,
      totalPledged: pledge.amount,
      totalGiven: 0,
      percentComplete: 0,
    };
    setPledges((prev) => [...prev, newPledge]);
    if (!live) return;
    void (async () => {
      const { error } = await supabase!.from('pledges').insert({
        church_id: churchId!,
        person_id: pledge.personId ?? null,
        campaign_id: pledge.campaignId ?? null,
        amount: pledge.amount,
        frequency: pledge.frequency,
        start_date: pledge.startDate,
        end_date: pledge.endDate ?? null,
        fund: pledge.fund,
        status: pledge.status,
        notes: pledge.notes ?? null,
      });
      if (error) log.warn('pledge create failed', error.message);
      await reload();
    })();
  };

  const updatePledge = (id: string, updates: Partial<Pledge>) => {
    setPledges((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    if (!live) return;
    void (async () => {
      const patch: Record<string, unknown> = {};
      if (updates.personId !== undefined) patch.person_id = updates.personId ?? null;
      if (updates.campaignId !== undefined) patch.campaign_id = updates.campaignId ?? null;
      if (updates.amount !== undefined) patch.amount = updates.amount;
      if (updates.frequency !== undefined) patch.frequency = updates.frequency;
      if (updates.startDate !== undefined) patch.start_date = updates.startDate;
      if (updates.endDate !== undefined) patch.end_date = updates.endDate ?? null;
      if (updates.fund !== undefined) patch.fund = updates.fund;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.notes !== undefined) patch.notes = updates.notes ?? null;
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase!.from('pledges').update(patch).eq('id', id).eq('church_id', churchId!);
      if (error) log.warn('pledge update failed', error.message);
    })();
  };

  const deletePledge = (id: string) => {
    setPledges((prev) => prev.filter((p) => p.id !== id));
    if (!live) return;
    void (async () => {
      const { error } = await supabase!.from('pledges').delete().eq('id', id).eq('church_id', churchId!);
      if (error) log.warn('pledge delete failed', error.message);
    })();
  };

  // Batch handlers
  const createBatch = (batch: Omit<DonationBatch, 'id'>) => {
    const newBatch: DonationBatch = {
      ...batch,
      id: `batch-${Date.now()}`,
      items: [],
    };
    setDonationBatches((prev) => [...prev, newBatch]);
  };

  const addBatchItem = (item: Omit<BatchItem, 'id'>) => {
    const newItem: BatchItem = {
      ...item,
      id: `item-${Date.now()}`,
    };

    setDonationBatches((prev) =>
      prev.map((b) => {
        if (b.id === item.batchId) {
          const items = [...(b.items || []), newItem];
          const totalCash = items
            .filter((i) => i.method === 'cash')
            .reduce((sum, i) => sum + i.amount, 0);
          const totalChecks = items
            .filter((i) => i.method === 'check')
            .reduce((sum, i) => sum + i.amount, 0);
          const checkCount = items.filter((i) => i.method === 'check').length;

          return {
            ...b,
            items,
            totalCash,
            totalChecks,
            totalAmount: totalCash + totalChecks,
            checkCount,
          };
        }
        return b;
      })
    );
  };

  const removeBatchItem = (itemId: string) => {
    setDonationBatches((prev) =>
      prev.map((b) => {
        const items = (b.items || []).filter((i) => i.id !== itemId);
        const totalCash = items
          .filter((i) => i.method === 'cash')
          .reduce((sum, i) => sum + i.amount, 0);
        const totalChecks = items
          .filter((i) => i.method === 'check')
          .reduce((sum, i) => sum + i.amount, 0);
        const checkCount = items.filter((i) => i.method === 'check').length;

        return {
          ...b,
          items,
          totalCash,
          totalChecks,
          totalAmount: totalCash + totalChecks,
          checkCount,
        };
      })
    );
  };

  const closeBatch = (batchId: string) => {
    setDonationBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? { ...b, status: 'closed' as const, closedAt: new Date().toISOString() }
          : b
      )
    );
  };

  // Statement handlers
  const generateStatement = (personId: string, year: number) => {
    const personGiving = giving.filter(
      (g) => g.personId === personId && new Date(g.date).getFullYear() === year
    );
    const total = personGiving.reduce((sum, g) => sum + g.amount, 0);
    const byFund: Record<string, number> = {};
    personGiving.forEach((g) => {
      byFund[g.fund] = (byFund[g.fund] || 0) + g.amount;
    });

    const newStatement: GivingStatement = {
      id: `stmt-${Date.now()}`,
      personId,
      year,
      totalAmount: total,
      byFund,
      generatedAt: new Date().toISOString(),
    };

    setGivingStatements((prev) => {
      const filtered = prev.filter(
        (s) => !(s.personId === personId && s.year === year)
      );
      return [...filtered, newStatement];
    });
  };

  const sendStatement = (statementId: string, method: 'email' | 'print') => {
    setGivingStatements((prev) =>
      prev.map((s) =>
        s.id === statementId
          ? { ...s, sentAt: new Date().toISOString(), sentMethod: method }
          : s
      )
    );
  };

  // Mark a statement sent by person + year, creating the statement record
  // if it was never explicitly generated (used after a real email send).
  const markStatementSent = (personId: string, year: number, method: 'email' | 'print') => {
    const now = new Date().toISOString();
    setGivingStatements((prev) => {
      const existing = prev.find((s) => s.personId === personId && s.year === year);
      if (existing) {
        return prev.map((s) =>
          s.id === existing.id ? { ...s, sentAt: now, sentMethod: method } : s
        );
      }
      const personGiving = giving.filter(
        (g) => g.personId === personId && new Date(g.date).getFullYear() === year
      );
      const byFund: Record<string, number> = {};
      personGiving.forEach((g) => {
        byFund[g.fund] = (byFund[g.fund] || 0) + g.amount;
      });
      const newStatement: GivingStatement = {
        id: `stmt-${Date.now()}-${personId}`,
        personId,
        year,
        totalAmount: personGiving.reduce((sum, g) => sum + g.amount, 0),
        byFund,
        generatedAt: now,
        sentAt: now,
        sentMethod: method,
      };
      return [...prev, newStatement];
    });
  };

  return {
    // Data
    campaigns,
    pledges,
    donationBatches,
    givingStatements,
    // Campaign actions
    createCampaign,
    updateCampaign,
    // Pledge actions
    createPledge,
    updatePledge,
    deletePledge,
    // Batch actions
    createBatch,
    addBatchItem,
    removeBatchItem,
    closeBatch,
    // Statement actions
    generateStatement,
    sendStatement,
    markStatementSent,
  };
}

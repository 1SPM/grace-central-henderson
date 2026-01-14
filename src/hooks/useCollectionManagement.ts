import { useState } from 'react';
import type { Campaign, Pledge, DonationBatch, BatchItem, GivingStatement } from '../types';

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
    name: 'Building Fund 2025',
    description: 'New sanctuary construction project',
    goalAmount: 500000,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    fund: 'building',
    isActive: true,
  },
];

export function useCollectionManagement(giving: GivingRecord[]) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [donationBatches, setDonationBatches] = useState<DonationBatch[]>([]);
  const [givingStatements, setGivingStatements] = useState<GivingStatement[]>([]);

  // Campaign handlers
  const createCampaign = (campaign: Omit<Campaign, 'id'>) => {
    const newCampaign: Campaign = {
      ...campaign,
      id: `campaign-${Date.now()}`,
    };
    setCampaigns((prev) => [...prev, newCampaign]);
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
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
  };

  const updatePledge = (id: string, updates: Partial<Pledge>) => {
    setPledges((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deletePledge = (id: string) => {
    setPledges((prev) => prev.filter((p) => p.id !== id));
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
  };
}

import type { Person } from '../../types';

/**
 * Demo wallet data for the admin Wallets view. Values are derived
 * deterministically from the person id so every member shows a stable,
 * realistic wallet. Replace with reads from the neobank/i2c backend
 * (see src/lib/services/impactCard.ts) when live accounts exist.
 */

export type CardRail = 'i2c' | 'VERUS' | 'DIV minted';

export interface WalletCard {
  type: 'debit' | 'credit';
  last4: string;
  status: 'Active' | 'Frozen';
  mtdSpend: number;
  limit: number;
}

export interface WalletTransaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  direction: 'in' | 'out';
  rail: CardRail;
}

export interface FundToken {
  symbol: string;
  name: string;
  balance: number;
  usd: number;
}

export interface KycItem {
  label: string;
  status: 'passed' | 'pending' | 'review';
  detail: string;
}

export interface MemberWallet {
  balance: number;
  balanceTrend: number[];
  verusId: string;
  givingRank: number;
  kycApproved: boolean;
  pointsBalance: number;
  cards: WalletCard[];
  transactions: WalletTransaction[];
  fundTokens: FundToken[];
  kyc: KycItem[];
}

/** Stable small hash so demo values don't change between renders. */
function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const MERCHANTS: { merchant: string; category: string }[] = [
  { merchant: 'Whole Foods Market', category: 'Groceries' },
  { merchant: 'Shell Gas Station', category: 'Fuel' },
  { merchant: 'Sunday Tithe — Auto', category: 'Giving' },
  { merchant: 'Amazon.com', category: 'Shopping' },
  { merchant: 'Chick-fil-A', category: 'Dining' },
  { merchant: 'Building Fund Gift', category: 'Giving' },
  { merchant: 'Netflix', category: 'Subscriptions' },
  { merchant: 'Points → Tithe redemption', category: 'Rewards' },
];

const RAILS: CardRail[] = ['i2c', 'i2c', 'i2c', 'VERUS', 'i2c', 'VERUS', 'i2c', 'DIV minted'];

export function getDemoWallet(person: Person): MemberWallet {
  const h = hashCode(person.id);
  const balance = 800 + (h % 4200);
  const debitSpend = 600 + (h % 2400);
  const creditSpend = 200 + (h % 1800);
  const kycApproved = h % 7 !== 0;

  const trend: number[] = [];
  for (let i = 0; i < 8; i++) {
    trend.push(Math.max(200, balance - ((h >> i) % 900) + i * 60));
  }

  const today = new Date();
  const transactions: WalletTransaction[] = MERCHANTS.map((m, i) => {
    const date = new Date(today.getTime() - (i + 1) * ((h % 2) + 1) * 86400000);
    const isGiving = m.category === 'Giving' || m.category === 'Rewards';
    return {
      id: `${person.id}-tx-${i}`,
      date: date.toISOString(),
      merchant: m.merchant,
      category: m.category,
      amount: isGiving ? 50 + ((h >> i) % 250) : 8 + ((h >> i) % 140),
      direction: m.category === 'Rewards' ? 'in' : 'out',
      rail: RAILS[i],
    };
  });

  const firstName = person.firstName.toLowerCase().replace(/[^a-z]/g, '');
  const lastName = person.lastName.toLowerCase().replace(/[^a-z]/g, '');

  return {
    balance,
    balanceTrend: trend,
    verusId: `${firstName}.${lastName}@grace`,
    givingRank: 1 + (h % 40),
    kycApproved,
    pointsBalance: 1200 + (h % 18000),
    cards: [
      {
        type: 'debit',
        last4: String(1000 + (h % 9000)),
        status: 'Active',
        mtdSpend: debitSpend,
        limit: 5000,
      },
      {
        type: 'credit',
        last4: String(1000 + ((h >> 3) % 9000)),
        status: h % 11 === 0 ? 'Frozen' : 'Active',
        mtdSpend: creditSpend,
        limit: 3000,
      },
    ],
    transactions,
    fundTokens: [
      { symbol: 'GRACE-T', name: 'Tithe fund token', balance: 120 + (h % 600), usd: 120 + (h % 600) },
      { symbol: 'GRACE-M', name: 'Missions fund token', balance: 40 + (h % 220), usd: 40 + (h % 220) },
      { symbol: 'GRACE-B', name: 'Building fund token', balance: 25 + (h % 180), usd: 25 + (h % 180) },
    ],
    kyc: [
      { label: 'Identity verification (KYC)', status: kycApproved ? 'passed' : 'pending', detail: kycApproved ? 'Documents verified via i2c partner bank' : 'Awaiting document upload' },
      { label: 'OFAC / sanctions screening', status: 'passed', detail: 'Screened nightly, no matches' },
      { label: 'Address verification', status: kycApproved ? 'passed' : 'review', detail: kycApproved ? 'USPS match confirmed' : 'Manual review queued' },
      { label: 'Card network compliance', status: 'passed', detail: 'Visa program rules current' },
      { label: 'VerusID attestation', status: kycApproved ? 'passed' : 'pending', detail: kycApproved ? 'On-chain identity linked' : 'Pending KYC approval' },
    ],
  };
}

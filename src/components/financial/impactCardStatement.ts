import { jsPDF } from 'jspdf';
import type { Person } from '../../types';
import type {
  AdminCardData,
  CardAccountRecord,
  CardTransaction,
  CardTransferRecord,
  ImpactRouteRecord,
} from '../../lib/services/impactCard';
import { fmtImpactUsd } from '../../hooks/useImpactCardProgram';

export interface ImpactCardStatementInput {
  person: Person;
  churchName: string;
  account: CardAccountRecord | null;
  impactRoute: ImpactRouteRecord | null;
  transactions: CardTransaction[];
  transfers: CardTransferRecord[];
  balanceMicroUsd: number;
  impactMtdMicroUsd: number;
  spendMtdMicroUsd: number;
  adapterMode: 'live' | 'mock';
}

export function downloadImpactCardStatement(input: ImpactCardStatementInput): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16);
  doc.text('GRACE Impact Card — Account Statement', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.text(input.churchName, pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.text(`${input.person.firstName} ${input.person.lastName}`, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.text(`Period: Month-to-date · Generated ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(11);
  doc.text(`Available balance: ${input.account ? fmtImpactUsd(input.balanceMicroUsd) : '—'}`, 14, y);
  y += 6;
  doc.text(`Card Impact MTD: ${fmtImpactUsd(input.impactMtdMicroUsd)}`, 14, y);
  y += 6;
  doc.text(`Card spend MTD: ${fmtImpactUsd(input.spendMtdMicroUsd)}`, 14, y);
  y += 6;
  if (input.impactRoute) {
    doc.text(`Impact route: ${input.impactRoute.route_label} (${input.impactRoute.route_fund})`, 14, y);
    y += 6;
  }
  if (input.account) {
    doc.text(`Deposit acct: ••••${input.account.account_number_last4}${input.account.routing_number ? ` · Routing ${input.account.routing_number}` : ''}`, 14, y);
    y += 6;
  }
  y += 6;

  doc.setFontSize(12);
  doc.text('Card transactions', 14, y);
  y += 7;
  doc.setFontSize(9);
  if (input.transactions.length === 0) {
    doc.text('No card activity this period.', 14, y);
    y += 8;
  } else {
    for (const tx of input.transactions.slice(0, 25)) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const line = `${new Date(tx.occurred_at).toLocaleDateString()} · ${tx.merchant_name ?? tx.event_type} · ${tx.direction === 'credit' ? '+' : '−'}${fmtImpactUsd(tx.amount_micro_usd)}`;
      doc.text(line, 14, y);
      y += 5;
    }
    y += 4;
  }

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(12);
  doc.text('Transfers', 14, y);
  y += 7;
  doc.setFontSize(9);
  if (input.transfers.length === 0) {
    doc.text('No transfers this period.', 14, y);
  } else {
    for (const tr of input.transfers.slice(0, 20)) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const line = `${new Date(tr.initiated_at).toLocaleDateString()} · ${tr.direction} ${tr.transfer_type} · ${tr.counterparty_name} · ${fmtImpactUsd(tr.amount_micro_usd)} · ${tr.status}`;
      doc.text(line, 14, y);
      y += 5;
    }
  }

  doc.setFontSize(8);
  doc.text(
    `i2c merchant program — ${input.adapterMode === 'live' ? 'live' : 'sandbox (mock)'}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  const slug = `${input.person.lastName}-${input.person.firstName}`.replace(/\s+/g, '-').toLowerCase();
  doc.save(`impact-card-statement-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function buildStatementInput(
  person: Person,
  adminData: AdminCardData,
  churchName: string,
  opts: {
    account: CardAccountRecord | null;
    impactRoute: ImpactRouteRecord | null;
    transactions: CardTransaction[];
    transfers: CardTransferRecord[];
    impactMtdMicroUsd: number;
    spendMtdMicroUsd: number;
  },
): ImpactCardStatementInput {
  return {
    person,
    churchName,
    account: opts.account,
    impactRoute: opts.impactRoute,
    transactions: opts.transactions,
    transfers: opts.transfers,
    balanceMicroUsd: opts.account?.available_balance_micro_usd ?? 0,
    impactMtdMicroUsd: opts.impactMtdMicroUsd,
    spendMtdMicroUsd: opts.spendMtdMicroUsd,
    adapterMode: adminData.adapter_mode,
  };
}

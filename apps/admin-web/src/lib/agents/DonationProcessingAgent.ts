/**
 * Donation Processing Agent
 *
 * Automatically processes donations by sending receipts, thank you messages,
 * and tracking first-time givers. Can alert leadership for large gifts.
 */

import { BaseAgent } from './BaseAgent';
import type {
  DonationProcessingConfig,
  DonationEvent,
  LapsedGiverEvent,
  AgentResult,
  AgentContext,
} from './types';
import { emailService } from '../services/email';
import { smsService } from '../services/sms';

interface GivingData {
  id: string;
  personId?: string;
  amount: number;
  fund: string;
  date: string;
  method: string;
  isRecurring: boolean;
  note?: string;
}

interface PersonData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

// Historical giving summary per person for lapsed detection
interface GivingHistory {
  personId: string;
  totalDonations: number;
  totalAmount: number;
  lastDonationDate: string;
  firstDonationDate: string;
}

export class DonationProcessingAgent extends BaseAgent {
  protected config: DonationProcessingConfig;
  private donations: GivingData[];
  private people: Map<string, PersonData>;
  private existingDonorIds: Set<string>;
  private givingHistory: Map<string, GivingHistory>;

  constructor(
    config: DonationProcessingConfig,
    context: AgentContext,
    donations: GivingData[],
    people: PersonData[],
    existingDonorIds: string[] = [],
    givingHistory: GivingHistory[] = []
  ) {
    super(config, context);
    this.config = config;
    this.donations = donations;
    this.people = new Map(people.map((p) => [p.id, p]));
    this.existingDonorIds = new Set(existingDonorIds);
    this.givingHistory = new Map(givingHistory.map((h) => [h.personId, h]));
  }

  /**
   * Process a single donation
   */
  async processDonation(donation: GivingData): Promise<boolean> {
    const person = donation.personId ? this.people.get(donation.personId) : null;
    const isFirstGift = donation.personId
      ? !this.existingDonorIds.has(donation.personId)
      : false;

    const event: DonationEvent = {
      donationId: donation.id,
      personId: donation.personId,
      personName: person ? `${person.firstName} ${person.lastName}` : 'Anonymous',
      email: person?.email,
      phone: person?.phone,
      amount: donation.amount,
      fund: donation.fund,
      method: donation.method,
      date: donation.date,
      isFirstGift,
      isRecurring: donation.isRecurring,
    };

    this.log(`Processing donation: $${event.amount} from ${event.personName}`, {
      fund: event.fund,
      isFirstGift,
      isRecurring: event.isRecurring,
    });

    let overallSuccess = true;

    // Send receipt
    if (this.config.settings.autoSendReceipts && person) {
      const receiptSuccess = await this.sendReceipt(event);
      if (!receiptSuccess) overallSuccess = false;
    }

    // Send thank you message
    if (this.config.settings.sendThankYouMessage && person) {
      const thankYouSuccess = await this.sendThankYou(event);
      if (!thankYouSuccess) overallSuccess = false;
    }

    // Track first-time givers
    if (this.config.settings.trackFirstTimeGivers && isFirstGift && person) {
      await this.handleFirstTimeGiver(event);
    }

    // Alert on large gifts
    if (
      this.config.settings.alertOnLargeGifts &&
      event.amount >= this.config.settings.largeGiftThreshold
    ) {
      await this.alertLargeGift(event);
    }

    // Add to existing donors set
    if (donation.personId) {
      this.existingDonorIds.add(donation.personId);
    }

    return overallSuccess;
  }

  /**
   * Send donation receipt
   */
  private async sendReceipt(event: DonationEvent): Promise<boolean> {
    const { receiptMethod, churchName, taxId } = this.config.settings;
    let success = true;

    const firstName = event.personName?.split(' ')[0] || 'Friend';
    const receiptNumber = this.generateReceiptNumber();
    const formattedDate = this.formatDate(event.date);
    const formattedAmount = event.amount.toFixed(2);

    // Send email receipt
    if ((receiptMethod === 'email' || receiptMethod === 'both') && event.email) {
      try {
        if (!this.context.dryRun) {
          const result = await emailService.sendGivingReceipt(
            { email: event.email, name: event.personName || '' },
            {
              firstName,
              churchName,
              amount: formattedAmount,
              date: formattedDate,
              fund: this.formatFundName(event.fund),
              receiptNumber,
            }
          );
          if (!result.success) {
            this.error(`Failed to send receipt email: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent receipt email to ${event.personName}`, {
              receiptNumber,
              messageId: result.messageId,
            });
          }
        } else {
          this.log(`[DRY RUN] Would send receipt email to ${event.personName}`);
        }
        this.recordAction('email', success, {
          template: 'GIVING_RECEIPT',
          templateData: {
            firstName,
            churchName,
            amount: formattedAmount,
            receiptNumber,
          },
          targetPersonId: event.personId,
          metadata: { donationId: event.donationId, taxId },
        });
      } catch (err) {
        this.error(`Error sending receipt email: ${err}`);
        success = false;
      }
    }

    // Send SMS receipt
    if ((receiptMethod === 'sms' || receiptMethod === 'both') && event.phone) {
      try {
        if (!this.context.dryRun) {
          const result = await smsService.sendGivingThanks(event.phone, {
            firstName,
            amount: formattedAmount,
            churchName,
          });
          if (!result.success) {
            this.error(`Failed to send receipt SMS: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent receipt SMS to ${event.personName}`);
          }
        } else {
          this.log(`[DRY RUN] Would send receipt SMS to ${event.personName}`);
        }
        this.recordAction('sms', success, {
          template: 'GIVING_THANKS',
          templateData: { firstName, amount: formattedAmount, churchName },
          targetPersonId: event.personId,
          metadata: { donationId: event.donationId },
        });
      } catch (err) {
        this.error(`Error sending receipt SMS: ${err}`);
        success = false;
      }
    }

    return success;
  }

  /**
   * Send thank you message (separate from receipt)
   */
  private async sendThankYou(event: DonationEvent): Promise<boolean> {
    // For now, thank you is combined with receipt
    // This could be enhanced to send a separate follow-up
    this.log(`Thank you message included in receipt for ${event.personName}`);
    return true;
  }

  /**
   * Handle first-time giver
   */
  private async handleFirstTimeGiver(event: DonationEvent): Promise<boolean> {
    this.log(`First-time giver detected: ${event.personName}`, {
      amount: event.amount,
      fund: event.fund,
    });

    // Create a notification for staff
    this.recordAction('notification', true, {
      metadata: {
        type: 'first_time_giver',
        personName: event.personName,
        amount: event.amount,
        fund: event.fund,
      },
      targetPersonId: event.personId,
    });

    // Send special first-time giver email
    if (event.email) {
      const firstName = event.personName?.split(' ')[0] || 'Friend';
      const { churchName } = this.config.settings;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Thank You for Your First Gift!</h1>
          <p>Dear ${firstName},</p>
          <p>We noticed this is your first gift to ${churchName}, and we wanted to take a moment to express our heartfelt gratitude!</p>
          <p>Your generosity helps us continue our mission in the community. Every gift, no matter the size, makes a meaningful difference.</p>
          <p>If you have any questions about giving or want to learn more about how your gifts are used, please don't hesitate to reach out to us.</p>
          <p>With sincere thanks,<br/>The ${churchName} Team</p>
        </div>
      `;

      if (!this.context.dryRun) {
        try {
          await emailService.send({
            to: { email: event.email, name: event.personName || '' },
            subject: `Thank You for Your First Gift to ${churchName}!`,
            html,
          });
          this.log(`Sent first-time giver welcome to ${event.personName}`);
        } catch (err) {
          this.error(`Error sending first-time giver email: ${err}`);
        }
      } else {
        this.log(`[DRY RUN] Would send first-time giver email to ${event.personName}`);
      }
    }

    return true;
  }

  /**
   * Alert leadership about large gift
   */
  private async alertLargeGift(event: DonationEvent): Promise<boolean> {
    this.log(`Large gift alert: $${event.amount} from ${event.personName}`, {
      threshold: this.config.settings.largeGiftThreshold,
    });

    // Create notification for leadership
    this.recordAction('notification', true, {
      metadata: {
        type: 'large_gift_alert',
        personName: event.personName,
        amount: event.amount,
        fund: event.fund,
        threshold: this.config.settings.largeGiftThreshold,
      },
      targetPersonId: event.personId,
    });

    return true;
  }

  /**
   * Detect and alert on lapsed givers
   * A lapsed giver is someone who:
   * 1. Has given at least X times in the past (configurable)
   * 2. Hasn't given in Y days (configurable)
   */
  async detectLapsedGivers(): Promise<LapsedGiverEvent[]> {
    if (!this.config.settings.detectLapsedGivers) {
      return [];
    }

    const { lapsedGiverDays, lapsedGiverMinDonations } = this.config.settings;
    const today = this.context.currentDate;
    const lapsedGivers: LapsedGiverEvent[] = [];

    for (const [personId, history] of this.givingHistory) {
      // Check if they've given enough times to be considered "regular"
      if (history.totalDonations < lapsedGiverMinDonations) {
        continue;
      }

      // Calculate days since last donation
      const lastDonation = new Date(history.lastDonationDate);
      const daysSinceLastDonation = Math.floor(
        (today.getTime() - lastDonation.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if they've lapsed
      if (daysSinceLastDonation >= lapsedGiverDays) {
        const person = this.people.get(personId);
        if (!person) continue;

        const lapsedEvent: LapsedGiverEvent = {
          personId,
          personName: `${person.firstName} ${person.lastName}`,
          email: person.email,
          phone: person.phone,
          lastDonationDate: history.lastDonationDate,
          daysSinceLastDonation,
          totalDonations: history.totalDonations,
          totalAmount: history.totalAmount,
          averageGift: history.totalAmount / history.totalDonations,
        };

        lapsedGivers.push(lapsedEvent);
      }
    }

    return lapsedGivers;
  }

  /**
   * Send lapsed giver alert email to admin/finance team
   */
  async sendLapsedGiverAlerts(lapsedGivers: LapsedGiverEvent[]): Promise<boolean> {
    if (lapsedGivers.length === 0) return true;

    const { lapsedGiverAlertEmail, churchName, lapsedGiverDays } = this.config.settings;
    const alertEmail = lapsedGiverAlertEmail || this.context.churchId; // Fallback to church contact

    if (!alertEmail) {
      this.log('No alert email configured for lapsed giver notifications');
      return false;
    }

    // Build the alert email
    const lapsedGiversHtml = lapsedGivers
      .sort((a, b) => b.totalAmount - a.totalAmount) // Sort by total giving (highest first)
      .map(
        (g) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.personName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.daysSinceLastDonation} days</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.totalDonations}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">$${g.totalAmount.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">$${g.averageGift.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.email || 'N/A'}</td>
        </tr>
      `
      )
      .join('');

    const totalLostGiving = lapsedGivers.reduce((sum, g) => sum + g.averageGift, 0);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #DC2626;">⚠️ Lapsed Giver Alert</h1>
        <p>The following regular givers haven't donated in ${lapsedGiverDays}+ days:</p>

        <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <strong style="color: #DC2626;">${lapsedGivers.length} lapsed givers detected</strong><br/>
          <span style="color: #7F1D1D;">Potential monthly giving at risk: $${totalLostGiving.toFixed(2)}</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background: #F3F4F6;">
              <th style="padding: 8px; text-align: left;">Name</th>
              <th style="padding: 8px; text-align: left;">Days Since Gift</th>
              <th style="padding: 8px; text-align: left;">Total Gifts</th>
              <th style="padding: 8px; text-align: left;">Lifetime Giving</th>
              <th style="padding: 8px; text-align: left;">Avg Gift</th>
              <th style="padding: 8px; text-align: left;">Email</th>
            </tr>
          </thead>
          <tbody>
            ${lapsedGiversHtml}
          </tbody>
        </table>

        <p style="margin-top: 24px; color: #6B7280; font-size: 14px;">
          Consider reaching out personally to check in on these members. A simple call or email can make a big difference.
        </p>

        <p style="margin-top: 16px; color: #9CA3AF; font-size: 12px;">
          This alert was generated by Grace CRM for ${churchName}.
        </p>
      </div>
    `;

    this.log(`Sending lapsed giver alert for ${lapsedGivers.length} givers`, {
      totalAtRisk: totalLostGiving,
    });

    if (!this.context.dryRun) {
      try {
        const result = await emailService.send({
          to: { email: alertEmail, name: 'Finance Team' },
          subject: `⚠️ ${lapsedGivers.length} Lapsed Givers Detected - ${churchName}`,
          html,
        });

        if (!result.success) {
          this.error(`Failed to send lapsed giver alert: ${result.error}`);
          return false;
        }

        this.log('Lapsed giver alert sent successfully');

        // Record each lapsed giver as a notification
        for (const giver of lapsedGivers) {
          this.recordAction('notification', true, {
            metadata: {
              type: 'lapsed_giver',
              personName: giver.personName,
              daysSinceLastDonation: giver.daysSinceLastDonation,
              totalAmount: giver.totalAmount,
            },
            targetPersonId: giver.personId,
          });
        }

        return true;
      } catch (err) {
        this.error(`Error sending lapsed giver alert: ${err}`);
        return false;
      }
    } else {
      this.log(`[DRY RUN] Would send lapsed giver alert for ${lapsedGivers.length} givers`);
      return true;
    }
  }

  /**
   * Format fund name for display
   */
  private formatFundName(fund: string): string {
    const fundNames: Record<string, string> = {
      tithe: 'Tithes',
      offering: 'General Offering',
      missions: 'Missions',
      building: 'Building Fund',
      benevolence: 'Benevolence',
      other: 'Other',
    };
    return fundNames[fund] || fund;
  }

  /**
   * Execute the agent for a batch of donations
   */
  async execute(): Promise<AgentResult> {
    if (!this.isActive()) {
      this.log('Agent is not active, skipping execution');
      return this.getResults();
    }

    this.log('Starting Donation Processing Agent', {
      autoSendReceipts: this.config.settings.autoSendReceipts,
      trackFirstTimeGivers: this.config.settings.trackFirstTimeGivers,
      alertOnLargeGifts: this.config.settings.alertOnLargeGifts,
      detectLapsedGivers: this.config.settings.detectLapsedGivers,
    });

    // Process each donation
    for (const donation of this.donations) {
      await this.processDonation(donation);
    }

    // Check for lapsed givers
    if (this.config.settings.detectLapsedGivers) {
      const lapsedGivers = await this.detectLapsedGivers();
      if (lapsedGivers.length > 0) {
        this.log(`Detected ${lapsedGivers.length} lapsed givers`);
        await this.sendLapsedGiverAlerts(lapsedGivers);
      }
    }

    this.log(`Donation Processing Agent completed. Processed ${this.donations.length} donations.`);
    return this.getResults();
  }

  /**
   * Run lapsed giver check separately (for scheduled weekly runs)
   */
  async checkLapsedGivers(): Promise<{ lapsedGivers: LapsedGiverEvent[]; alertSent: boolean }> {
    if (!this.isActive()) {
      this.log('Agent is not active, skipping lapsed giver check');
      return { lapsedGivers: [], alertSent: false };
    }

    const lapsedGivers = await this.detectLapsedGivers();
    let alertSent = false;

    if (lapsedGivers.length > 0) {
      alertSent = await this.sendLapsedGiverAlerts(lapsedGivers);
    }

    return { lapsedGivers, alertSent };
  }

  /**
   * Process a single new donation (for real-time webhook handling)
   */
  async processNewDonation(donation: GivingData): Promise<AgentResult> {
    if (!this.isActive()) {
      this.log('Agent is not active, skipping');
      return this.getResults();
    }

    this.log('Processing new donation', { donationId: donation.id });
    await this.processDonation(donation);
    return this.getResults();
  }

  /**
   * Get donation statistics
   */
  getStats(): {
    totalDonations: number;
    totalAmount: number;
    firstTimeGivers: number;
    recurringDonations: number;
    largeGifts: number;
  } {
    let totalAmount = 0;
    let firstTimeGivers = 0;
    let recurringDonations = 0;
    let largeGifts = 0;
    const seenDonors = new Set<string>();

    for (const donation of this.donations) {
      totalAmount += donation.amount;

      if (donation.isRecurring) recurringDonations++;
      if (donation.amount >= this.config.settings.largeGiftThreshold) largeGifts++;

      if (donation.personId && !this.existingDonorIds.has(donation.personId)) {
        if (!seenDonors.has(donation.personId)) {
          firstTimeGivers++;
          seenDonors.add(donation.personId);
        }
      }
    }

    return {
      totalDonations: this.donations.length,
      totalAmount,
      firstTimeGivers,
      recurringDonations,
      largeGifts,
    };
  }
}

/**
 * Create default configuration for Donation Processing Agent
 */
export function createDefaultDonationConfig(
  churchName: string,
  taxId: string = '',
  alertEmail?: string
): DonationProcessingConfig {
  return {
    id: 'donation-processing-agent',
    name: 'Donation Processing',
    description:
      'Automatically sends receipts, tracks first-time givers, alerts on large gifts, and detects lapsed givers',
    category: 'finance',
    status: 'active',
    enabled: true,
    settings: {
      autoSendReceipts: true,
      receiptMethod: 'email',
      sendThankYouMessage: true,
      thankYouDelay: 0, // Immediate
      trackFirstTimeGivers: true,
      alertOnLargeGifts: true,
      largeGiftThreshold: 1000,
      // Lapsed giver detection defaults
      detectLapsedGivers: true,
      lapsedGiverDays: 30, // Alert after 30 days of no giving
      lapsedGiverMinDonations: 3, // Must have given at least 3 times to be "regular"
      lapsedGiverAlertEmail: alertEmail,
      churchName,
      taxId,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

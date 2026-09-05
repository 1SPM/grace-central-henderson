/**
 * Life Event Recognition Agent
 *
 * Automatically recognizes and celebrates life events like birthdays,
 * anniversaries, and membership milestones. Can send personalized
 * greetings via email and SMS.
 */

import { BaseAgent } from './BaseAgent';
import type {
  LifeEventConfig,
  LifeEvent,
  AgentResult,
  AgentContext,
} from './types';
import { emailService } from '../services/email';
import { smsService } from '../services/sms';

interface PersonData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  joinDate?: string;
  status: string;
}

export class LifeEventAgent extends BaseAgent {
  protected config: LifeEventConfig;
  private people: PersonData[];

  constructor(
    config: LifeEventConfig,
    context: AgentContext,
    people: PersonData[]
  ) {
    super(config, context);
    this.config = config;
    this.people = people;
  }

  /**
   * Find all life events for today
   */
  private findTodaysEvents(): LifeEvent[] {
    const events: LifeEvent[] = [];
    const today = this.context.currentDate;

    for (const person of this.people) {
      // Skip inactive members
      if (person.status === 'inactive') continue;

      // Check birthdays
      if (this.config.settings.enableBirthdays && person.birthDate) {
        const birthDate = new Date(person.birthDate);
        if (this.isSameMonthDay(today, birthDate)) {
          const age = this.calculateYears(birthDate);
          events.push({
            type: 'birthday',
            personId: person.id,
            personName: `${person.firstName} ${person.lastName}`,
            email: person.email,
            phone: person.phone,
            date: person.birthDate,
            yearsCount: age,
          });
        }
      }

      // Check membership anniversaries
      if (this.config.settings.enableMembershipAnniversaries && person.joinDate) {
        const joinDate = new Date(person.joinDate);
        if (this.isSameMonthDay(today, joinDate)) {
          const years = this.calculateYears(joinDate);
          if (years > 0) {
            // Only celebrate after first year
            events.push({
              type: 'membership_anniversary',
              personId: person.id,
              personName: `${person.firstName} ${person.lastName}`,
              email: person.email,
              phone: person.phone,
              date: person.joinDate,
              yearsCount: years,
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Send birthday greeting
   */
  private async sendBirthdayGreeting(event: LifeEvent): Promise<boolean> {
    const { sendEmail, sendSMS, churchName } = this.config.settings;
    let success = true;

    const firstName = event.personName.split(' ')[0];

    // Send email
    if (sendEmail && event.email) {
      try {
        if (!this.context.dryRun) {
          const result = await emailService.sendBirthdayEmail(
            { email: event.email, name: event.personName },
            { firstName, churchName }
          );
          if (!result.success) {
            this.error(`Failed to send birthday email to ${event.personName}: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent birthday email to ${event.personName}`, { messageId: result.messageId });
          }
        } else {
          this.log(`[DRY RUN] Would send birthday email to ${event.personName}`);
        }
        this.recordAction('email', success, {
          template: 'BIRTHDAY',
          templateData: { firstName, churchName },
          targetPersonId: event.personId,
        });
      } catch (err) {
        this.error(`Error sending birthday email: ${err}`);
        success = false;
      }
    }

    // Send SMS
    if (sendSMS && event.phone) {
      try {
        if (!this.context.dryRun) {
          const result = await smsService.sendBirthdaySMS(event.phone, {
            firstName,
            churchName,
          });
          if (!result.success) {
            this.error(`Failed to send birthday SMS to ${event.personName}: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent birthday SMS to ${event.personName}`, { messageId: result.messageId });
          }
        } else {
          this.log(`[DRY RUN] Would send birthday SMS to ${event.personName}`);
        }
        this.recordAction('sms', success, {
          template: 'BIRTHDAY',
          templateData: { firstName, churchName },
          targetPersonId: event.personId,
        });
      } catch (err) {
        this.error(`Error sending birthday SMS: ${err}`);
        success = false;
      }
    }

    return success;
  }

  /**
   * Send membership anniversary greeting
   */
  private async sendMembershipAnniversaryGreeting(event: LifeEvent): Promise<boolean> {
    const { sendEmail, sendSMS, churchName } = this.config.settings;
    let success = true;

    const firstName = event.personName.split(' ')[0];
    const years = event.yearsCount?.toString() || '1';

    // Custom email for membership anniversary
    if (sendEmail && event.email) {
      try {
        const subject = `Happy ${years} Year Anniversary at ${churchName}!`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
            <h1 style="color: #4F46E5;">Happy Anniversary!</h1>
            <p>Dear ${firstName},</p>
            <p>Today marks <strong>${years} ${parseInt(years) === 1 ? 'year' : 'years'}</strong> since you joined our church family!</p>
            <p>We are so grateful for your presence in our community. Thank you for being part of ${churchName}.</p>
            <p>With love and gratitude,<br/>Your ${churchName} Family</p>
          </div>
        `;

        if (!this.context.dryRun) {
          const result = await emailService.send({
            to: { email: event.email, name: event.personName },
            subject,
            html,
          });
          if (!result.success) {
            this.error(`Failed to send anniversary email to ${event.personName}: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent membership anniversary email to ${event.personName}`, {
              years,
              messageId: result.messageId,
            });
          }
        } else {
          this.log(`[DRY RUN] Would send anniversary email to ${event.personName}`);
        }
        this.recordAction('email', success, {
          template: 'MEMBERSHIP_ANNIVERSARY',
          templateData: { firstName, churchName, years },
          targetPersonId: event.personId,
        });
      } catch (err) {
        this.error(`Error sending anniversary email: ${err}`);
        success = false;
      }
    }

    // Custom SMS for membership anniversary
    if (sendSMS && event.phone) {
      try {
        const message = `Happy ${years}-year anniversary at ${churchName}, ${firstName}! Thank you for being part of our family!`;

        if (!this.context.dryRun) {
          const result = await smsService.send({ to: event.phone, message });
          if (!result.success) {
            this.error(`Failed to send anniversary SMS to ${event.personName}: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent membership anniversary SMS to ${event.personName}`, { years });
          }
        } else {
          this.log(`[DRY RUN] Would send anniversary SMS to ${event.personName}`);
        }
        this.recordAction('sms', success, {
          template: 'MEMBERSHIP_ANNIVERSARY',
          templateData: { firstName, churchName, years },
          targetPersonId: event.personId,
        });
      } catch (err) {
        this.error(`Error sending anniversary SMS: ${err}`);
        success = false;
      }
    }

    return success;
  }

  /**
   * Execute the agent
   */
  async execute(): Promise<AgentResult> {
    if (!this.isActive()) {
      this.log('Agent is not active, skipping execution');
      return this.getResults();
    }

    this.log('Starting Life Event Recognition Agent', {
      enableBirthdays: this.config.settings.enableBirthdays,
      enableAnniversaries: this.config.settings.enableAnniversaries,
      enableMembershipAnniversaries: this.config.settings.enableMembershipAnniversaries,
    });

    // Find today's events
    const events = this.findTodaysEvents();
    this.log(`Found ${events.length} life events for today`);

    if (events.length === 0) {
      this.log('No life events to process today');
      return this.getResults();
    }

    // Process each event
    for (const event of events) {
      this.log(`Processing ${event.type} for ${event.personName}`);

      if (this.config.settings.autoSend) {
        switch (event.type) {
          case 'birthday':
            await this.sendBirthdayGreeting(event);
            break;
          case 'membership_anniversary':
            await this.sendMembershipAnniversaryGreeting(event);
            break;
          case 'anniversary':
            // Wedding anniversaries would be handled here
            break;
        }
      } else {
        // Just create notifications for staff
        this.recordAction('notification', true, {
          metadata: {
            eventType: event.type,
            personName: event.personName,
            date: event.date,
          },
          targetPersonId: event.personId,
        });
        this.log(`Created notification for ${event.type}: ${event.personName}`);
      }
    }

    this.log('Life Event Recognition Agent completed');
    return this.getResults();
  }

  /**
   * Get upcoming events (for preview/dashboard)
   */
  getUpcomingEvents(daysAhead: number = 7): LifeEvent[] {
    const events: LifeEvent[] = [];
    const today = this.context.currentDate;

    for (let i = 0; i <= daysAhead; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);

      for (const person of this.people) {
        if (person.status === 'inactive') continue;

        if (this.config.settings.enableBirthdays && person.birthDate) {
          const birthDate = new Date(person.birthDate);
          if (this.isSameMonthDay(checkDate, birthDate)) {
            events.push({
              type: 'birthday',
              personId: person.id,
              personName: `${person.firstName} ${person.lastName}`,
              email: person.email,
              phone: person.phone,
              date: checkDate.toISOString().split('T')[0],
              yearsCount: this.calculateYears(birthDate),
            });
          }
        }

        if (this.config.settings.enableMembershipAnniversaries && person.joinDate) {
          const joinDate = new Date(person.joinDate);
          if (this.isSameMonthDay(checkDate, joinDate)) {
            const years = this.calculateYears(joinDate);
            if (years > 0) {
              events.push({
                type: 'membership_anniversary',
                personId: person.id,
                personName: `${person.firstName} ${person.lastName}`,
                email: person.email,
                phone: person.phone,
                date: checkDate.toISOString().split('T')[0],
                yearsCount: years,
              });
            }
          }
        }
      }
    }

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}

/**
 * Create default configuration for Life Event Agent
 */
export function createDefaultLifeEventConfig(churchName: string): LifeEventConfig {
  return {
    id: 'life-event-agent',
    name: 'Life Event Recognition',
    description: 'Automatically sends greetings for birthdays, anniversaries, and membership milestones',
    category: 'engagement',
    status: 'active',
    enabled: true,
    settings: {
      enableBirthdays: true,
      enableAnniversaries: false,
      enableMembershipAnniversaries: true,
      sendEmail: true,
      sendSMS: true,
      daysInAdvance: 1,
      autoSend: true,
      churchName,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

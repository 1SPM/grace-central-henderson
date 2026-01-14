/**
 * New Member Integration Agent
 *
 * Automatically onboards new members with welcome sequences, drip campaigns,
 * and follow-up task assignments. Helps ensure no new member falls through
 * the cracks.
 */

import { BaseAgent } from './BaseAgent';
import type {
  NewMemberConfig,
  NewMemberEvent,
  DripMessage,
  AgentResult,
  AgentContext,
} from './types';
import { emailService } from '../services/email';
import { smsService } from '../services/sms';
import { generateWelcomeMessage } from '../services/ai';

interface PersonData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: string;
  joinDate?: string;
  firstVisit?: string;
}

interface TaskData {
  personId: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  category: 'follow-up' | 'care' | 'admin' | 'outreach';
  assignedTo?: string;
}

// Default drip campaign messages
const DEFAULT_DRIP_MESSAGES: DripMessage[] = [
  {
    day: 1,
    subject: 'Welcome to Our Family!',
    emailTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to {{churchName}}!</h1>
        <p>Dear {{firstName}},</p>
        <p>We are so excited to officially welcome you as a member of our church family!</p>
        <p>This is the beginning of a wonderful journey together. We can't wait to see how God will work in your life as you grow with us.</p>
        <p>Here are some ways to get connected:</p>
        <ul>
          <li>Join a small group to build deeper relationships</li>
          <li>Explore volunteer opportunities</li>
          <li>Attend our upcoming events</li>
        </ul>
        <p>If you have any questions, don't hesitate to reach out!</p>
        <p>Blessings,<br/>{{pastorName}}<br/>{{churchName}}</p>
      </div>
    `,
    smsTemplate: 'Welcome to {{churchName}}, {{firstName}}! We\'re thrilled to have you as part of our family!',
  },
  {
    day: 3,
    subject: 'Getting Connected at {{churchName}}',
    emailTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Let's Get You Connected!</h2>
        <p>Hi {{firstName}},</p>
        <p>Now that you're part of our family, we want to help you find your place!</p>
        <p><strong>Small Groups</strong> are a great way to build friendships and grow in faith. We have groups for all ages and interests.</p>
        <p><strong>Serving</strong> is another wonderful way to connect. Whether it's greeting, children's ministry, worship, or technical teams - there's a place for everyone!</p>
        <p>Would you like us to help connect you with a small group or ministry team? Just reply to this email!</p>
        <p>Looking forward to seeing you Sunday!</p>
        <p>Blessings,<br/>{{churchName}} Team</p>
      </div>
    `,
    smsTemplate: 'Hi {{firstName}}! Have you thought about joining a small group at {{churchName}}? Reply YES to learn more!',
  },
  {
    day: 7,
    subject: 'Your First Week as a Member',
    emailTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Happy One Week Anniversary!</h2>
        <p>Hi {{firstName}},</p>
        <p>Can you believe it's been a week already? We hope you're settling in well!</p>
        <p>We wanted to check in and see how your first week has been. Is there anything we can help you with? Any questions about our church, ministries, or how to get involved?</p>
        <p>Remember, we're here for you - that's what family is for!</p>
        <p>See you soon,<br/>{{churchName}} Team</p>
      </div>
    `,
    smsTemplate: 'Hi {{firstName}}, it\'s been one week since you joined {{churchName}}! How are you settling in? We\'re here if you need anything!',
  },
  {
    day: 14,
    subject: 'Two Weeks of Being Family',
    emailTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Two Weeks In!</h2>
        <p>Hi {{firstName}},</p>
        <p>It's been two weeks since you joined our church family, and we've loved having you!</p>
        <p>By now, we hope you're starting to feel at home. If there's anything more we can do to help you connect, please let us know.</p>
        <p>Here's a quick reminder of what's coming up:</p>
        <ul>
          <li>Sunday services at 9am and 11am</li>
          <li>Small groups meeting throughout the week</li>
          <li>Special events and community gatherings</li>
        </ul>
        <p>We're so glad you're part of our family!</p>
        <p>Blessings,<br/>{{churchName}}</p>
      </div>
    `,
    smsTemplate: 'Two weeks as part of {{churchName}}! We hope you\'re feeling at home, {{firstName}}. See you Sunday!',
  },
  {
    day: 30,
    subject: 'Your First Month with Us!',
    emailTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Happy One Month!</h2>
        <p>Dear {{firstName}},</p>
        <p>Wow - it's been one month since you officially became part of our church family!</p>
        <p>We hope this month has been filled with meaningful connections, spiritual growth, and a sense of belonging.</p>
        <p>As you continue your journey with us, remember that we're here to support you every step of the way.</p>
        <p>Thank you for choosing to grow with us. Here's to many more months of faith, fellowship, and family!</p>
        <p>With gratitude,<br/>{{pastorName}}<br/>{{churchName}}</p>
      </div>
    `,
    smsTemplate: 'Happy one month at {{churchName}}, {{firstName}}! Thank you for being part of our family!',
  },
];

export class NewMemberAgent extends BaseAgent {
  protected config: NewMemberConfig;
  private people: PersonData[];
  private dripMessages: DripMessage[];
  private onCreateTask?: (task: TaskData) => Promise<void>;

  constructor(
    config: NewMemberConfig,
    context: AgentContext,
    people: PersonData[],
    options?: {
      dripMessages?: DripMessage[];
      onCreateTask?: (task: TaskData) => Promise<void>;
    }
  ) {
    super(config, context);
    this.config = config;
    this.people = people;
    this.dripMessages = options?.dripMessages || DEFAULT_DRIP_MESSAGES;
    this.onCreateTask = options?.onCreateTask;
  }

  /**
   * Handle a new member joining (status change to 'member')
   */
  async handleNewMember(event: NewMemberEvent): Promise<boolean> {
    this.log(`Processing new member: ${event.personName}`, {
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
    });

    let success = true;

    // Send welcome sequence
    if (this.config.settings.enableWelcomeSequence) {
      const welcomeSuccess = await this.sendWelcomeMessage(event);
      if (!welcomeSuccess) success = false;
    }

    // Create follow-up task
    if (this.config.settings.assignFollowUpTask) {
      await this.createFollowUpTask(event);
    }

    // Record the status change action
    this.recordAction('status_change', true, {
      targetPersonId: event.personId,
      metadata: {
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        joinDate: event.joinDate,
      },
    });

    return success;
  }

  /**
   * Send welcome message to new member
   */
  private async sendWelcomeMessage(event: NewMemberEvent): Promise<boolean> {
    const { churchName, useAIMessages } = this.config.settings;
    const firstName = event.personName.split(' ')[0];
    let success = true;

    // Generate AI message if enabled
    let aiGeneratedMessage: string | undefined;
    if (useAIMessages) {
      try {
        this.log(`Generating AI welcome message for ${firstName}`);
        const aiResult = await generateWelcomeMessage(firstName, churchName);
        if (aiResult.success && aiResult.text) {
          aiGeneratedMessage = aiResult.text;
          this.log(`AI message generated successfully`, { model: aiResult.model });
        } else {
          this.warn(`AI message generation failed, using template: ${aiResult.error}`);
        }
      } catch (err) {
        this.warn(`AI service error, using template: ${err}`);
      }
    }

    // Send welcome email
    if (event.email) {
      try {
        if (!this.context.dryRun) {
          const result = await emailService.sendWelcomeEmail(
            { email: event.email, name: event.personName },
            { firstName, churchName },
            aiGeneratedMessage // Pass AI message if available
          );
          if (!result.success) {
            this.error(`Failed to send welcome email: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent welcome email to ${event.personName}`, {
              messageId: result.messageId,
              usedAI: !!aiGeneratedMessage
            });
          }
        } else {
          this.log(`[DRY RUN] Would send welcome email to ${event.personName}`, {
            usedAI: !!aiGeneratedMessage
          });
        }
        this.recordAction('email', success, {
          template: aiGeneratedMessage ? 'AI_GENERATED' : 'WELCOME_VISITOR',
          templateData: { firstName, churchName },
          targetPersonId: event.personId,
        });
      } catch (err) {
        this.error(`Error sending welcome email: ${err}`);
        success = false;
      }
    }

    // Send welcome SMS
    if (event.phone) {
      try {
        if (!this.context.dryRun) {
          const result = await smsService.sendWelcomeSMS(event.phone, {
            firstName,
            churchName,
          });
          if (!result.success) {
            this.error(`Failed to send welcome SMS: ${result.error}`);
            success = false;
          } else {
            this.log(`Sent welcome SMS to ${event.personName}`);
          }
        } else {
          this.log(`[DRY RUN] Would send welcome SMS to ${event.personName}`);
        }
        this.recordAction('sms', success, {
          template: 'WELCOME_VISITOR',
          templateData: { firstName, churchName },
          targetPersonId: event.personId,
        });
      } catch (err) {
        this.error(`Error sending welcome SMS: ${err}`);
        success = false;
      }
    }

    return success;
  }

  /**
   * Create a follow-up task for staff
   */
  private async createFollowUpTask(event: NewMemberEvent): Promise<void> {
    const dueDate = new Date(this.context.currentDate);
    dueDate.setDate(dueDate.getDate() + 3); // Due in 3 days

    const task: TaskData = {
      personId: event.personId,
      title: `Follow up with new member: ${event.personName}`,
      description: `${event.personName} recently became a member. Reach out to welcome them personally and help them get connected.`,
      dueDate: dueDate.toISOString().split('T')[0],
      priority: 'high',
      category: 'follow-up',
      assignedTo: this.config.settings.assignToStaffId,
    };

    if (this.onCreateTask) {
      try {
        if (!this.context.dryRun) {
          await this.onCreateTask(task);
          this.log(`Created follow-up task for ${event.personName}`);
        } else {
          this.log(`[DRY RUN] Would create follow-up task for ${event.personName}`);
        }
        this.recordAction('task', true, {
          targetPersonId: event.personId,
          metadata: { taskTitle: task.title, dueDate: task.dueDate },
        });
      } catch (err) {
        this.error(`Failed to create follow-up task: ${err}`);
        this.recordAction('task', false, {
          targetPersonId: event.personId,
          error: String(err),
        });
      }
    } else {
      this.warn('No task creation handler provided, skipping follow-up task');
    }
  }

  /**
   * Check and send drip campaign messages
   */
  async processDripCampaign(): Promise<void> {
    if (!this.config.settings.enableDripCampaign) {
      this.log('Drip campaign is disabled');
      return;
    }

    const { churchName, pastorName, dripCampaignDays } = this.config.settings;
    const today = this.context.currentDate;

    this.log('Processing drip campaign', { dripDays: dripCampaignDays });

    for (const person of this.people) {
      // Only process members with a join date
      if (person.status !== 'member' || !person.joinDate) continue;

      const joinDate = new Date(person.joinDate);
      const daysSinceJoin = Math.floor(
        (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if today matches any drip day
      for (const dripMessage of this.dripMessages) {
        if (
          dripCampaignDays.includes(dripMessage.day) &&
          daysSinceJoin === dripMessage.day
        ) {
          this.log(`Sending day ${dripMessage.day} drip message to ${person.firstName} ${person.lastName}`);

          const firstName = person.firstName;
          const templateData = { firstName, churchName, pastorName };

          // Send email
          if (person.email) {
            const html = this.replaceTemplateVars(dripMessage.emailTemplate, templateData);
            const subject = this.replaceTemplateVars(dripMessage.subject, templateData);

            try {
              if (!this.context.dryRun) {
                const result = await emailService.send({
                  to: { email: person.email, name: `${person.firstName} ${person.lastName}` },
                  subject,
                  html,
                });
                if (result.success) {
                  this.log(`Sent drip email (day ${dripMessage.day}) to ${person.firstName}`);
                } else {
                  this.error(`Failed to send drip email: ${result.error}`);
                }
              } else {
                this.log(`[DRY RUN] Would send drip email (day ${dripMessage.day}) to ${person.firstName}`);
              }
              this.recordAction('email', true, {
                template: `DRIP_DAY_${dripMessage.day}`,
                templateData,
                targetPersonId: person.id,
              });
            } catch (err) {
              this.error(`Error sending drip email: ${err}`);
            }
          }

          // Send SMS
          if (person.phone) {
            const message = this.replaceTemplateVars(dripMessage.smsTemplate, templateData);

            try {
              if (!this.context.dryRun) {
                const result = await smsService.send({ to: person.phone, message });
                if (result.success) {
                  this.log(`Sent drip SMS (day ${dripMessage.day}) to ${person.firstName}`);
                } else {
                  this.error(`Failed to send drip SMS: ${result.error}`);
                }
              } else {
                this.log(`[DRY RUN] Would send drip SMS (day ${dripMessage.day}) to ${person.firstName}`);
              }
              this.recordAction('sms', true, {
                template: `DRIP_DAY_${dripMessage.day}`,
                templateData,
                targetPersonId: person.id,
              });
            } catch (err) {
              this.error(`Error sending drip SMS: ${err}`);
            }
          }
        }
      }
    }
  }

  /**
   * Replace template variables
   */
  private replaceTemplateVars(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Find new members who need onboarding
   */
  findNewMembers(sinceDays: number = 30): PersonData[] {
    const today = this.context.currentDate;
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - sinceDays);

    return this.people.filter((person) => {
      if (person.status !== 'member' || !person.joinDate) return false;
      const joinDate = new Date(person.joinDate);
      return joinDate >= cutoffDate;
    });
  }

  /**
   * Execute the agent
   */
  async execute(): Promise<AgentResult> {
    if (!this.isActive()) {
      this.log('Agent is not active, skipping execution');
      return this.getResults();
    }

    this.log('Starting New Member Integration Agent', {
      enableWelcomeSequence: this.config.settings.enableWelcomeSequence,
      enableDripCampaign: this.config.settings.enableDripCampaign,
      assignFollowUpTask: this.config.settings.assignFollowUpTask,
    });

    // Process drip campaign for existing members
    await this.processDripCampaign();

    this.log('New Member Integration Agent completed');
    return this.getResults();
  }

  /**
   * Get drip campaign schedule
   */
  getDripSchedule(): DripMessage[] {
    return this.dripMessages.filter((msg) =>
      this.config.settings.dripCampaignDays.includes(msg.day)
    );
  }
}

/**
 * Create default configuration for New Member Agent
 */
export function createDefaultNewMemberConfig(
  churchName: string,
  pastorName: string = 'Pastor'
): NewMemberConfig {
  return {
    id: 'new-member-agent',
    name: 'New Member Integration',
    description: 'Welcomes and onboards new members with automated sequences and follow-ups',
    category: 'pastoral',
    status: 'active',
    enabled: true,
    settings: {
      enableWelcomeSequence: true,
      enableDripCampaign: true,
      dripCampaignDays: [1, 3, 7, 14, 30],
      assignFollowUpTask: true,
      assignToStaffId: undefined,
      inviteToSmallGroup: true,
      sendWelcomePacket: false,
      churchName,
      pastorName,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

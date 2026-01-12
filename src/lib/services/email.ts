/**
 * Email Service - Resend Integration
 *
 * Provides email sending capabilities using Resend API.
 * Includes templates for common CRM emails.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface SendEmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, string>;
  replyTo?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email templates for common CRM scenarios
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  WELCOME_VISITOR: {
    id: 'welcome-visitor',
    name: 'Welcome Visitor',
    subject: 'Welcome to {{churchName}}!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to {{churchName}}!</h1>
        <p>Dear {{firstName}},</p>
        <p>Thank you so much for visiting us! We were blessed to have you join our community.</p>
        <p>We'd love to help you get connected. Here are some ways to stay in touch:</p>
        <ul>
          <li>Join us again this Sunday</li>
          <li>Check out our small groups</li>
          <li>Follow us on social media</li>
        </ul>
        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p>Blessings,<br/>The {{churchName}} Team</p>
      </div>
    `,
  },
  FOLLOW_UP: {
    id: 'follow-up',
    name: 'Follow Up',
    subject: 'Checking in from {{churchName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Hi {{firstName}}!</h2>
        <p>We wanted to check in and see how you're doing.</p>
        <p>{{customMessage}}</p>
        <p>We're here if you need anything!</p>
        <p>Blessings,<br/>{{senderName}}</p>
      </div>
    `,
  },
  BIRTHDAY: {
    id: 'birthday',
    name: 'Birthday Greeting',
    subject: 'Happy Birthday, {{firstName}}!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
        <h1 style="color: #4F46E5;">Happy Birthday! 🎂</h1>
        <p>Dear {{firstName}},</p>
        <p>Wishing you a wonderful birthday filled with joy and blessings!</p>
        <p>May this next year bring you closer to all your dreams.</p>
        <p>With love,<br/>Your {{churchName}} Family</p>
      </div>
    `,
  },
  EVENT_INVITATION: {
    id: 'event-invitation',
    name: 'Event Invitation',
    subject: "You're Invited: {{eventName}}",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">You're Invited!</h1>
        <h2>{{eventName}}</h2>
        <p>Dear {{firstName}},</p>
        <p>We'd love for you to join us for this special event.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Date:</strong> {{eventDate}}</p>
          <p><strong>Time:</strong> {{eventTime}}</p>
          <p><strong>Location:</strong> {{eventLocation}}</p>
        </div>
        <p>{{eventDescription}}</p>
        <p>We hope to see you there!</p>
        <p>Blessings,<br/>{{churchName}}</p>
      </div>
    `,
  },
  TASK_REMINDER: {
    id: 'task-reminder',
    name: 'Task Reminder',
    subject: 'Reminder: {{taskTitle}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Task Reminder</h2>
        <p>Hi {{recipientName}},</p>
        <p>This is a reminder about your upcoming task:</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Task:</strong> {{taskTitle}}</p>
          <p><strong>Due Date:</strong> {{dueDate}}</p>
          <p><strong>Related to:</strong> {{personName}}</p>
        </div>
        <p>Please make sure to complete this task on time.</p>
      </div>
    `,
  },
  PRAYER_UPDATE: {
    id: 'prayer-update',
    name: 'Prayer Request Update',
    subject: 'Prayer Update: {{personName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Prayer Update</h2>
        <p>Dear Prayer Team,</p>
        <p>We have an update on the prayer request for {{personName}}:</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
          <p>{{updateContent}}</p>
        </div>
        <p>Thank you for your continued prayers and support.</p>
      </div>
    `,
  },
  GIVING_RECEIPT: {
    id: 'giving-receipt',
    name: 'Giving Receipt',
    subject: 'Thank You for Your Gift - Receipt #{{receiptNumber}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Thank You for Your Generosity!</h1>
        <p>Dear {{firstName}},</p>
        <p>Thank you for your gift to {{churchName}}. Your generosity makes a difference!</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Donation Receipt</h3>
          <p><strong>Amount:</strong> \${{amount}}</p>
          <p><strong>Date:</strong> {{date}}</p>
          <p><strong>Fund:</strong> {{fund}}</p>
          <p><strong>Receipt #:</strong> {{receiptNumber}}</p>
        </div>
        <p style="font-size: 12px; color: #666;">This receipt is for your records. {{churchName}} is a 501(c)(3) organization. No goods or services were provided in exchange for this contribution.</p>
      </div>
    `,
  },
};

class EmailService {
  private apiKey: string | null = null;
  private fromEmail: string = 'noreply@grace-crm.com';
  private fromName: string = 'Grace CRM';
  private baseUrl: string = 'https://api.resend.com';

  configure(config: { apiKey: string; fromEmail?: string; fromName?: string }) {
    this.apiKey = config.apiKey;
    if (config.fromEmail) this.fromEmail = config.fromEmail;
    if (config.fromName) this.fromName = config.fromName;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private replaceTemplateVariables(
    template: string,
    data: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  async send(params: SendEmailParams): Promise<EmailResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Email service not configured. Please set your Resend API key.',
      };
    }

    try {
      let html = params.html;
      let subject = params.subject;

      // Apply template if specified
      if (params.template && EMAIL_TEMPLATES[params.template]) {
        const template = EMAIL_TEMPLATES[params.template];
        html = this.replaceTemplateVariables(
          template.htmlContent,
          params.templateData || {}
        );
        subject = this.replaceTemplateVariables(
          template.subject,
          params.templateData || {}
        );
      } else if (params.templateData && html) {
        html = this.replaceTemplateVariables(html, params.templateData);
        subject = this.replaceTemplateVariables(subject, params.templateData);
      }

      const recipients = Array.isArray(params.to) ? params.to : [params.to];
      const toEmails = recipients.map((r) =>
        r.name ? `${r.name} <${r.email}>` : r.email
      );

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: toEmails,
          subject,
          html,
          text: params.text,
          reply_to: params.replyTo,
          cc: params.cc?.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
          bcc: params.bcc?.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to send email',
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Convenience methods for common emails
  async sendWelcomeEmail(
    to: EmailRecipient,
    data: { firstName: string; churchName: string }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'WELCOME_VISITOR',
      templateData: data,
    });
  }

  async sendBirthdayEmail(
    to: EmailRecipient,
    data: { firstName: string; churchName: string }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'BIRTHDAY',
      templateData: data,
    });
  }

  async sendFollowUpEmail(
    to: EmailRecipient,
    data: { firstName: string; churchName: string; customMessage: string; senderName: string }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'FOLLOW_UP',
      templateData: data,
    });
  }

  async sendEventInvitation(
    to: EmailRecipient | EmailRecipient[],
    data: {
      firstName: string;
      churchName: string;
      eventName: string;
      eventDate: string;
      eventTime: string;
      eventLocation: string;
      eventDescription: string;
    }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'EVENT_INVITATION',
      templateData: data,
    });
  }

  async sendTaskReminder(
    to: EmailRecipient,
    data: {
      recipientName: string;
      taskTitle: string;
      dueDate: string;
      personName: string;
    }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'TASK_REMINDER',
      templateData: data,
    });
  }

  async sendGivingReceipt(
    to: EmailRecipient,
    data: {
      firstName: string;
      churchName: string;
      amount: string;
      date: string;
      fund: string;
      receiptNumber: string;
    }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'GIVING_RECEIPT',
      templateData: data,
    });
  }

  async sendPrayerUpdate(
    to: EmailRecipient | EmailRecipient[],
    data: { personName: string; updateContent: string }
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: '',
      template: 'PRAYER_UPDATE',
      templateData: data,
    });
  }

  // Bulk send with rate limiting
  async sendBulk(
    emails: SendEmailParams[],
    delayMs: number = 100
  ): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    for (const email of emails) {
      const result = await this.send(email);
      results.push(result);
      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return results;
  }
}

// Export singleton instance
export const emailService = new EmailService();

/**
 * SMS Service - Twilio Integration
 *
 * Provides SMS sending capabilities using Twilio API.
 * Includes templates for common CRM messages.
 */

export interface SMSRecipient {
  phone: string;
  name?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
}

export interface SendSMSParams {
  to: string | string[];
  message: string;
  template?: string;
  templateData?: Record<string, string>;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

// SMS templates for common CRM scenarios
export const SMS_TEMPLATES: Record<string, SMSTemplate> = {
  WELCOME_VISITOR: {
    id: 'welcome-visitor',
    name: 'Welcome Visitor',
    content:
      'Hi {{firstName}}! Thanks for visiting {{churchName}}! We loved having you. Questions? Reply to this text anytime.',
  },
  FOLLOW_UP: {
    id: 'follow-up',
    name: 'Follow Up',
    content:
      'Hi {{firstName}}, {{senderName}} from {{churchName}} here. {{customMessage}} Reply if you need anything!',
  },
  BIRTHDAY: {
    id: 'birthday',
    name: 'Birthday Greeting',
    content:
      'Happy Birthday {{firstName}}! Your {{churchName}} family is celebrating you today!',
  },
  EVENT_REMINDER: {
    id: 'event-reminder',
    name: 'Event Reminder',
    content:
      'Reminder: {{eventName}} is {{timeUntil}}! {{eventDate}} at {{eventTime}}. See you there! - {{churchName}}',
  },
  TASK_REMINDER: {
    id: 'task-reminder',
    name: 'Task Reminder',
    content:
      'Reminder: "{{taskTitle}}" is due {{dueDate}}. Related to: {{personName}}.',
  },
  PRAYER_REQUEST: {
    id: 'prayer-request',
    name: 'Prayer Request',
    content:
      'Prayer request from {{churchName}}: Please pray for {{personName}}. {{prayerContent}}',
  },
  ATTENDANCE_CHECKIN: {
    id: 'attendance-checkin',
    name: 'Attendance Check-in',
    content:
      "Hi {{firstName}}! We noticed you've been absent. We miss you at {{churchName}}! Is everything okay?",
  },
  GIVING_THANKS: {
    id: 'giving-thanks',
    name: 'Giving Thanks',
    content:
      'Thank you {{firstName}} for your generous gift of \${{amount}} to {{churchName}}! Your support means so much.',
  },
};

class SMSService {
  private apiBaseUrl: string = '/api/sms'; // Backend API proxy
  private isEnabled: boolean = false;

  configure(config: { apiBaseUrl?: string }) {
    if (config.apiBaseUrl) this.apiBaseUrl = config.apiBaseUrl;
    this.isEnabled = true;
  }

  isConfigured(): boolean {
    return this.isEnabled;
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

  async send(params: SendSMSParams): Promise<SMSResult> {
    try {
      let message = params.message;

      // Apply template if specified
      if (params.template && SMS_TEMPLATES[params.template]) {
        const template = SMS_TEMPLATES[params.template];
        message = this.replaceTemplateVariables(
          template.content,
          params.templateData || {}
        );
      } else if (params.templateData) {
        message = this.replaceTemplateVariables(message, params.templateData);
      }

      // Handle single or multiple recipients
      const recipients = Array.isArray(params.to) ? params.to : [params.to];
      const results: SMSResult[] = [];

      for (const to of recipients) {
        // Send via backend API proxy (no credentials exposed in frontend)
        const response = await fetch(`${this.apiBaseUrl}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({ to, message }),
        });

        const data = await response.json();

        if (!response.ok) {
          results.push({
            success: false,
            error: data.error || 'Failed to send SMS',
          });
        } else {
          results.push({
            success: true,
            messageId: data.messageId,
            status: data.status,
          });
        }
      }

      // Return single result for single recipient, otherwise aggregate
      if (results.length === 1) {
        return results[0];
      }

      const allSuccess = results.every((r) => r.success);
      return {
        success: allSuccess,
        messageId: results.map((r) => r.messageId).join(','),
        error: allSuccess
          ? undefined
          : results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join('; '),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Convenience methods for common SMS messages
  async sendWelcomeSMS(
    to: string,
    data: { firstName: string; churchName: string }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'WELCOME_VISITOR',
      templateData: data,
    });
  }

  async sendBirthdaySMS(
    to: string,
    data: { firstName: string; churchName: string }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'BIRTHDAY',
      templateData: data,
    });
  }

  async sendFollowUpSMS(
    to: string,
    data: {
      firstName: string;
      churchName: string;
      customMessage: string;
      senderName: string;
    }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'FOLLOW_UP',
      templateData: data,
    });
  }

  async sendEventReminder(
    to: string | string[],
    data: {
      eventName: string;
      timeUntil: string;
      eventDate: string;
      eventTime: string;
      churchName: string;
    }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'EVENT_REMINDER',
      templateData: data,
    });
  }

  async sendTaskReminder(
    to: string,
    data: { taskTitle: string; dueDate: string; personName: string }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'TASK_REMINDER',
      templateData: data,
    });
  }

  async sendGivingThanks(
    to: string,
    data: { firstName: string; amount: string; churchName: string }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'GIVING_THANKS',
      templateData: data,
    });
  }

  async sendAttendanceCheckIn(
    to: string,
    data: { firstName: string; churchName: string }
  ): Promise<SMSResult> {
    return this.send({
      to,
      message: '',
      template: 'ATTENDANCE_CHECKIN',
      templateData: data,
    });
  }

  // Bulk send with rate limiting (via backend)
  async sendBulk(
    smsMessages: SendSMSParams[],
    delayMs: number = 200
  ): Promise<SMSResult[]> {
    try {
      // Prepare messages with templates applied
      const preparedMessages = smsMessages.map((params) => {
        let message = params.message;

        if (params.template && SMS_TEMPLATES[params.template]) {
          const template = SMS_TEMPLATES[params.template];
          message = this.replaceTemplateVariables(
            template.content,
            params.templateData || {}
          );
        } else if (params.templateData) {
          message = this.replaceTemplateVariables(message, params.templateData);
        }

        // For bulk, we only support single recipient per message
        const to = Array.isArray(params.to) ? params.to[0] : params.to;
        return { to, message };
      });

      // Send via backend bulk endpoint
      const response = await fetch(`${this.apiBaseUrl}/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ messages: preparedMessages, delayMs }),
      });

      const data = await response.json();

      if (!response.ok) {
        return smsMessages.map(() => ({
          success: false,
          error: data.error || 'Failed to send messages',
        }));
      }

      return data.results || smsMessages.map(() => ({ success: true }));
    } catch (error) {
      return smsMessages.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }

  // Check message status (via backend)
  async getMessageStatus(messageId: string): Promise<SMSResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/status/${messageId}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to get message status',
        };
      }

      return {
        success: true,
        messageId: data.messageId,
        status: data.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

// Export singleton instance
export const smsService = new SMSService();

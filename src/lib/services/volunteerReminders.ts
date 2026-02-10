/**
 * Volunteer Reminder Service
 *
 * Sends automatic reminders to volunteers before their scheduled service.
 * Can send reminders via email or SMS.
 */

import { emailService } from './email';
import { smsService } from './sms';

export interface VolunteerAssignment {
  id: string;
  eventId: string;
  roleId: string;
  personId: string;
  status: 'confirmed' | 'pending' | 'declined';
}

export interface VolunteerEvent {
  id: string;
  title: string;
  startDate: string;
  location?: string;
}

export interface VolunteerPerson {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface VolunteerRole {
  id: string;
  name: string;
}

export interface ReminderConfig {
  enabled: boolean;
  hoursBeforeEvent: number; // Hours before event to send reminder
  sendEmail: boolean;
  sendSMS: boolean;
  churchName: string;
  includeConfirmLink?: boolean; // Include link to confirm/decline
}

export interface ReminderResult {
  assignmentId: string;
  personName: string;
  emailSent: boolean;
  smsSent: boolean;
  errors: string[];
}

// Default roles mapping
const roleNames: Record<string, string> = {
  greeter: 'Greeter',
  usher: 'Usher',
  worship: 'Worship Team',
  av: 'A/V Tech',
  childcare: "Children's Ministry",
  parking: 'Parking Team',
  hospitality: 'Hospitality',
};

/**
 * Get upcoming assignments that need reminders
 * Returns assignments where the event is within the reminder window
 */
export function getUpcomingAssignments(
  assignments: VolunteerAssignment[],
  events: VolunteerEvent[],
  hoursBeforeEvent: number
): { assignment: VolunteerAssignment; event: VolunteerEvent }[] {
  const now = new Date();
  const reminderWindowMs = hoursBeforeEvent * 60 * 60 * 1000;

  const upcoming: { assignment: VolunteerAssignment; event: VolunteerEvent }[] = [];

  for (const assignment of assignments) {
    // Skip declined assignments
    if (assignment.status === 'declined') continue;

    const event = events.find((e) => e.id === assignment.eventId);
    if (!event) continue;

    const eventDate = new Date(event.startDate);
    const timeUntilEvent = eventDate.getTime() - now.getTime();

    // Check if event is within reminder window (but not in the past)
    if (timeUntilEvent > 0 && timeUntilEvent <= reminderWindowMs) {
      upcoming.push({ assignment, event });
    }
  }

  return upcoming;
}

/**
 * Send reminders for upcoming volunteer assignments
 */
export async function sendVolunteerReminders(
  assignments: VolunteerAssignment[],
  events: VolunteerEvent[],
  people: VolunteerPerson[],
  config: ReminderConfig
): Promise<ReminderResult[]> {
  if (!config.enabled) {
    return [];
  }

  const upcoming = getUpcomingAssignments(assignments, events, config.hoursBeforeEvent);
  const results: ReminderResult[] = [];
  const peopleMap = new Map(people.map((p) => [p.id, p]));

  for (const { assignment, event } of upcoming) {
    const person = peopleMap.get(assignment.personId);
    if (!person) continue;

    const result: ReminderResult = {
      assignmentId: assignment.id,
      personName: `${person.firstName} ${person.lastName}`,
      emailSent: false,
      smsSent: false,
      errors: [],
    };

    const roleName = roleNames[assignment.roleId] || assignment.roleId;
    const eventDate = new Date(event.startDate);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Send email reminder
    if (config.sendEmail && person.email) {
      try {
        const emailResult = await emailService.send({
          to: { email: person.email, name: `${person.firstName} ${person.lastName}` },
          subject: `Reminder: You're serving ${formattedDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">Volunteer Reminder</h2>
              <p>Hi ${person.firstName},</p>
              <p>This is a friendly reminder that you're scheduled to serve:</p>

              <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${event.title}</p>
                <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${roleName}</p>
                <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
                ${event.location ? `<p style="margin: 0;"><strong>Location:</strong> ${event.location}</p>` : ''}
              </div>

              <p>Thank you for serving! Your contribution makes a difference.</p>

              ${
                assignment.status === 'pending'
                  ? `<p style="color: #DC2626;"><em>Note: Your assignment is still pending confirmation. Please let us know if you can make it!</em></p>`
                  : ''
              }

              <p style="color: #6B7280; font-size: 14px;">
                If you can't make it, please let us know as soon as possible so we can find a replacement.
              </p>

              <p style="margin-top: 24px;">
                Blessings,<br/>
                ${config.churchName}
              </p>
            </div>
          `,
        });

        if (emailResult.success) {
          result.emailSent = true;
        } else {
          result.errors.push(`Email failed: ${emailResult.error}`);
        }
      } catch (err) {
        result.errors.push(`Email error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Send SMS reminder
    if (config.sendSMS && person.phone) {
      try {
        const smsMessage = `Hi ${person.firstName}! Reminder: You're serving as ${roleName} at ${event.title} on ${formattedDate} at ${formattedTime}. Thank you! - ${config.churchName}`;

        const smsResult = await smsService.send({ to: person.phone, message: smsMessage });

        if (smsResult.success) {
          result.smsSent = true;
        } else {
          result.errors.push(`SMS failed: ${smsResult.error}`);
        }
      } catch (err) {
        result.errors.push(`SMS error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Send a single volunteer reminder (manual)
 */
export async function sendSingleReminder(
  assignment: VolunteerAssignment,
  event: VolunteerEvent,
  person: VolunteerPerson,
  config: Omit<ReminderConfig, 'hoursBeforeEvent' | 'enabled'>
): Promise<ReminderResult> {
  const result: ReminderResult = {
    assignmentId: assignment.id,
    personName: `${person.firstName} ${person.lastName}`,
    emailSent: false,
    smsSent: false,
    errors: [],
  };

  const roleName = roleNames[assignment.roleId] || assignment.roleId;
  const eventDate = new Date(event.startDate);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Send email
  if (config.sendEmail && person.email) {
    try {
      const emailResult = await emailService.send({
        to: { email: person.email, name: `${person.firstName} ${person.lastName}` },
        subject: `Reminder: You're serving ${formattedDate}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Volunteer Reminder</h2>
            <p>Hi ${person.firstName},</p>
            <p>This is a reminder about your upcoming volunteer assignment:</p>

            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${event.title}</p>
              <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${roleName}</p>
              <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
              ${event.location ? `<p style="margin: 0;"><strong>Location:</strong> ${event.location}</p>` : ''}
            </div>

            <p>Thank you for serving!</p>
            <p style="margin-top: 24px;">- ${config.churchName}</p>
          </div>
        `,
      });

      result.emailSent = emailResult.success;
      if (!emailResult.success) {
        result.errors.push(`Email: ${emailResult.error}`);
      }
    } catch (err) {
      result.errors.push(`Email: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // Send SMS
  if (config.sendSMS && person.phone) {
    try {
      const smsResult = await smsService.send({
        to: person.phone,
        message: `Hi ${person.firstName}! Reminder: ${roleName} at ${event.title}, ${formattedDate} ${formattedTime}. Thanks! - ${config.churchName}`,
      });

      result.smsSent = smsResult.success;
      if (!smsResult.success) {
        result.errors.push(`SMS: ${smsResult.error}`);
      }
    } catch (err) {
      result.errors.push(`SMS: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return result;
}

// Default configuration
export const defaultReminderConfig: ReminderConfig = {
  enabled: true,
  hoursBeforeEvent: 24, // Send reminder 24 hours before
  sendEmail: true,
  sendSMS: true,
  churchName: 'Our Church',
};

/**
 * Integration Services
 *
 * Central export for all CRM integration services.
 */

export { emailService, EMAIL_TEMPLATES } from './email';
export type {
  EmailRecipient,
  EmailTemplate,
  SendEmailParams,
  EmailResult,
} from './email';

export { smsService, SMS_TEMPLATES } from './sms';
export type {
  SMSRecipient,
  SMSTemplate,
  SendSMSParams,
  SMSResult,
} from './sms';

export { paymentService, GIVING_FUNDS, RECURRING_INTERVALS } from './payments';
export type {
  PaymentMethod,
  CreatePaymentParams,
  CreateSubscriptionParams,
  PaymentResult,
  SubscriptionResult,
  CustomerResult,
} from './payments';

export { authService, ROLE_PERMISSIONS } from './auth';
export type {
  User,
  UserRole,
  UserPermissions,
  AuthState,
  SignInResult,
  InviteUserParams,
  InviteResult,
} from './auth';

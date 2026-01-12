/**
 * Integrations Context
 *
 * Provides access to all CRM integration services (email, SMS, payments).
 * Loads credentials from database so each church can have their own keys.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  emailService,
  smsService,
  paymentService,
  SendEmailParams,
  EmailResult,
  SendSMSParams,
  SMSResult,
  CreatePaymentParams,
  PaymentResult,
} from '../lib/services';
import { useChurchSettings, IntegrationCredentials } from '../hooks/useChurchSettings';

export interface IntegrationStatus {
  email: boolean;
  sms: boolean;
  payments: boolean;
}

interface IntegrationsContextType {
  // Status
  status: IntegrationStatus;
  isLoading: boolean;

  // Configuration - save to database
  saveIntegrations: (config: Partial<IntegrationCredentials>) => Promise<boolean>;
  clearIntegration: (integration: 'email' | 'sms' | 'payments' | 'auth') => Promise<boolean>;

  // Email methods
  sendEmail: (params: SendEmailParams) => Promise<EmailResult>;
  sendWelcomeEmail: (
    to: { email: string; name?: string },
    data: { firstName: string; churchName: string }
  ) => Promise<EmailResult>;
  sendBirthdayEmail: (
    to: { email: string; name?: string },
    data: { firstName: string; churchName: string }
  ) => Promise<EmailResult>;

  // SMS methods
  sendSMS: (params: SendSMSParams) => Promise<SMSResult>;
  sendWelcomeSMS: (
    to: string,
    data: { firstName: string; churchName: string }
  ) => Promise<SMSResult>;
  sendBirthdaySMS: (
    to: string,
    data: { firstName: string; churchName: string }
  ) => Promise<SMSResult>;
  sendEventReminder: (
    to: string | string[],
    data: {
      eventName: string;
      timeUntil: string;
      eventDate: string;
      eventTime: string;
      churchName: string;
    }
  ) => Promise<SMSResult>;

  // Payment methods
  createPaymentIntent: (params: CreatePaymentParams) => Promise<PaymentResult>;
  getStripe: () => ReturnType<typeof paymentService.getStripe>;
}

const IntegrationsContext = createContext<IntegrationsContextType | null>(null);

export function useIntegrations() {
  const context = useContext(IntegrationsContext);
  if (!context) {
    throw new Error('useIntegrations must be used within an IntegrationsProvider');
  }
  return context;
}

export function IntegrationsProvider({ children }: { children: React.ReactNode }) {
  const { settings, isLoading, saveIntegrations: saveToDb, clearIntegration: clearFromDb } = useChurchSettings();
  const [status, setStatus] = useState<IntegrationStatus>({
    email: false,
    sms: false,
    payments: false,
  });

  // Configure services when settings change
  useEffect(() => {
    const { integrations } = settings;

    // First check environment variables (app-level config)
    const envResendKey = import.meta.env.VITE_RESEND_API_KEY;
    const envTwilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const envStripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

    // Configure Email - prefer database, fallback to env
    const resendKey = integrations.resendApiKey || envResendKey;
    if (resendKey) {
      emailService.configure({
        apiKey: resendKey,
        fromEmail: integrations.emailFromAddress || import.meta.env.VITE_EMAIL_FROM_ADDRESS || 'noreply@grace-crm.com',
        fromName: integrations.emailFromName || import.meta.env.VITE_EMAIL_FROM_NAME || 'Grace CRM',
      });
    }

    // Configure SMS - prefer database, fallback to env
    const twilioSid = integrations.twilioAccountSid || envTwilioSid;
    const twilioToken = integrations.twilioAuthToken || import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioPhone = integrations.twilioPhoneNumber || import.meta.env.VITE_TWILIO_PHONE_NUMBER;
    if (twilioSid && twilioToken && twilioPhone) {
      smsService.configure({
        accountSid: twilioSid,
        authToken: twilioToken,
        fromNumber: twilioPhone,
      });
    }

    // Configure Payments - prefer database, fallback to env
    const stripeKey = integrations.stripePublishableKey || envStripeKey;
    if (stripeKey) {
      paymentService.configure({
        publishableKey: stripeKey,
      });
    }

    // Update status
    setStatus({
      email: emailService.isConfigured(),
      sms: smsService.isConfigured(),
      payments: paymentService.isConfigured(),
    });
  }, [settings]);

  // Save integrations to database and reconfigure services
  const saveIntegrations = useCallback(async (config: Partial<IntegrationCredentials>): Promise<boolean> => {
    const success = await saveToDb(config);
    return success;
  }, [saveToDb]);

  // Clear an integration
  const clearIntegration = useCallback(async (integration: 'email' | 'sms' | 'payments' | 'auth'): Promise<boolean> => {
    return clearFromDb(integration);
  }, [clearFromDb]);

  // Email methods
  const sendEmail = useCallback(async (params: SendEmailParams) => {
    return emailService.send(params);
  }, []);

  const sendWelcomeEmail = useCallback(
    async (to: { email: string; name?: string }, data: { firstName: string; churchName: string }) => {
      return emailService.sendWelcomeEmail(to, data);
    },
    []
  );

  const sendBirthdayEmail = useCallback(
    async (to: { email: string; name?: string }, data: { firstName: string; churchName: string }) => {
      return emailService.sendBirthdayEmail(to, data);
    },
    []
  );

  // SMS methods
  const sendSMS = useCallback(async (params: SendSMSParams) => {
    return smsService.send(params);
  }, []);

  const sendWelcomeSMS = useCallback(
    async (to: string, data: { firstName: string; churchName: string }) => {
      return smsService.sendWelcomeSMS(to, data);
    },
    []
  );

  const sendBirthdaySMS = useCallback(
    async (to: string, data: { firstName: string; churchName: string }) => {
      return smsService.sendBirthdaySMS(to, data);
    },
    []
  );

  const sendEventReminder = useCallback(
    async (
      to: string | string[],
      data: {
        eventName: string;
        timeUntil: string;
        eventDate: string;
        eventTime: string;
        churchName: string;
      }
    ) => {
      return smsService.sendEventReminder(to, data);
    },
    []
  );

  // Payment methods
  const createPaymentIntent = useCallback(async (params: CreatePaymentParams) => {
    return paymentService.createPaymentIntent(params);
  }, []);

  const getStripe = useCallback(() => {
    return paymentService.getStripe();
  }, []);

  const value: IntegrationsContextType = {
    status,
    isLoading,
    saveIntegrations,
    clearIntegration,
    sendEmail,
    sendWelcomeEmail,
    sendBirthdayEmail,
    sendSMS,
    sendWelcomeSMS,
    sendBirthdaySMS,
    sendEventReminder,
    createPaymentIntent,
    getStripe,
  };

  return (
    <IntegrationsContext.Provider value={value}>
      {children}
    </IntegrationsContext.Provider>
  );
}

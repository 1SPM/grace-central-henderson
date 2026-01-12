/**
 * Integrations Context
 *
 * Provides access to all CRM integration services (email, SMS, payments).
 * Handles configuration and status of each service.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  emailService,
  smsService,
  paymentService,
  EmailRecipient,
  SendEmailParams,
  EmailResult,
  SendSMSParams,
  SMSResult,
  CreatePaymentParams,
  PaymentResult,
} from '../lib/services';
import { supabase } from '../lib/supabase';

export interface IntegrationStatus {
  email: boolean;
  sms: boolean;
  payments: boolean;
}

export interface IntegrationConfig {
  // Email (Resend)
  resendApiKey?: string;
  emailFromAddress?: string;
  emailFromName?: string;

  // SMS (Twilio)
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;

  // Payments (Stripe)
  stripePublishableKey?: string;
  stripeApiBaseUrl?: string;
}

interface IntegrationsContextType {
  // Status
  status: IntegrationStatus;
  isConfiguring: boolean;

  // Configuration
  configure: (config: Partial<IntegrationConfig>) => void;
  loadConfigFromDatabase: () => Promise<void>;
  saveConfigToDatabase: (config: Partial<IntegrationConfig>) => Promise<boolean>;

  // Email methods
  sendEmail: (params: SendEmailParams) => Promise<EmailResult>;
  sendWelcomeEmail: (
    to: EmailRecipient,
    data: { firstName: string; churchName: string }
  ) => Promise<EmailResult>;
  sendBirthdayEmail: (
    to: EmailRecipient,
    data: { firstName: string; churchName: string }
  ) => Promise<EmailResult>;
  sendFollowUpEmail: (
    to: EmailRecipient,
    data: { firstName: string; churchName: string; customMessage: string; senderName: string }
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
  const [status, setStatus] = useState<IntegrationStatus>({
    email: false,
    sms: false,
    payments: false,
  });
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Configure services from environment variables on mount
  useEffect(() => {
    const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
    const twilioAccountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
    const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

    if (resendApiKey) {
      emailService.configure({
        apiKey: resendApiKey,
        fromEmail: import.meta.env.VITE_EMAIL_FROM_ADDRESS || 'noreply@grace-crm.com',
        fromName: import.meta.env.VITE_EMAIL_FROM_NAME || 'Grace CRM',
      });
    }

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      smsService.configure({
        accountSid: twilioAccountSid,
        authToken: twilioAuthToken,
        fromNumber: twilioPhoneNumber,
      });
    }

    if (stripePublishableKey) {
      paymentService.configure({
        publishableKey: stripePublishableKey,
      });
    }

    // Update status
    setStatus({
      email: emailService.isConfigured(),
      sms: smsService.isConfigured(),
      payments: paymentService.isConfigured(),
    });
  }, []);

  // Configure services with provided config
  const configure = useCallback((config: Partial<IntegrationConfig>) => {
    setIsConfiguring(true);

    if (config.resendApiKey) {
      emailService.configure({
        apiKey: config.resendApiKey,
        fromEmail: config.emailFromAddress,
        fromName: config.emailFromName,
      });
    }

    if (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) {
      smsService.configure({
        accountSid: config.twilioAccountSid,
        authToken: config.twilioAuthToken,
        fromNumber: config.twilioPhoneNumber,
      });
    }

    if (config.stripePublishableKey) {
      paymentService.configure({
        publishableKey: config.stripePublishableKey,
        apiBaseUrl: config.stripeApiBaseUrl,
      });
    }

    setStatus({
      email: emailService.isConfigured(),
      sms: smsService.isConfigured(),
      payments: paymentService.isConfigured(),
    });

    setIsConfiguring(false);
  }, []);

  // Load configuration from database (church settings)
  const loadConfigFromDatabase = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data: church } = await supabase
        .from('churches')
        .select('settings')
        .eq('id', 'demo-church')
        .single();

      if (church?.settings?.integrations) {
        configure(church.settings.integrations);
      }
    } catch (error) {
      console.error('Failed to load integration config:', error);
    }
  }, [configure]);

  // Save configuration to database
  const saveConfigToDatabase = useCallback(
    async (config: Partial<IntegrationConfig>): Promise<boolean> => {
      if (!supabase) return false;

      try {
        const { error } = await supabase
          .from('churches')
          .update({
            settings: {
              integrations: config,
            },
          })
          .eq('id', 'demo-church');

        if (error) {
          console.error('Failed to save integration config:', error);
          return false;
        }

        configure(config);
        return true;
      } catch (error) {
        console.error('Failed to save integration config:', error);
        return false;
      }
    },
    [configure]
  );

  // Email methods
  const sendEmail = useCallback(async (params: SendEmailParams) => {
    return emailService.send(params);
  }, []);

  const sendWelcomeEmail = useCallback(
    async (to: EmailRecipient, data: { firstName: string; churchName: string }) => {
      return emailService.sendWelcomeEmail(to, data);
    },
    []
  );

  const sendBirthdayEmail = useCallback(
    async (to: EmailRecipient, data: { firstName: string; churchName: string }) => {
      return emailService.sendBirthdayEmail(to, data);
    },
    []
  );

  const sendFollowUpEmail = useCallback(
    async (
      to: EmailRecipient,
      data: { firstName: string; churchName: string; customMessage: string; senderName: string }
    ) => {
      return emailService.sendFollowUpEmail(to, data);
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
    isConfiguring,
    configure,
    loadConfigFromDatabase,
    saveConfigToDatabase,
    sendEmail,
    sendWelcomeEmail,
    sendBirthdayEmail,
    sendFollowUpEmail,
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

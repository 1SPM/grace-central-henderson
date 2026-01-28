/**
 * Hook for managing church-specific settings including integrations
 *
 * Each church stores their own API credentials in the database,
 * making it easy to onboard new churches without code changes.
 *
 * SECURITY NOTE: Secret keys (Stripe, Twilio, Resend) should ideally be
 * handled by a backend server. This frontend storage is for development/demo only.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { maskSensitiveData } from '../utils/security';

export interface IntegrationCredentials {
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
  /**
   * @deprecated SECURITY WARNING: Secret keys should NEVER be stored in the frontend.
   * This field exists for development/demo purposes only.
   * In production, implement a backend API to handle Stripe operations.
   */
  stripeSecretKey?: string;

  // Auth (Clerk) - Usually set at app level, not per-church
  clerkPublishableKey?: string;
}

export interface ChurchProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export interface ChurchSettings {
  profile: ChurchProfile;
  integrations: IntegrationCredentials;
  notifications: {
    newVisitorAlerts: boolean;
    taskReminders: boolean;
    prayerNotifications: boolean;
    birthdayReminders: boolean;
  };
  branding: {
    primaryColor?: string;
    logoUrl?: string;
  };
}

const DEFAULT_SETTINGS: ChurchSettings = {
  profile: {
    name: 'Grace Community Church',
    address: '',
    phone: '',
    email: '',
    website: '',
  },
  integrations: {},
  notifications: {
    newVisitorAlerts: true,
    taskReminders: true,
    prayerNotifications: false,
    birthdayReminders: true,
  },
  branding: {},
};

export function useChurchSettings(churchId: string = 'demo-church') {
  const [settings, setSettings] = useState<ChurchSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!supabase) {
      // Demo mode - use localStorage
      const stored = localStorage.getItem(`grace-crm-settings-${churchId}`);
      if (stored) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch {
          setSettings(DEFAULT_SETTINGS);
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('churches')
        .select('settings')
        .eq('id', churchId)
        .single();

      if (fetchError) {
        console.error('Error loading church settings:', fetchError);
        setError(fetchError.message);
      } else if (data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch (err) {
      console.error('Error loading church settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    }

    setIsLoading(false);
  }, [churchId]);

  // Save settings to database
  const saveSettings = useCallback(async (newSettings: Partial<ChurchSettings>): Promise<boolean> => {
    const updatedSettings = { ...settings, ...newSettings };

    if (!supabase) {
      // Demo mode - use localStorage
      localStorage.setItem(`grace-crm-settings-${churchId}`, JSON.stringify(updatedSettings));
      setSettings(updatedSettings);
      return true;
    }

    try {
      const { error: updateError } = await supabase
        .from('churches')
        .update({ settings: updatedSettings })
        .eq('id', churchId);

      if (updateError) {
        console.error('Error saving church settings:', updateError);
        setError(updateError.message);
        return false;
      }

      setSettings(updatedSettings);
      return true;
    } catch (err) {
      console.error('Error saving church settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    }
  }, [churchId, settings]);

  // Save just church profile
  const saveProfile = useCallback(async (profile: Partial<ChurchProfile>): Promise<boolean> => {
    return saveSettings({
      profile: { ...settings.profile, ...profile }
    });
  }, [saveSettings, settings.profile]);

  // Save just integration credentials
  const saveIntegrations = useCallback(async (integrations: Partial<IntegrationCredentials>): Promise<boolean> => {
    // Security warning for secret keys
    if (integrations.stripeSecretKey || integrations.twilioAuthToken || integrations.resendApiKey) {
      console.warn(
        '[SECURITY WARNING] Storing API secrets in the database is not recommended for production. ' +
        'Consider implementing a backend API to handle sensitive operations. ' +
        'Credentials being stored (masked): ',
        {
          stripeSecretKey: integrations.stripeSecretKey ? maskSensitiveData(integrations.stripeSecretKey) : undefined,
          twilioAuthToken: integrations.twilioAuthToken ? maskSensitiveData(integrations.twilioAuthToken) : undefined,
          resendApiKey: integrations.resendApiKey ? maskSensitiveData(integrations.resendApiKey) : undefined,
        }
      );
    }
    return saveSettings({
      integrations: { ...settings.integrations, ...integrations }
    });
  }, [saveSettings, settings.integrations]);

  // Clear a specific integration
  const clearIntegration = useCallback(async (integration: 'email' | 'sms' | 'payments' | 'auth'): Promise<boolean> => {
    const clearedIntegrations = { ...settings.integrations };

    switch (integration) {
      case 'email':
        delete clearedIntegrations.resendApiKey;
        delete clearedIntegrations.emailFromAddress;
        delete clearedIntegrations.emailFromName;
        break;
      case 'sms':
        delete clearedIntegrations.twilioAccountSid;
        delete clearedIntegrations.twilioAuthToken;
        delete clearedIntegrations.twilioPhoneNumber;
        break;
      case 'payments':
        delete clearedIntegrations.stripePublishableKey;
        delete clearedIntegrations.stripeSecretKey;
        break;
      case 'auth':
        delete clearedIntegrations.clerkPublishableKey;
        break;
    }

    return saveSettings({ integrations: clearedIntegrations });
  }, [saveSettings, settings.integrations]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    saveSettings,
    saveProfile,
    saveIntegrations,
    clearIntegration,
    reloadSettings: loadSettings,
  };
}

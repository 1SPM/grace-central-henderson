/**
 * Hook for managing church-specific settings including integrations
 *
 * Each church stores their own non-secret configuration in the database.
 * All secret API keys (Stripe secret, Twilio auth token, Resend API key)
 * are stored exclusively as backend environment variables.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createLogger } from '../utils/logger';

const log = createLogger('church-settings');
const isProduction = import.meta.env.PROD;

export interface IntegrationCredentials {
  // Email (Resend) - only non-secret config; API key lives in backend env vars
  emailFromAddress?: string;
  emailFromName?: string;

  // SMS (Twilio) - only non-secret config; credentials live in backend env vars
  twilioPhoneNumber?: string;

  // Payments (Stripe) - only publishable (public) key
  stripePublishableKey?: string;

  // Auth (Clerk) - Usually set at app level, not per-church
  clerkPublishableKey?: string;
}

export interface ServiceTime {
  day: string;
  time: string;
  name: string;
}

export interface ChurchProfile {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  serviceTimes: ServiceTime[];
}

export interface OnboardingState {
  wizardCompleted: boolean;
  wizardCompletedAt?: string;
  wizardDismissed: boolean;
  completedSteps: string[];
  checklistDismissed: boolean;
  tutorialPickerShown?: boolean;
  completedTutorials?: string[];
  activeTutorial?: string | null;
  activeTutorialStep?: number;
  selectedTutorials?: string[];
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
  onboarding?: OnboardingState;
}

const DEFAULT_SETTINGS: ChurchSettings = {
  profile: {
    name: 'Grace Community Church',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    serviceTimes: [
      { day: 'Sunday', time: '9:00 AM', name: 'Sunday Worship' },
      { day: 'Sunday', time: '11:00 AM', name: 'Sunday Worship' },
      { day: 'Wednesday', time: '7:00 PM', name: 'Bible Study' },
    ],
  },
  integrations: {},
  notifications: {
    newVisitorAlerts: true,
    taskReminders: true,
    prayerNotifications: false,
    birthdayReminders: true,
  },
  branding: {},
  onboarding: {
    wizardCompleted: false,
    wizardDismissed: false,
    completedSteps: [],
    checklistDismissed: false,
  },
};

export function useChurchSettings(churchId: string = 'demo-church') {
  const [settings, setSettings] = useState<ChurchSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  // Error state kept for API compatibility but errors now fall back gracefully
  const [error] = useState<string | null>(null);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!supabase) {
      // Demo mode fallback: avoid persistent browser storage in production
      if (isProduction) {
        setSettings(DEFAULT_SETTINGS);
        setIsLoading(false);
        return;
      }

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
        // Suppress errors for missing rows or missing tables (common in demo/new setups)
        // PGRST116 = row not found, 42P01 = table doesn't exist
        const suppressible = fetchError.code === 'PGRST116' || fetchError.code === '42P01';
        if (!suppressible) {
          log.warn('Church settings load issue, using defaults', fetchError.code);
        }
        // Fall through to use DEFAULT_SETTINGS (already set)
      } else if (data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch (_) {
      // Supabase may be configured but non-functional - silently fall back to defaults
      log.warn('Church settings unavailable, using defaults');
    }

    setIsLoading(false);
  }, [churchId]);

  // Save settings to database
  const saveSettings = useCallback(async (newSettings: Partial<ChurchSettings>): Promise<boolean> => {
    const updatedSettings = { ...settings, ...newSettings };

    if (!supabase) {
      // Demo mode fallback: avoid persistent browser storage in production
      if (!isProduction) {
        localStorage.setItem(`grace-crm-settings-${churchId}`, JSON.stringify(updatedSettings));
      }
      setSettings(updatedSettings);
      return true;
    }

    try {
      const { error: updateError } = await supabase
        .from('churches')
        .update({ settings: updatedSettings })
        .eq('id', churchId);

      if (updateError) {
        log.warn('Supabase save failed for church settings, saving locally', updateError.code);
        // Fall back to local state only (don't block the user)
        setSettings(updatedSettings);
        return true;
      }

      setSettings(updatedSettings);
      return true;
    } catch (_) {
      log.warn('Church settings save failed, updating local state only');
      // Fall back to local state
      setSettings(updatedSettings);
      return true;
    }
  }, [churchId, settings]);

  // Save just church profile
  const saveProfile = useCallback(async (profile: Partial<ChurchProfile>): Promise<boolean> => {
    return saveSettings({
      profile: { ...settings.profile, ...profile }
    });
  }, [saveSettings, settings.profile]);

  // Save just integration credentials (non-secret only)
  const saveIntegrations = useCallback(async (integrations: Partial<IntegrationCredentials>): Promise<boolean> => {
    return saveSettings({
      integrations: { ...settings.integrations, ...integrations }
    });
  }, [saveSettings, settings.integrations]);

  // Save just onboarding state
  const saveOnboarding = useCallback(async (onboarding: Partial<OnboardingState>): Promise<boolean> => {
    return saveSettings({
      onboarding: { ...DEFAULT_SETTINGS.onboarding!, ...settings.onboarding, ...onboarding }
    });
  }, [saveSettings, settings.onboarding]);

  // Clear a specific integration's frontend config
  const clearIntegration = useCallback(async (integration: 'email' | 'sms' | 'payments' | 'auth'): Promise<boolean> => {
    const clearedIntegrations = { ...settings.integrations };

    switch (integration) {
      case 'email':
        delete clearedIntegrations.emailFromAddress;
        delete clearedIntegrations.emailFromName;
        break;
      case 'sms':
        delete clearedIntegrations.twilioPhoneNumber;
        break;
      case 'payments':
        delete clearedIntegrations.stripePublishableKey;
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
    saveOnboarding,
    clearIntegration,
    reloadSettings: loadSettings,
  };
}

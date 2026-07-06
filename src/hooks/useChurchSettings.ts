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
import { TENANT_DEFAULT_SETTINGS, TENANT_DEMO_ONBOARDING_SKIP } from '../config/tenant';
import { hasEnteredDemo, isDemoModeEnabled, DEMO_ENTERED_EVENT } from '../lib/demoEntry';

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

export interface CurrentSeries {
  title: string;
  part?: string;
  speaker?: string;
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
  liveStreamUrl?: string;
  currentSeries?: CurrentSeries;
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
  graceIntroDismissed?: boolean;
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
  /** Pastor-curated facts for Grace AI (stored as grace_facts in DB JSON). */
  graceFacts?: string;
  /** IANA timezone for clocks and scheduling display. */
  timezone?: string;
  onboarding?: OnboardingState;
}

const DEFAULT_SETTINGS: ChurchSettings = TENANT_DEFAULT_SETTINGS;

function applyDemoOnboardingIfEntered(settings: ChurchSettings): ChurchSettings {
  if (!isDemoModeEnabled || !hasEnteredDemo()) return settings;
  return {
    ...settings,
    onboarding: {
      ...(settings.onboarding ?? {}),
      ...TENANT_DEMO_ONBOARDING_SKIP,
      completedSteps: [...TENANT_DEMO_ONBOARDING_SKIP.completedSteps],
    },
  };
}

function normalizeSettings(raw: Record<string, unknown>): Partial<ChurchSettings> {
  const { grace_facts, ...rest } = raw;
  const merged = rest as Partial<ChurchSettings>;
  if (typeof grace_facts === 'string') merged.graceFacts = grace_facts;
  return merged;
}

/**
 * Stored settings can be partial (e.g. a row seeded with just profile.name).
 * A shallow spread would replace whole sections and drop required fields
 * like profile.serviceTimes, so merge each section against the defaults.
 */
function mergeWithDefaults(partial: Partial<ChurchSettings>): ChurchSettings {
  return applyDemoOnboardingIfEntered({
    ...DEFAULT_SETTINGS,
    ...partial,
    profile: { ...DEFAULT_SETTINGS.profile, ...partial.profile },
    integrations: { ...DEFAULT_SETTINGS.integrations, ...partial.integrations },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...partial.notifications },
    branding: { ...DEFAULT_SETTINGS.branding, ...partial.branding },
    onboarding: { ...DEFAULT_SETTINGS.onboarding!, ...partial.onboarding },
  });
}

function settingsForStorage(settings: ChurchSettings): Record<string, unknown> {
  const { graceFacts, ...rest } = settings;
  return {
    ...rest,
    ...(graceFacts ? { grace_facts: graceFacts } : {}),
  };
}

export function useChurchSettings(churchId: string = 'demo-church') {
  const [settings, setSettings] = useState<ChurchSettings>(DEFAULT_SETTINGS);
  const [churchSlug, setChurchSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Error state kept for API compatibility but errors now fall back gracefully
  const [error] = useState<string | null>(null);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!supabase) {
      // Demo mode fallback: avoid persistent browser storage in production
      if (isProduction) {
        setSettings(applyDemoOnboardingIfEntered(DEFAULT_SETTINGS));
        setIsLoading(false);
        return;
      }

      const stored = localStorage.getItem(`grace-crm-settings-${churchId}`);
      if (stored) {
        try {
          setSettings(mergeWithDefaults(normalizeSettings(JSON.parse(stored))));
        } catch {
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('churches')
        .select('settings, slug')
        .eq('id', churchId)
        .single();

      if (data?.slug) {
        setChurchSlug(data.slug as string);
      }

      if (fetchError) {
        // Suppress errors for missing rows or missing tables (common in demo/new setups)
        // PGRST116 = row not found, 42P01 = table doesn't exist
        const suppressible = fetchError.code === 'PGRST116' || fetchError.code === '42P01';
        if (!suppressible) {
          log.warn('Church settings load issue, using defaults', fetchError.code);
        }
        // Fall through to use DEFAULT_SETTINGS (already set)
      } else if (data?.settings) {
        setSettings(mergeWithDefaults(normalizeSettings(data.settings as Record<string, unknown>)));
      }
    } catch {
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
        localStorage.setItem(`grace-crm-settings-${churchId}`, JSON.stringify(settingsForStorage(updatedSettings)));
      }
      setSettings(updatedSettings);
      return true;
    }

    try {
      const { error: updateError } = await supabase
        .from('churches')
        .update({ settings: settingsForStorage(updatedSettings) })
        .eq('id', churchId);

      if (updateError) {
        log.warn('Supabase save failed for church settings, saving locally', updateError.code);
        // Fall back to local state only (don't block the user)
        setSettings(updatedSettings);
        return true;
      }

      setSettings(updatedSettings);
      return true;
    } catch {
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

  const saveGraceFacts = useCallback(async (graceFacts: string): Promise<boolean> => {
    return saveSettings({ graceFacts });
  }, [saveSettings]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Re-apply onboarding skip when visitor enters demo mid-session
  useEffect(() => {
    const onDemoEntered = () => setSettings(prev => applyDemoOnboardingIfEntered(prev));
    window.addEventListener(DEMO_ENTERED_EVENT, onDemoEntered);
    return () => window.removeEventListener(DEMO_ENTERED_EVENT, onDemoEntered);
  }, []);

  return {
    settings,
    churchSlug,
    isLoading,
    error,
    saveSettings,
    saveProfile,
    saveGraceFacts,
    saveIntegrations,
    saveOnboarding,
    clearIntegration,
    reloadSettings: loadSettings,
  };
}

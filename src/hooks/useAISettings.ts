import { useState, useEffect, useCallback } from 'react';

export interface AIFeature {
  id: string;
  name: string;
  description: string;
  location: string;
  enabled: boolean;
}

export interface AISettings {
  sermonGenerator: boolean;
  sectionExpander: boolean;
  newsCuration: boolean;
  personalizedMessages: boolean;
  messageComposer: boolean;
  aiAssistant: boolean;
  smartSearch: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  sermonGenerator: true,
  sectionExpander: true,
  newsCuration: true,
  personalizedMessages: true,
  messageComposer: true,
  aiAssistant: true,
  smartSearch: true,
};

const STORAGE_KEY = 'grace-ai-settings';

export const AI_FEATURES: AIFeature[] = [
  {
    id: 'sermonGenerator',
    name: 'Sermon Generator',
    description: 'Generate complete sermon outlines with AI',
    location: 'Sunday Prep',
    enabled: true,
  },
  {
    id: 'sectionExpander',
    name: 'Section Expander',
    description: 'Expand sermon sections with AI-generated content',
    location: 'Sunday Prep',
    enabled: true,
  },
  {
    id: 'newsCuration',
    name: 'News Curation',
    description: 'Find Biblical connections for current news stories',
    location: 'Sunday Prep',
    enabled: true,
  },
  {
    id: 'personalizedMessages',
    name: 'Personalized Messages',
    description: 'AI-suggested messages for follow-ups and outreach',
    location: 'Action Feed',
    enabled: true,
  },
  {
    id: 'messageComposer',
    name: 'Message Composer',
    description: 'Generate personalized emails and messages',
    location: 'Person Profile',
    enabled: true,
  },
  {
    id: 'aiAssistant',
    name: 'AI Assistant',
    description: 'Floating assistant for ministry insights and suggestions',
    location: 'Global (bottom right)',
    enabled: true,
  },
  {
    id: 'smartSearch',
    name: 'Smart Search',
    description: 'Ask questions about your congregation in natural language',
    location: 'Search Bar',
    enabled: true,
  },
];

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load AI settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save AI settings:', e);
    }
  }, [settings]);

  const updateSetting = useCallback((key: keyof AISettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleSetting = useCallback((key: keyof AISettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const enableAll = useCallback(() => {
    setSettings({
      sermonGenerator: true,
      sectionExpander: true,
      newsCuration: true,
      personalizedMessages: true,
      messageComposer: true,
      aiAssistant: true,
      smartSearch: true,
    });
  }, []);

  const disableAll = useCallback(() => {
    setSettings({
      sermonGenerator: false,
      sectionExpander: false,
      newsCuration: false,
      personalizedMessages: false,
      messageComposer: false,
      aiAssistant: false,
      smartSearch: false,
    });
  }, []);

  const isEnabled = useCallback((key: keyof AISettings) => {
    return settings[key];
  }, [settings]);

  return {
    settings,
    updateSetting,
    toggleSetting,
    enableAll,
    disableAll,
    isEnabled,
  };
}

/**
 * useAgents Hook
 *
 * Manages agent configuration, state, and execution.
 * Provides a unified interface for the agent dashboard.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  LifeEventAgent,
  DonationProcessingAgent,
  NewMemberAgent,
  createDefaultLifeEventConfig,
  createDefaultDonationConfig,
  createDefaultNewMemberConfig,
} from '../lib/agents';
import type {
  LifeEventConfig,
  DonationProcessingConfig,
  NewMemberConfig,
  AgentLog,
  AgentStats,
  AgentContext,
  LifeEvent,
  AgentConfig,
} from '../lib/agents/types';

interface PersonData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  joinDate?: string;
  status: string;
}

interface GivingData {
  id: string;
  personId?: string;
  amount: number;
  fund: string;
  date: string;
  method: string;
  isRecurring: boolean;
}

interface UseAgentsOptions {
  churchId: string;
  churchName: string;
  people: PersonData[];
  giving: GivingData[];
  onCreateTask?: (task: {
    personId: string;
    title: string;
    description?: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    category: 'follow-up' | 'care' | 'admin' | 'outreach';
    assignedTo?: string;
  }) => Promise<void>;
}

const STORAGE_KEY_PREFIX = 'grace-crm-agent-';

export function useAgents({
  churchId,
  churchName,
  people,
  giving,
  onCreateTask,
}: UseAgentsOptions) {
  // Load configs from localStorage or use defaults
  const [lifeEventConfig, setLifeEventConfig] = useState<LifeEventConfig>(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}life-event`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall through to default
      }
    }
    return createDefaultLifeEventConfig(churchName);
  });

  const [donationConfig, setDonationConfig] = useState<DonationProcessingConfig>(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}donation`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall through to default
      }
    }
    return createDefaultDonationConfig(churchName);
  });

  const [newMemberConfig, setNewMemberConfig] = useState<NewMemberConfig>(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}new-member`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall through to default
      }
    }
    return createDefaultNewMemberConfig(churchName);
  });

  // Agent logs
  const [logs, setLogs] = useState<AgentLog[]>([]);

  // Agent stats
  const [stats, setStats] = useState<{
    lifeEvent: AgentStats;
    donation: AgentStats;
    newMember: AgentStats;
  }>({
    lifeEvent: {
      agentId: 'life-event-agent',
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
    },
    donation: {
      agentId: 'donation-processing-agent',
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
    },
    newMember: {
      agentId: 'new-member-agent',
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
    },
  });

  // Persist configs to localStorage
  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}life-event`,
      JSON.stringify(lifeEventConfig)
    );
  }, [lifeEventConfig]);

  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}donation`,
      JSON.stringify(donationConfig)
    );
  }, [donationConfig]);

  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}new-member`,
      JSON.stringify(newMemberConfig)
    );
  }, [newMemberConfig]);

  // Create agent context
  const createContext = useCallback(
    (dryRun: boolean = false): AgentContext => ({
      churchId,
      churchName,
      currentDate: new Date(),
      dryRun,
    }),
    [churchId, churchName]
  );

  // Toggle agent enabled state
  const toggleAgent = useCallback((agentId: string, enabled: boolean) => {
    switch (agentId) {
      case 'life-event-agent':
        setLifeEventConfig((prev) => ({
          ...prev,
          enabled,
          updatedAt: new Date().toISOString(),
        }));
        break;
      case 'donation-processing-agent':
        setDonationConfig((prev) => ({
          ...prev,
          enabled,
          updatedAt: new Date().toISOString(),
        }));
        break;
      case 'new-member-agent':
        setNewMemberConfig((prev) => ({
          ...prev,
          enabled,
          updatedAt: new Date().toISOString(),
        }));
        break;
    }
  }, []);

  // Update agent configuration
  const updateConfig = useCallback(
    (agentId: string, updates: Partial<AgentConfig>) => {
      const applyUpdates = <T extends AgentConfig>(prev: T): T => ({
        ...prev,
        ...updates,
        settings: updates.settings
          ? { ...prev.settings, ...updates.settings }
          : prev.settings,
        updatedAt: new Date().toISOString(),
      });

      switch (agentId) {
        case 'life-event-agent':
          setLifeEventConfig(applyUpdates);
          break;
        case 'donation-processing-agent':
          setDonationConfig(applyUpdates);
          break;
        case 'new-member-agent':
          setNewMemberConfig(applyUpdates);
          break;
      }
    },
    []
  );

  // Add logs and update stats
  const processResults = useCallback(
    (
      agentId: string,
      newLogs: AgentLog[],
      actionsExecuted: number,
      actionsFailed: number
    ) => {
      // Add new logs
      setLogs((prev) => [...newLogs, ...prev].slice(0, 500)); // Keep last 500 logs

      // Update stats
      setStats((prev) => {
        const key =
          agentId === 'life-event-agent'
            ? 'lifeEvent'
            : agentId === 'donation-processing-agent'
              ? 'donation'
              : 'newMember';

        return {
          ...prev,
          [key]: {
            ...prev[key],
            totalActions: prev[key].totalActions + actionsExecuted + actionsFailed,
            successfulActions: prev[key].successfulActions + actionsExecuted,
            failedActions: prev[key].failedActions + actionsFailed,
            lastRunAt: new Date().toISOString(),
          },
        };
      });
    },
    []
  );

  // Run Life Event Agent
  const runLifeEventAgent = useCallback(
    async (dryRun: boolean = false) => {
      const context = createContext(dryRun);
      const agent = new LifeEventAgent(
        lifeEventConfig,
        context,
        people.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          birthDate: p.birthDate,
          joinDate: p.joinDate,
          status: p.status,
        }))
      );

      const result = await agent.execute();
      processResults(
        'life-event-agent',
        result.logs,
        result.actionsExecuted,
        result.actionsFailed
      );
      return result;
    },
    [lifeEventConfig, people, createContext, processResults]
  );

  // Run Donation Processing Agent
  const runDonationAgent = useCallback(
    async (donations?: GivingData[], dryRun: boolean = false) => {
      const context = createContext(dryRun);

      // Get existing donor IDs (people who have donated before)
      const existingDonorIds = [...new Set(giving.map((g) => g.personId).filter(Boolean))] as string[];

      const agent = new DonationProcessingAgent(
        donationConfig,
        context,
        donations || [],
        people.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
        })),
        existingDonorIds
      );

      const result = await agent.execute();
      processResults(
        'donation-processing-agent',
        result.logs,
        result.actionsExecuted,
        result.actionsFailed
      );
      return result;
    },
    [donationConfig, people, giving, createContext, processResults]
  );

  // Run New Member Agent
  const runNewMemberAgent = useCallback(
    async (dryRun: boolean = false) => {
      const context = createContext(dryRun);
      const agent = new NewMemberAgent(
        newMemberConfig,
        context,
        people.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          status: p.status,
          joinDate: p.joinDate,
          firstVisit: undefined, // Not available in legacy type
        })),
        { onCreateTask }
      );

      const result = await agent.execute();
      processResults(
        'new-member-agent',
        result.logs,
        result.actionsExecuted,
        result.actionsFailed
      );
      return result;
    },
    [newMemberConfig, people, createContext, processResults, onCreateTask]
  );

  // Run specific agent
  const runAgent = useCallback(
    async (agentId: string) => {
      switch (agentId) {
        case 'life-event-agent':
          return runLifeEventAgent();
        case 'donation-processing-agent':
          return runDonationAgent();
        case 'new-member-agent':
          return runNewMemberAgent();
        default:
          throw new Error(`Unknown agent: ${agentId}`);
      }
    },
    [runLifeEventAgent, runDonationAgent, runNewMemberAgent]
  );

  // Get upcoming life events
  const upcomingLifeEvents = useMemo((): LifeEvent[] => {
    const context = createContext();
    const agent = new LifeEventAgent(
      lifeEventConfig,
      context,
      people.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        birthDate: p.birthDate,
        joinDate: p.joinDate,
        status: p.status,
      }))
    );
    return agent.getUpcomingEvents(7);
  }, [lifeEventConfig, people, createContext]);

  // Handle new member status change
  const handleNewMember = useCallback(
    async (
      personId: string,
      previousStatus: string,
      newStatus: string
    ) => {
      if (newStatus !== 'member' || !newMemberConfig.enabled) return;

      const person = people.find((p) => p.id === personId);
      if (!person) return;

      const context = createContext();
      const agent = new NewMemberAgent(newMemberConfig, context, [], { onCreateTask });

      await agent.handleNewMember({
        personId,
        personName: `${person.firstName} ${person.lastName}`,
        email: person.email,
        phone: person.phone,
        previousStatus,
        newStatus,
        joinDate: new Date().toISOString(),
      });
    },
    [newMemberConfig, people, createContext, onCreateTask]
  );

  // Process new donation
  const handleNewDonation = useCallback(
    async (donation: GivingData) => {
      if (!donationConfig.enabled) return;
      return runDonationAgent([donation]);
    },
    [donationConfig.enabled, runDonationAgent]
  );

  return {
    // Configs
    lifeEventConfig,
    donationConfig,
    newMemberConfig,

    // State
    logs,
    stats,
    upcomingLifeEvents,

    // Actions
    toggleAgent,
    updateConfig,
    runAgent,
    runLifeEventAgent,
    runDonationAgent,
    runNewMemberAgent,

    // Event handlers
    handleNewMember,
    handleNewDonation,
  };
}

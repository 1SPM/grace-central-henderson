/**
 * Agent API Routes
 *
 * Provides endpoints for agent execution and configuration.
 * Logs and stats are persisted to Supabase for reliability.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Fallback in-memory storage when Supabase is not configured
let memoryLogs: Array<{
  id: string;
  agentId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}> = [];

const memoryStats: Record<
  string,
  {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    lastRunAt?: string;
  }
> = {
  'life-event-agent': { totalActions: 0, successfulActions: 0, failedActions: 0 },
  'donation-processing-agent': { totalActions: 0, successfulActions: 0, failedActions: 0 },
  'new-member-agent': { totalActions: 0, successfulActions: 0, failedActions: 0 },
};

const VALID_AGENTS = ['life-event-agent', 'donation-processing-agent', 'new-member-agent'];

/**
 * GET /api/agents/health
 * Check agent service health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agents: VALID_AGENTS,
    storage: supabase ? 'supabase' : 'memory',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/agents/stats
 * Get agent execution statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  const churchId = req.query.churchId as string;

  if (supabase && churchId) {
    try {
      const { data, error } = await supabase
        .from('agent_stats')
        .select('*')
        .eq('church_id', churchId);

      if (error) throw error;

      // Transform to expected format
      const stats: Record<string, unknown> = {};
      for (const agent of VALID_AGENTS) {
        const agentData = data?.find((d) => d.agent_id === agent);
        stats[agent] = agentData
          ? {
              totalActions: agentData.total_actions,
              successfulActions: agentData.successful_actions,
              failedActions: agentData.failed_actions,
              lastRunAt: agentData.last_run_at,
            }
          : { totalActions: 0, successfulActions: 0, failedActions: 0 };
      }

      return res.json(stats);
    } catch (error) {
      console.error('Failed to fetch stats from Supabase:', error);
      // Fall through to memory stats
    }
  }

  res.json(memoryStats);
});

/**
 * GET /api/agents/logs
 * Get recent agent logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const agentId = req.query.agentId as string;
  const level = req.query.level as string;
  const churchId = req.query.churchId as string;

  if (supabase && churchId) {
    try {
      let query = supabase
        .from('agent_logs')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      if (level) {
        query = query.eq('level', level);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform to expected format
      const logs = data?.map((log) => ({
        id: log.id,
        agentId: log.agent_id,
        level: log.level,
        message: log.message,
        metadata: log.metadata,
        timestamp: log.created_at,
      }));

      return res.json(logs || []);
    } catch (error) {
      console.error('Failed to fetch logs from Supabase:', error);
      // Fall through to memory logs
    }
  }

  // Memory fallback
  let filteredLogs = memoryLogs;

  if (agentId) {
    filteredLogs = filteredLogs.filter((log) => log.agentId === agentId);
  }

  if (level) {
    filteredLogs = filteredLogs.filter((log) => log.level === level);
  }

  res.json(filteredLogs.slice(0, limit));
});

/**
 * POST /api/agents/logs
 * Add agent logs (called from frontend after agent execution)
 */
router.post('/logs', async (req: Request, res: Response) => {
  const { logs, churchId } = req.body;

  if (!Array.isArray(logs)) {
    return res.status(400).json({ error: 'logs must be an array' });
  }

  if (supabase && churchId) {
    try {
      const dbLogs = logs.map((log) => ({
        church_id: churchId,
        agent_id: log.agentId,
        level: log.level,
        message: log.message,
        metadata: log.metadata || {},
      }));

      const { error } = await supabase.from('agent_logs').insert(dbLogs);

      if (error) throw error;

      // Cleanup old logs (keep last 1000 per church)
      const { data: oldLogs } = await supabase
        .from('agent_logs')
        .select('id')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .range(1000, 10000);

      if (oldLogs && oldLogs.length > 0) {
        const idsToDelete = oldLogs.map((l) => l.id);
        await supabase.from('agent_logs').delete().in('id', idsToDelete);
      }

      return res.json({ success: true, storage: 'supabase' });
    } catch (error) {
      console.error('Failed to save logs to Supabase:', error);
      // Fall through to memory storage
    }
  }

  // Memory fallback
  const formattedLogs = logs.map((log) => ({
    ...log,
    id: log.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: log.timestamp || new Date().toISOString(),
  }));

  memoryLogs = [...formattedLogs, ...memoryLogs].slice(0, 1000);

  res.json({ success: true, totalLogs: memoryLogs.length, storage: 'memory' });
});

/**
 * POST /api/agents/:agentId/stats
 * Update agent stats (called from frontend after agent execution)
 */
router.post('/:agentId/stats', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { actionsExecuted, actionsFailed, churchId } = req.body;

  if (!VALID_AGENTS.includes(agentId)) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const executed = actionsExecuted || 0;
  const failed = actionsFailed || 0;

  if (supabase && churchId) {
    try {
      // Upsert stats
      const { data: existing } = await supabase
        .from('agent_stats')
        .select('*')
        .eq('church_id', churchId)
        .eq('agent_id', agentId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('agent_stats')
          .update({
            total_actions: existing.total_actions + executed + failed,
            successful_actions: existing.successful_actions + executed,
            failed_actions: existing.failed_actions + failed,
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('agent_stats').insert({
          church_id: churchId,
          agent_id: agentId,
          total_actions: executed + failed,
          successful_actions: executed,
          failed_actions: failed,
          last_run_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      return res.json({
        agentId,
        totalActions: (existing?.total_actions || 0) + executed + failed,
        successfulActions: (existing?.successful_actions || 0) + executed,
        failedActions: (existing?.failed_actions || 0) + failed,
        lastRunAt: new Date().toISOString(),
        storage: 'supabase',
      });
    } catch (error) {
      console.error('Failed to update stats in Supabase:', error);
      // Fall through to memory storage
    }
  }

  // Memory fallback
  memoryStats[agentId] = {
    totalActions: memoryStats[agentId].totalActions + executed + failed,
    successfulActions: memoryStats[agentId].successfulActions + executed,
    failedActions: memoryStats[agentId].failedActions + failed,
    lastRunAt: new Date().toISOString(),
  };

  res.json({ ...memoryStats[agentId], storage: 'memory' });
});

/**
 * POST /api/agents/:agentId/trigger
 * Trigger an agent to run (for scheduled/cron execution)
 */
router.post('/:agentId/trigger', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { churchId, dryRun } = req.body;

  if (!VALID_AGENTS.includes(agentId)) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const triggerLog = {
    agentId,
    level: 'info' as const,
    message: `Agent triggered via API${dryRun ? ' (dry run)' : ''}`,
    metadata: { churchId, dryRun, triggeredAt: new Date().toISOString() },
  };

  // Log the trigger
  if (supabase && churchId) {
    try {
      await supabase.from('agent_logs').insert({
        church_id: churchId,
        agent_id: agentId,
        level: triggerLog.level,
        message: triggerLog.message,
        metadata: triggerLog.metadata,
      });

      // Create execution record
      await supabase.from('agent_executions').insert({
        church_id: churchId,
        agent_id: agentId,
        status: 'running',
        dry_run: dryRun || false,
      });
    } catch (error) {
      console.error('Failed to log trigger to Supabase:', error);
    }
  } else {
    // Memory fallback
    memoryLogs = [
      {
        ...triggerLog,
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
      ...memoryLogs,
    ].slice(0, 1000);
  }

  res.json({
    success: true,
    message: `Agent ${agentId} trigger logged. Execute via frontend with data access.`,
    triggeredAt: new Date().toISOString(),
  });
});

/**
 * DELETE /api/agents/logs
 * Clear agent logs
 */
router.delete('/logs', async (req: Request, res: Response) => {
  const churchId = req.query.churchId as string;

  if (supabase && churchId) {
    try {
      const { error } = await supabase
        .from('agent_logs')
        .delete()
        .eq('church_id', churchId);

      if (error) throw error;

      return res.json({ success: true, message: 'Logs cleared', storage: 'supabase' });
    } catch (error) {
      console.error('Failed to clear logs in Supabase:', error);
    }
  }

  memoryLogs = [];
  res.json({ success: true, message: 'Logs cleared', storage: 'memory' });
});

/**
 * POST /api/agents/reset-stats
 * Reset agent statistics
 */
router.post('/reset-stats', async (req: Request, res: Response) => {
  const { churchId } = req.body;

  if (supabase && churchId) {
    try {
      const { error } = await supabase
        .from('agent_stats')
        .delete()
        .eq('church_id', churchId);

      if (error) throw error;

      return res.json({ success: true, message: 'Stats reset', storage: 'supabase' });
    } catch (error) {
      console.error('Failed to reset stats in Supabase:', error);
    }
  }

  // Memory fallback
  for (const agentId of Object.keys(memoryStats)) {
    memoryStats[agentId] = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
    };
  }

  res.json({ success: true, message: 'Stats reset', storage: 'memory' });
});

export default router;

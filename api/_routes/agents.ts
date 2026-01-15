/**
 * Agent API Routes
 *
 * Provides endpoints for agent execution and configuration.
 * Agents can be triggered manually or scheduled via external cron.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// In-memory storage for agent logs (in production, use database)
let agentLogs: Array<{
  id: string;
  agentId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}> = [];

// Agent execution stats
const agentStats: Record<string, {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  lastRunAt?: string;
}> = {
  'life-event-agent': { totalActions: 0, successfulActions: 0, failedActions: 0 },
  'donation-processing-agent': { totalActions: 0, successfulActions: 0, failedActions: 0 },
  'new-member-agent': { totalActions: 0, successfulActions: 0, failedActions: 0 },
};

/**
 * GET /api/agents/health
 * Check agent service health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agents: ['life-event-agent', 'donation-processing-agent', 'new-member-agent'],
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/agents/stats
 * Get agent execution statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  res.json(agentStats);
});

/**
 * GET /api/agents/logs
 * Get recent agent logs
 */
router.get('/logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const agentId = req.query.agentId as string;
  const level = req.query.level as string;

  let filteredLogs = agentLogs;

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
router.post('/logs', (req: Request, res: Response) => {
  const { logs } = req.body;

  if (!Array.isArray(logs)) {
    return res.status(400).json({ error: 'logs must be an array' });
  }

  // Add new logs and keep only last 1000
  agentLogs = [...logs, ...agentLogs].slice(0, 1000);

  res.json({ success: true, totalLogs: agentLogs.length });
});

/**
 * POST /api/agents/:agentId/stats
 * Update agent stats (called from frontend after agent execution)
 */
router.post('/:agentId/stats', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { actionsExecuted, actionsFailed } = req.body;

  if (!agentStats[agentId]) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  agentStats[agentId] = {
    totalActions: agentStats[agentId].totalActions + (actionsExecuted || 0) + (actionsFailed || 0),
    successfulActions: agentStats[agentId].successfulActions + (actionsExecuted || 0),
    failedActions: agentStats[agentId].failedActions + (actionsFailed || 0),
    lastRunAt: new Date().toISOString(),
  };

  res.json(agentStats[agentId]);
});

/**
 * POST /api/agents/:agentId/trigger
 * Trigger an agent to run (for scheduled/cron execution)
 * This endpoint is called by external schedulers (e.g., Vercel Cron, GitHub Actions)
 */
router.post('/:agentId/trigger', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { churchId, dryRun } = req.body;

  if (!agentStats[agentId]) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // Log the trigger
  const triggerLog = {
    id: `log-${Date.now()}`,
    agentId,
    level: 'info' as const,
    message: `Agent triggered via API${dryRun ? ' (dry run)' : ''}`,
    metadata: { churchId, dryRun },
    timestamp: new Date().toISOString(),
  };

  agentLogs = [triggerLog, ...agentLogs].slice(0, 1000);

  // Note: Actual agent execution happens in the frontend with data access
  // This endpoint is for scheduling and logging purposes
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
router.delete('/logs', (_req: Request, res: Response) => {
  agentLogs = [];
  res.json({ success: true, message: 'Logs cleared' });
});

/**
 * POST /api/agents/reset-stats
 * Reset agent statistics
 */
router.post('/reset-stats', (_req: Request, res: Response) => {
  for (const agentId of Object.keys(agentStats)) {
    agentStats[agentId] = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
    };
  }
  res.json({ success: true, message: 'Stats reset' });
});

export default router;

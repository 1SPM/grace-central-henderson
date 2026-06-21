import { createLogger } from '../../utils/logger';
import { getClerkTokenProvider } from '../supabase';

const log = createLogger('sermon-video');

export type SermonVideoStatus = 'queued' | 'running' | 'completed' | 'failed';
export type SermonVideoAspectRatio = '16:9' | '9:16';
export type SermonVideoResolution = '720p' | '1080p';
export type SermonVideoDuration = 4 | 6 | 8;

export interface SermonVideoJob {
  id: string;
  status: SermonVideoStatus;
  operationName?: string | null;
  prompt: string;
  negativePrompt?: string | null;
  model?: string;
  aspectRatio: SermonVideoAspectRatio;
  resolution: SermonVideoResolution;
  durationSeconds: SermonVideoDuration;
  storagePath?: string | null;
  videoUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface StartSermonVideoInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: SermonVideoAspectRatio;
  durationSeconds: SermonVideoDuration;
  resolution: SermonVideoResolution;
}

export interface SermonVideoResult {
  success: boolean;
  job?: SermonVideoJob;
  jobs?: SermonVideoJob[];
  error?: string;
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const provider = getClerkTokenProvider();
    const token = provider ? await provider() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Backend will return an auth error.
  }
  return headers;
}

async function parseJsonOrText(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text().catch(() => '');
  return text ? { error: text } : {};
}

function errorFrom(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === 'string' && data.error.trim() ? data.error.trim() : fallback;
}

export async function startSermonVideoJob(input: StartSermonVideoInput): Promise<SermonVideoResult> {
  try {
    const response = await fetch('/api/ai/video/start', {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(input),
    });
    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return { success: false, error: errorFrom(data, `Request failed (${response.status})`) };
    }
    return { success: true, job: data.job as SermonVideoJob };
  } catch (error) {
    log.error('Failed to start sermon video job', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export async function pollSermonVideoJob(jobId: string): Promise<SermonVideoResult> {
  try {
    const response = await fetch(`/api/ai/video/status?jobId=${encodeURIComponent(jobId)}`, {
      headers: await buildHeaders(),
    });
    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return {
        success: false,
        error: errorFrom(data, `Status check failed (${response.status})`),
        job: data.job as SermonVideoJob | undefined,
      };
    }
    return { success: true, job: data.job as SermonVideoJob };
  } catch (error) {
    log.error('Failed to poll sermon video job', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export async function listSermonVideoJobs(limit = 8): Promise<SermonVideoResult> {
  try {
    const response = await fetch(`/api/ai/video/status?limit=${limit}`, {
      headers: await buildHeaders(),
    });
    const data = await parseJsonOrText(response);
    if (!response.ok) {
      return { success: false, error: errorFrom(data, `List failed (${response.status})`) };
    }
    return { success: true, jobs: data.jobs as SermonVideoJob[] };
  } catch (error) {
    log.error('Failed to list sermon video jobs', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

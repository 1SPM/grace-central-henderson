import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { requireClerkAuth } from '../../_lib/auth-helper.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'sermon-videos';

interface JobRow {
  id: string;
  church_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  operation_name: string | null;
  prompt: string;
  negative_prompt: string | null;
  model: string;
  aspect_ratio: string;
  resolution: string;
  duration_seconds: number;
  storage_path: string | null;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function mapJob(row: JobRow, signedUrl?: string | null) {
  return {
    id: row.id,
    status: row.status,
    operationName: row.operation_name,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt,
    model: row.model,
    aspectRatio: row.aspect_ratio,
    resolution: row.resolution,
    durationSeconds: row.duration_seconds,
    storagePath: row.storage_path,
    videoUrl: signedUrl ?? row.video_url,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function publicProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate|billing|spend|limit/i.test(message)) {
    return 'Gemini video generation quota or billing limit reached. Check Google AI Studio billing, spend caps, and Veo access.';
  }
  return message.slice(0, 240);
}

async function createSignedUrl(supabase: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error) return null;
  return data.signedUrl;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireClerkAuth(req);
  if (auth.ok === false) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Supabase service role is not configured.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const jobId = typeof req.query.jobId === 'string'
    ? req.query.jobId
    : typeof req.body?.jobId === 'string'
      ? req.body.jobId
      : '';

  if (!jobId) {
    const limit = Math.min(Number(req.query.limit || 8) || 8, 25);
    const { data, error } = await supabase
      .from('sermon_video_jobs')
      .select('*')
      .eq('church_id', auth.churchId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    const jobs = await Promise.all((data as JobRow[]).map(async row => {
      const signedUrl = row.storage_path ? await createSignedUrl(supabase, row.storage_path) : null;
      return mapJob(row, signedUrl);
    }));
    return res.status(200).json({ success: true, jobs });
  }

  const { data: job, error: jobError } = await supabase
    .from('sermon_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('church_id', auth.churchId)
    .maybeSingle();

  if (jobError) return res.status(500).json({ error: jobError.message });
  if (!job) return res.status(404).json({ error: 'Video job not found.' });

  const row = job as JobRow;
  if (row.status === 'completed') {
    const signedUrl = row.storage_path ? await createSignedUrl(supabase, row.storage_path) : null;
    return res.status(200).json({ success: true, job: mapJob(row, signedUrl) });
  }
  if (row.status === 'failed') {
    return res.status(200).json({ success: true, job: mapJob(row) });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini API key is not configured.' });
  }
  if (!row.operation_name) {
    return res.status(400).json({ error: 'Video job is missing a Gemini operation name.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const operation = await ai.operations.getVideosOperation({
      operation: { name: row.operation_name } as any,
    });

    if (!operation.done) {
      await supabase
        .from('sermon_video_jobs')
        .update({ status: 'running' })
        .eq('id', row.id);
      return res.status(200).json({ success: true, job: mapJob({ ...row, status: 'running' }) });
    }

    if (operation.error) {
      const errorMessage = JSON.stringify(operation.error).slice(0, 500);
      const { data: updated } = await supabase
        .from('sermon_video_jobs')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', row.id)
        .select('*')
        .single();
      return res.status(200).json({ success: true, job: mapJob((updated || { ...row, status: 'failed', error_message: errorMessage }) as JobRow) });
    }

    const generatedVideo = (operation.response as any)?.generatedVideos?.[0];
    if (!generatedVideo?.video) {
      const errorMessage = 'Gemini completed the job but returned no generated video.';
      const { data: updated } = await supabase
        .from('sermon_video_jobs')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', row.id)
        .select('*')
        .single();
      return res.status(200).json({ success: true, job: mapJob((updated || { ...row, status: 'failed', error_message: errorMessage }) as JobRow) });
    }

    const downloadPath = join('/tmp', `${row.id}.mp4`);
    await ai.files.download({ file: generatedVideo, downloadPath });
    const mp4 = await readFile(downloadPath);
    void unlink(downloadPath).catch(() => {});

    const storagePath = `${auth.churchId}/${row.id}/video.mp4`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, mp4, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const signedUrl = await createSignedUrl(supabase, storagePath);
    const { data: updated, error: updateError } = await supabase
      .from('sermon_video_jobs')
      .update({
        status: 'completed',
        storage_path: storagePath,
        video_url: signedUrl,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return res.status(500).json({ error: updateError?.message || 'Failed to update completed video job.' });
    }

    return res.status(200).json({ success: true, job: mapJob(updated as JobRow, signedUrl) });
  } catch (error) {
    const errorMessage = publicProviderError(error);
    const { data: updated } = await supabase
      .from('sermon_video_jobs')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', row.id)
      .select('*')
      .single();
    return res.status(502).json({
      error: errorMessage,
      job: mapJob((updated || { ...row, status: 'failed', error_message: errorMessage }) as JobRow),
    });
  }
}

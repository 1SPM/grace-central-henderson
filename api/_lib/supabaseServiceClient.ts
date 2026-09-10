import { createClient } from '@supabase/supabase-js';

/**
 * The service-role client these routes share, created in one place so its type
 * has a single definition.
 *
 * Annotating helpers as `ReturnType<typeof createClient>` looks equivalent but
 * is not. That resolves the generic function's *default* type arguments —
 * `SupabaseClient<unknown, { PostgrestVersion: string }, never, never, ...>` —
 * while an actual call infers `SupabaseClient<any, 'public', 'public', any, any>`.
 * The two are not assignable, so every helper call was a type error and every
 * property read off a returned row collapsed to `never`.
 *
 * `ServiceClient` is the return type of a real call, so it always matches what
 * the callers actually hold.
 */
export function createServiceClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Tiny input validator for Vercel serverless routes.
 *
 * No external dependency (intentional — we have a fragile lockfile after
 * the npm-audit-fix in Sprint 0 D3). If we ever want richer schemas,
 * swap to Zod or valibot in a single PR.
 *
 * Usage:
 *
 *   const result = validate(req.body, {
 *     firstName: str({ min: 1, max: 100, required: true }),
 *     email:     email_({ max: 320, required: true }),
 *     phone:     str({ max: 50, pattern: /^[0-9+()\-.\s]*$/ }),
 *   });
 *   if (!result.ok) return res.status(400).json({ error: result.error });
 *   const { firstName, email, phone } = result.value;
 *
 * Each validator returns a discriminated union { ok: true, value } |
 * { ok: false, error }. `validate` aggregates field-level errors into
 * the first failure and returns a flat 400-body shape with a path.
 *
 * Resolves TD-011 (partial — see leader-apply.ts which still needs the
 * same treatment after this lands).
 */

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type FieldValidator<T> = (input: unknown, field: string) => FieldResult<T>;

// ---- Primitive validators ---------------------------------------------

export function str(opts: {
  min?: number;
  max?: number;
  required?: boolean;
  pattern?: RegExp;
  /** Trim before validation; the trimmed value is what's returned. */
  trim?: boolean;
} = {}): FieldValidator<string | undefined> {
  const trim = opts.trim ?? true;
  return (input, field) => {
    if (input === undefined || input === null) {
      if (opts.required) return { ok: false, error: `${field} is required` };
      return { ok: true, value: undefined };
    }
    if (typeof input !== 'string') {
      return { ok: false, error: `${field} must be a string` };
    }
    const value = trim ? input.trim() : input;
    if (opts.required && value.length === 0) {
      return { ok: false, error: `${field} is required` };
    }
    if (!opts.required && value.length === 0) {
      return { ok: true, value: undefined };
    }
    if (opts.min !== undefined && value.length < opts.min) {
      return { ok: false, error: `${field} must be at least ${opts.min} characters` };
    }
    if (opts.max !== undefined && value.length > opts.max) {
      return { ok: false, error: `${field} exceeds ${opts.max} characters` };
    }
    if (opts.pattern && !opts.pattern.test(value)) {
      return { ok: false, error: `${field} has an invalid format` };
    }
    return { ok: true, value };
  };
}

/** RFC 5321 caps email at 320 chars; RFC 5322 has a permissive grammar. We do a pragmatic check. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function email_(opts: { max?: number; required?: boolean } = {}): FieldValidator<string | undefined> {
  const max = opts.max ?? 320;
  return (input, field) => {
    const r = str({ min: 3, max, required: opts.required })(input, field);
    if (!r.ok || r.value === undefined) return r;
    if (!EMAIL_RE.test(r.value)) {
      return { ok: false, error: `${field} is not a valid email address` };
    }
    return { ok: true, value: r.value.toLowerCase() };
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid_(opts: { required?: boolean } = {}): FieldValidator<string | undefined> {
  return (input, field) => {
    if (input === undefined || input === null) {
      if (opts.required) return { ok: false, error: `${field} is required` };
      return { ok: true, value: undefined };
    }
    if (typeof input !== 'string' || !UUID_RE.test(input)) {
      return { ok: false, error: `${field} must be a UUID` };
    }
    return { ok: true, value: input.toLowerCase() };
  };
}

export function bool_(opts: { required?: boolean } = {}): FieldValidator<boolean | undefined> {
  return (input, field) => {
    if (input === undefined || input === null) {
      if (opts.required) return { ok: false, error: `${field} is required` };
      return { ok: true, value: undefined };
    }
    if (typeof input !== 'boolean') {
      return { ok: false, error: `${field} must be true or false` };
    }
    return { ok: true, value: input };
  };
}

export function int_(opts: { min?: number; max?: number; required?: boolean } = {}): FieldValidator<number | undefined> {
  return (input, field) => {
    if (input === undefined || input === null) {
      if (opts.required) return { ok: false, error: `${field} is required` };
      return { ok: true, value: undefined };
    }
    if (typeof input !== 'number' || !Number.isFinite(input) || !Number.isInteger(input)) {
      return { ok: false, error: `${field} must be an integer` };
    }
    if (opts.min !== undefined && input < opts.min) {
      return { ok: false, error: `${field} must be ≥ ${opts.min}` };
    }
    if (opts.max !== undefined && input > opts.max) {
      return { ok: false, error: `${field} must be ≤ ${opts.max}` };
    }
    return { ok: true, value: input };
  };
}

export function num_(opts: { min?: number; max?: number; required?: boolean } = {}): FieldValidator<number | undefined> {
  return (input, field) => {
    if (input === undefined || input === null) {
      if (opts.required) return { ok: false, error: `${field} is required` };
      return { ok: true, value: undefined };
    }
    if (typeof input !== 'number' || !Number.isFinite(input)) {
      return { ok: false, error: `${field} must be a number` };
    }
    if (opts.min !== undefined && input < opts.min) {
      return { ok: false, error: `${field} must be ≥ ${opts.min}` };
    }
    if (opts.max !== undefined && input > opts.max) {
      return { ok: false, error: `${field} must be ≤ ${opts.max}` };
    }
    return { ok: true, value: input };
  };
}

export function arrayOfStr(opts: { maxLength?: number; maxItem?: number; allow?: string[] } = {}): FieldValidator<string[] | undefined> {
  const maxLength = opts.maxLength ?? 50;
  const maxItem = opts.maxItem ?? 200;
  return (input, field) => {
    if (input === undefined || input === null) return { ok: true, value: undefined };
    if (!Array.isArray(input)) {
      return { ok: false, error: `${field} must be an array` };
    }
    if (input.length > maxLength) {
      return { ok: false, error: `${field} exceeds ${maxLength} items` };
    }
    const out: string[] = [];
    for (const item of input) {
      if (typeof item !== 'string') {
        return { ok: false, error: `${field} items must be strings` };
      }
      const trimmed = item.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.length > maxItem) {
        return { ok: false, error: `${field} item exceeds ${maxItem} characters` };
      }
      if (opts.allow && !opts.allow.includes(trimmed)) {
        return { ok: false, error: `${field} item "${trimmed.slice(0, 40)}" is not allowed` };
      }
      out.push(trimmed);
    }
    return { ok: true, value: out };
  };
}

// ---- Aggregator -------------------------------------------------------

export type Schema<T> = { [K in keyof T]: FieldValidator<T[K]> };

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; path: string };

export function validate<T extends Record<string, unknown>>(
  input: unknown,
  schema: Schema<T>,
): ValidationResult<T> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'request body must be a JSON object', path: '$' };
  }
  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    const validator = schema[key as keyof T];
    const r = validator(obj[key], key);
    if (!r.ok) {
      return { ok: false, error: r.error, path: key };
    }
    out[key] = r.value;
  }
  return { ok: true, value: out as T };
}

/**
 * Helper for Vercel routes: validates the body, sends 400 + structured
 * error on failure. Returns the typed value or null (caller exits early
 * on null).
 *
 *   const body = readBody(req, res, schema);
 *   if (!body) return;  // 400 already sent
 *   // body is fully typed at this point
 */
export function readBody<T extends Record<string, unknown>>(
  req: { body?: unknown },
  res: { status(code: number): { json(body: unknown): unknown } },
  schema: Schema<T>,
): T | null {
  const result = validate(req.body, schema);
  if (!result.ok) {
    res.status(400).json({ error: 'invalid_request', detail: result.error, path: result.path });
    return null;
  }
  return result.value;
}

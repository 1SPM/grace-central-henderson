/**
 * Tiny CSV parser. No external dependency — same reason as
 * api/_lib/validation.ts: we have a fragile lockfile and adding a
 * package right before demo is high-risk.
 *
 * Handles the common cases that 95% of church-CRM CSV exports use:
 *   - Comma-separated, with optional double-quoting
 *   - Escaped quotes inside quoted fields (RFC 4180: "" → ")
 *   - \r\n or \n line endings
 *   - Empty trailing fields
 *   - BOM at file start (Excel saves with UTF-8 BOM)
 *
 * Does NOT handle:
 *   - Other delimiters (tab, semicolon) — would need an option arg
 *   - Multi-line quoted fields with embedded newlines — rare, would
 *     require a more complex parser
 *
 * If you ever hit a CSV this can't parse, the right call is to add
 * `papaparse` as a dependency.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

export function parseCsv(input: string): CsvParseResult {
  const warnings: string[] = [];

  let text = input;
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    return { headers: [], rows: [], warnings: ['CSV is empty'] };
  }

  const headers = parseCsvRow(lines[0]).map((h) => h.trim());
  if (headers.length === 0) {
    return { headers: [], rows: [], warnings: ['CSV header row is empty'] };
  }
  if (headers.some((h) => h === '')) {
    warnings.push(`CSV has ${headers.filter((h) => h === '').length} blank header(s) — those columns will be ignored.`);
  }
  if (new Set(headers).size !== headers.length) {
    warnings.push('CSV has duplicate column headers — only the rightmost value will be kept per row.');
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const cells = parseCsvRow(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (key === '') continue;
      row[key] = (cells[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { headers: headers.filter((h) => h !== ''), rows, warnings };
}

function splitCsvLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++;
      let value = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      cells.push(value);
      if (line[i] === ',') i++;
    } else {
      // Unquoted field — read until comma
      let value = '';
      while (i < line.length && line[i] !== ',') {
        value += line[i];
        i++;
      }
      cells.push(value);
      if (line[i] === ',') i++;
    }
  }
  return cells;
}

// ---- Field auto-detection ---------------------------------------------

/**
 * Common header aliases by canonical field. Lowercase, punctuation-
 * collapsed match — so "First Name", "FirstName", "first_name" all
 * resolve to 'first_name'.
 */
export type PeopleField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'birth_date'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'status'
  | 'join_date'
  | 'notes';

const PEOPLE_ALIASES: Record<PeopleField, string[]> = {
  first_name: ['first name', 'firstname', 'first', 'given name', 'givenname'],
  last_name:  ['last name', 'lastname', 'last', 'surname', 'family name', 'familyname'],
  email:      ['email', 'email address', 'emailaddress', 'primary email', 'e mail', 'e-mail'],
  phone:      ['phone', 'phone number', 'phonenumber', 'mobile', 'cell', 'cell phone', 'mobile phone'],
  birth_date: ['birthday', 'birth date', 'birthdate', 'date of birth', 'dob'],
  address:    ['address', 'street', 'street address', 'address line 1', 'address1'],
  city:       ['city'],
  state:      ['state', 'province', 'state province'],
  zip:        ['zip', 'zip code', 'zipcode', 'postal code', 'postalcode', 'postcode'],
  status:     ['status', 'member status', 'member type', 'membership status'],
  join_date:  ['join date', 'joindate', 'member since', 'joined', 'date joined', 'membership date'],
  notes:      ['notes', 'comments', 'note', 'memo'],
};

/**
 * Returns a mapping from canonical field name to the CSV header that
 * best matches it. Unmatched fields are absent from the map (UI shows
 * them as "Skip" by default).
 */
export function autoDetectPeopleMapping(headers: string[]): Partial<Record<PeopleField, string>> {
  const mapping: Partial<Record<PeopleField, string>> = {};
  const normalized = headers.map((h) => normalizeHeader(h));
  for (const field of Object.keys(PEOPLE_ALIASES) as PeopleField[]) {
    const aliases = PEOPLE_ALIASES[field];
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        mapping[field] = headers[i];
        break;
      }
    }
  }
  return mapping;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---- Row validation ---------------------------------------------------

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_DIGITS_RE = /^[0-9+()\-.\s]*$/;
/** Accepts YYYY-MM-DD, MM/DD/YYYY, M/D/YY, etc. — we normalize at insert. */
const DATE_PARSEABLE_RE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;

export interface RowValidationError {
  rowIndex: number;
  field: PeopleField;
  message: string;
}

export interface ValidatedRow {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  join_date: string | null;
  notes: string | null;
}

export interface ValidationResult {
  valid: ValidatedRow[];
  errors: RowValidationError[];
  duplicateEmails: string[];
}

export function validatePeopleRows(
  rows: Record<string, string>[],
  mapping: Partial<Record<PeopleField, string>>,
): ValidationResult {
  const valid: ValidatedRow[] = [];
  const errors: RowValidationError[] = [];
  const seenEmails = new Set<string>();
  const duplicateEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: PeopleField): string => {
      const header = mapping[field];
      if (!header) return '';
      return (row[header] ?? '').trim();
    };

    const firstName = get('first_name');
    const lastName = get('last_name');
    if (!firstName && !lastName) {
      errors.push({ rowIndex: i, field: 'first_name', message: 'Row has no name (both first and last empty) — skipped.' });
      continue;
    }
    if (firstName.length > 100) {
      errors.push({ rowIndex: i, field: 'first_name', message: `Name too long (${firstName.length} chars, max 100).` });
      continue;
    }
    if (lastName.length > 100) {
      errors.push({ rowIndex: i, field: 'last_name', message: `Last name too long (${lastName.length} chars, max 100).` });
      continue;
    }

    const email = get('email');
    let normalizedEmail: string | null = null;
    if (email) {
      if (!EMAIL_RE.test(email)) {
        errors.push({ rowIndex: i, field: 'email', message: `"${email}" is not a valid email.` });
        continue;
      }
      normalizedEmail = email.toLowerCase();
      if (seenEmails.has(normalizedEmail)) {
        duplicateEmails.add(normalizedEmail);
      }
      seenEmails.add(normalizedEmail);
    }

    const phone = get('phone');
    if (phone && !PHONE_DIGITS_RE.test(phone)) {
      errors.push({ rowIndex: i, field: 'phone', message: `"${phone}" has invalid characters.` });
      continue;
    }

    const birthDateRaw = get('birth_date');
    let birthDate: string | null = null;
    if (birthDateRaw) {
      const parsed = parseLooseDate(birthDateRaw);
      if (!parsed) {
        errors.push({ rowIndex: i, field: 'birth_date', message: `"${birthDateRaw}" could not be parsed as a date.` });
        continue;
      }
      birthDate = parsed;
    }

    const joinDateRaw = get('join_date');
    let joinDate: string | null = null;
    if (joinDateRaw) {
      const parsed = parseLooseDate(joinDateRaw);
      if (!parsed) {
        errors.push({ rowIndex: i, field: 'join_date', message: `"${joinDateRaw}" could not be parsed as a date.` });
        continue;
      }
      joinDate = parsed;
    }

    valid.push({
      first_name: firstName || '',
      last_name: lastName || '',
      email: normalizedEmail,
      phone: phone || null,
      birth_date: birthDate,
      address: (get('address') || '').slice(0, 500) || null,
      city: (get('city') || '').slice(0, 100) || null,
      state: (get('state') || '').slice(0, 50) || null,
      zip: (get('zip') || '').slice(0, 20) || null,
      status: normalizeStatus(get('status')),
      join_date: joinDate,
      notes: (get('notes') || '').slice(0, 2000) || null,
    });
  }

  return { valid, errors, duplicateEmails: Array.from(duplicateEmails) };
}

function parseLooseDate(s: string): string | null {
  // Returns ISO YYYY-MM-DD string, or null if unparseable.
  if (!DATE_PARSEABLE_RE.test(s)) return null;
  const parts = s.split(/[-/.]/).map((p) => p.trim());
  if (parts.length !== 3) return null;
  let year: number, month: number, day: number;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    // MM/DD/YYYY or M/D/YY (US convention — most church CRMs use this)
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
    if (year < 100) year += year >= 30 ? 1900 : 2000;
  }
  if (!isValidDate(year, month, day)) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function normalizeStatus(raw: string): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (['member', 'active member', 'active'].includes(s)) return 'member';
  if (['visitor', 'guest', 'first time visitor'].includes(s)) return 'visitor';
  if (['regular', 'attender', 'regular attender'].includes(s)) return 'regular';
  if (['leader', 'volunteer leader'].includes(s)) return 'leader';
  if (['inactive', 'lapsed', 'left'].includes(s)) return 'inactive';
  // Unknown status — preserve raw value so the operator can fix later
  return raw.slice(0, 50);
}

// ============================================================================
// GIVING IMPORT
// ============================================================================

export type GivingField =
  | 'donor_email'      // primary person match
  | 'donor_name'       // secondary match (when email missing)
  | 'amount'
  | 'date'
  | 'fund'
  | 'method'
  | 'note'
  | 'check_number';

const GIVING_ALIASES: Record<GivingField, string[]> = {
  donor_email: ['email', 'donor email', 'email address', 'primary email', 'e mail', 'e-mail', 'donor email address'],
  donor_name:  ['donor', 'donor name', 'name', 'full name', 'fullname', 'giver', 'giver name'],
  amount:      ['amount', 'donation amount', 'gift amount', 'contribution amount', 'total', 'value', 'paid'],
  date:        ['date', 'donation date', 'gift date', 'contribution date', 'received', 'transaction date', 'paid date'],
  fund:        ['fund', 'designation', 'category', 'campaign', 'purpose', 'fund name'],
  method:      ['method', 'payment method', 'type', 'source', 'gift type'],
  note:        ['note', 'notes', 'memo', 'comment', 'comments', 'description'],
  check_number:['check number', 'checkno', 'check #', 'check', 'reference'],
};

export function autoDetectGivingMapping(headers: string[]): Partial<Record<GivingField, string>> {
  const mapping: Partial<Record<GivingField, string>> = {};
  const normalized = headers.map((h) => normalizeHeader(h));
  for (const field of Object.keys(GIVING_ALIASES) as GivingField[]) {
    const aliases = GIVING_ALIASES[field];
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        mapping[field] = headers[i];
        break;
      }
    }
  }
  return mapping;
}

export interface GivingRowError {
  rowIndex: number;
  field: GivingField | 'row';
  message: string;
}

export interface ValidatedGivingRow {
  donor_email: string | null;
  donor_name: string | null;
  amount_cents: number;
  date: string;                // YYYY-MM-DD
  fund: string | null;
  method: string | null;
  note: string | null;
  check_number: string | null;
}

export interface GivingValidationResult {
  valid: ValidatedGivingRow[];
  errors: GivingRowError[];
  /** Distinct donor emails in the file — used to pre-fetch matching people in one query. */
  donorEmails: string[];
}

/**
 * Parse amount with broad tolerance:
 *   "$1,234.56"  → 123456 cents
 *   "1234.56"    → 123456
 *   "1234"       → 123400 (treated as whole dollars)
 *   "($50)"      → -5000 (parens = negative, accounting convention)
 *   "1,234"      → 123400
 * Returns null if unparseable.
 */
function parseAmountToCents(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1).trim();
  }
  // Strip currency symbols + thousand separators
  s = s.replace(/[$£€¥]/g, '').replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

const NORMALIZED_METHODS: Record<string, string> = {
  cash: 'cash',
  check: 'check',
  cheque: 'check',
  credit: 'credit_card',
  'credit card': 'credit_card',
  card: 'credit_card',
  debit: 'debit_card',
  'debit card': 'debit_card',
  ach: 'ach',
  bank: 'ach',
  'bank transfer': 'ach',
  online: 'online',
  stripe: 'online',
  paypal: 'online',
  text: 'text_to_give',
  'text to give': 'text_to_give',
  recurring: 'recurring',
};

function normalizeMethod(raw: string): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  return NORMALIZED_METHODS[s] ?? raw.slice(0, 50);
}

export function validateGivingRows(
  rows: Record<string, string>[],
  mapping: Partial<Record<GivingField, string>>,
): GivingValidationResult {
  const valid: ValidatedGivingRow[] = [];
  const errors: GivingRowError[] = [];
  const emailSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: GivingField): string => {
      const header = mapping[field];
      if (!header) return '';
      return (row[header] ?? '').trim();
    };

    const amountRaw = get('amount');
    if (!amountRaw) {
      errors.push({ rowIndex: i, field: 'amount', message: 'Amount is required.' });
      continue;
    }
    const amountCents = parseAmountToCents(amountRaw);
    if (amountCents === null) {
      errors.push({ rowIndex: i, field: 'amount', message: `"${amountRaw}" is not a valid amount.` });
      continue;
    }
    if (amountCents === 0) {
      errors.push({ rowIndex: i, field: 'amount', message: 'Amount cannot be zero.' });
      continue;
    }

    const dateRaw = get('date');
    if (!dateRaw) {
      errors.push({ rowIndex: i, field: 'date', message: 'Date is required.' });
      continue;
    }
    const date = parseLooseDate(dateRaw);
    if (!date) {
      errors.push({ rowIndex: i, field: 'date', message: `"${dateRaw}" could not be parsed as a date.` });
      continue;
    }

    const emailRaw = get('donor_email');
    let donorEmail: string | null = null;
    if (emailRaw) {
      if (!EMAIL_RE.test(emailRaw)) {
        errors.push({ rowIndex: i, field: 'donor_email', message: `"${emailRaw}" is not a valid email — gift will be unmatched.` });
        // Don't `continue` — still import as unmatched
      } else {
        donorEmail = emailRaw.toLowerCase();
        emailSet.add(donorEmail);
      }
    }

    const donorName = get('donor_name') || null;
    if (!donorEmail && !donorName) {
      errors.push({ rowIndex: i, field: 'row', message: 'Row has no donor email or name — gift will be anonymous.' });
      // Still import — anonymous donations are real (cash in plate, etc.)
    }

    valid.push({
      donor_email: donorEmail,
      donor_name: donorName ? donorName.slice(0, 200) : null,
      amount_cents: amountCents,
      date,
      fund: (get('fund') || 'general').slice(0, 100),
      method: normalizeMethod(get('method')),
      note: (get('note') || '').slice(0, 1000) || null,
      check_number: (get('check_number') || '').slice(0, 50) || null,
    });
  }

  return { valid, errors, donorEmails: Array.from(emailSet) };
}

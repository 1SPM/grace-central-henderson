/**
 * CSV Import Wizard — 4 steps, all client-side until the final commit:
 *
 *   1. Upload  — drag/drop or pick a .csv file. We parse it in the
 *                browser. No upload to the server yet.
 *   2. Map     — auto-detect column → field mapping (Planning Center,
 *                Breeze, ChurchTrac, MailChimp formats all just work);
 *                user can override.
 *   3. Validate — run client-side validation. Show valid count, error
 *                 count, duplicate-email count. User can proceed or
 *                 go back and fix the CSV externally.
 *   4. Import  — POST batches of 200 rows to /api/import/people.
 *                Progress bar updates in real time. Errors collected
 *                per batch and shown at the end with a downloadable
 *                CSV of failed rows.
 *
 * Only people import for now. Giving import is a follow-on PR (same
 * pattern but maps to the giving table — person matching by email is
 * the tricky part).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  parseCsv,
  autoDetectPeopleMapping,
  validatePeopleRows,
  type CsvParseResult,
  type PeopleField,
  type ValidationResult,
} from '../../lib/csv';

const PEOPLE_FIELDS: { key: PeopleField; label: string; required?: boolean }[] = [
  { key: 'first_name', label: 'First name', required: true },
  { key: 'last_name',  label: 'Last name', required: true },
  { key: 'email',      label: 'Email' },
  { key: 'phone',      label: 'Phone' },
  { key: 'birth_date', label: 'Birth date' },
  { key: 'address',    label: 'Address' },
  { key: 'city',       label: 'City' },
  { key: 'state',      label: 'State' },
  { key: 'zip',        label: 'Zip' },
  { key: 'status',     label: 'Status' },
  { key: 'join_date',  label: 'Join date' },
  { key: 'notes',      label: 'Notes' },
];

const BATCH_SIZE = 200;

type Step = 'upload' | 'map' | 'validate' | 'import' | 'done';

interface ImportProgress {
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
}

export function CsvImportWizard() {
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<PeopleField, string>>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row_index: number; message: string }>>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dedupeByEmail, setDedupeByEmail] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setParseError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('File must have a .csv extension.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max 10 MB. Split into smaller files.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      try {
        const result = parseCsv(text);
        if (result.headers.length === 0) {
          setParseError('No columns detected. Is this a valid CSV?');
          return;
        }
        if (result.rows.length === 0) {
          setParseError('No data rows. Check that the file has rows below the header.');
          return;
        }
        setParsed(result);
        setMapping(autoDetectPeopleMapping(result.headers));
        setFileName(file.name);
        setStep('map');
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Could not parse the file.');
      }
    };
    reader.onerror = () => setParseError('Could not read the file.');
    reader.readAsText(file);
  }, []);

  const handleValidate = useCallback(() => {
    if (!parsed) return;
    const result = validatePeopleRows(parsed.rows, mapping);
    setValidation(result);
    setStep('validate');
  }, [parsed, mapping]);

  const handleImport = useCallback(async () => {
    if (!validation || validation.valid.length === 0) return;
    setStep('import');
    const token = await getToken();
    if (!token) {
      setImportErrors([{ row_index: -1, message: 'Sign-in token unavailable.' }]);
      setStep('done');
      return;
    }
    const total = validation.valid.length;
    setProgress({ total, processed: 0, inserted: 0, updated: 0, failed: 0 });
    const collected: Array<{ row_index: number; message: string }> = [];

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = validation.valid.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch('/api/import/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ batch, dedupe_by_email: dedupeByEmail }),
        });
        const body = await res.json();
        if (!res.ok) {
          collected.push({ row_index: -1, message: body.detail || body.error || `batch ${i / BATCH_SIZE + 1} failed (HTTP ${res.status})` });
          setProgress((p) => p ? { ...p, processed: p.processed + batch.length, failed: p.failed + batch.length } : p);
        } else {
          setProgress((p) => p ? {
            ...p,
            processed: p.processed + batch.length,
            inserted: p.inserted + (body.inserted ?? 0),
            updated: p.updated + (body.updated ?? 0),
            failed: p.failed + (body.errors?.length ?? 0),
          } : p);
          if (body.errors?.length) {
            collected.push(...body.errors.map((e: { row_index: number; message: string }) => ({
              row_index: i + e.row_index,
              message: e.message,
            })));
          }
        }
      } catch (err) {
        collected.push({
          row_index: -1,
          message: `Network error on batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : 'unknown'}`,
        });
        setProgress((p) => p ? { ...p, processed: p.processed + batch.length, failed: p.failed + batch.length } : p);
      }
    }

    setImportErrors(collected);
    setStep('done');
  }, [validation, getToken, dedupeByEmail]);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName(null);
    setParsed(null);
    setMapping({});
    setValidation(null);
    setProgress(null);
    setImportErrors([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const previewRows = useMemo(() => parsed?.rows.slice(0, 5) ?? [], [parsed]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Import people
          </h1>
          <p className="text-sm text-gray-600">
            Upload a CSV from Planning Center, Breeze, ChurchTrac, or any spreadsheet.
            We auto-detect the columns and check every row before importing.
          </p>
        </header>

        <StepIndicator current={step} />

        {step === 'upload' && (
          <UploadStep
            fileInputRef={fileInputRef}
            onFile={handleFile}
            parseError={parseError}
          />
        )}

        {step === 'map' && parsed && (
          <MapStep
            headers={parsed.headers}
            mapping={mapping}
            setMapping={setMapping}
            previewRows={previewRows}
            fileName={fileName}
            warnings={parsed.warnings}
            onBack={reset}
            onNext={handleValidate}
          />
        )}

        {step === 'validate' && validation && (
          <ValidateStep
            validation={validation}
            dedupeByEmail={dedupeByEmail}
            setDedupeByEmail={setDedupeByEmail}
            onBack={() => setStep('map')}
            onConfirm={handleImport}
          />
        )}

        {step === 'import' && progress && (
          <ImportStep progress={progress} />
        )}

        {step === 'done' && progress && (
          <DoneStep
            progress={progress}
            errors={importErrors}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}

// ---- Subcomponents ----------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  const order: Step[] = ['upload', 'map', 'validate', 'import', 'done'];
  const labels: Record<Step, string> = {
    upload: 'Upload',
    map: 'Map columns',
    validate: 'Validate',
    import: 'Importing',
    done: 'Done',
  };
  const idx = order.indexOf(current);
  return (
    <ol className="flex justify-center gap-2 mb-6 flex-wrap">
      {order.map((s, i) => (
        <li
          key={s}
          className={[
            'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
            i <= idx ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400',
          ].join(' ')}
        >
          <span
            className={[
              'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
              i < idx ? 'bg-amber-600 text-white' :
              i === idx ? 'bg-amber-200 text-amber-900' :
              'bg-gray-200 text-gray-500',
            ].join(' ')}
          >
            {i + 1}
          </span>
          {labels[s]}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({
  fileInputRef,
  onFile,
  parseError,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
  parseError: string | null;
}) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8">
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer?.files?.[0];
          if (file) onFile(file);
        }}
        className={[
          'border-2 border-dashed rounded-xl p-12 text-center transition-colors',
          dragActive ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-gray-50',
        ].join(' ')}
      >
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-700 mb-2">Drop a CSV file here or click to choose one</p>
        <p className="text-xs text-gray-500 mb-6">Max 10 MB · UTF-8 · Up to ~50,000 rows per file</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
          className="hidden"
          id="csv-file-input"
        />
        <label
          htmlFor="csv-file-input"
          className="inline-block px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 cursor-pointer"
        >
          Choose file
        </label>
      </div>
      {parseError && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {parseError}
        </div>
      )}
    </div>
  );
}

function MapStep({
  headers,
  mapping,
  setMapping,
  previewRows,
  fileName,
  warnings,
  onBack,
  onNext,
}: {
  headers: string[];
  mapping: Partial<Record<PeopleField, string>>;
  setMapping: (m: Partial<Record<PeopleField, string>>) => void;
  previewRows: Record<string, string>[];
  fileName: string | null;
  warnings: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const updateMapping = (field: PeopleField, header: string) => {
    const next = { ...mapping };
    if (header === '') {
      delete next[field];
    } else {
      next[field] = header;
    }
    setMapping(next);
  };

  const requiredOk =
    !!mapping.first_name && !!mapping.last_name;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-1">
          Match your columns
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          <strong>{fileName}</strong> · {headers.length} columns, {previewRows.length > 0 ? 'first 5 rows previewed below' : ''}
        </p>
        {warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {warnings.map((w, i) => <div key={i}>· {w}</div>)}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PEOPLE_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-gray-700">
                {f.label} {f.required && <span className="text-amber-600">*</span>}
              </span>
              <select
                value={mapping[f.key] ?? ''}
                onChange={(e) => updateMapping(f.key, e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">— Skip —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {previewRows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 overflow-x-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Preview (first 5 rows from your file)</h3>
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500">
                {headers.map((h) => (
                  <th key={h} className="text-left px-2 py-1 border-b font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {headers.map((h) => (
                    <td key={h} className="px-2 py-1 border-b text-gray-700">{row[h] || <span className="text-gray-300">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:text-gray-900">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!requiredOk}
          className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {requiredOk ? 'Validate rows →' : 'Map First Name + Last Name to continue'}
        </button>
      </div>
    </div>
  );
}

function ValidateStep({
  validation,
  dedupeByEmail,
  setDedupeByEmail,
  onBack,
  onConfirm,
}: {
  validation: ValidationResult;
  dedupeByEmail: boolean;
  setDedupeByEmail: (b: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const validCount = validation.valid.length;
  const errorCount = validation.errors.length;
  const dupCount = validation.duplicateEmails.length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Validation results</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Valid rows" value={validCount} color="green" />
          <StatCard label="Errors" value={errorCount} color={errorCount > 0 ? 'red' : 'gray'} />
          <StatCard label="Duplicate emails (in file)" value={dupCount} color={dupCount > 0 ? 'amber' : 'gray'} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <input
            type="checkbox"
            checked={dedupeByEmail}
            onChange={(e) => setDedupeByEmail(e.target.checked)}
            className="rounded text-amber-600 focus:ring-amber-400"
          />
          Update existing records when email matches (recommended — prevents duplicates)
        </label>

        {validation.errors.length > 0 && (
          <details className="text-sm" open={validation.errors.length <= 5}>
            <summary className="cursor-pointer font-medium text-gray-700 mb-2">
              {validation.errors.length} row(s) will be skipped — click for details
            </summary>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {validation.errors.slice(0, 100).map((e, i) => (
                <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">Row {e.rowIndex + 2}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="font-mono text-xs text-gray-700">{e.field}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span>{e.message}</span>
                </div>
              ))}
              {validation.errors.length > 100 && (
                <div className="py-1 italic text-gray-500">...and {validation.errors.length - 100} more.</div>
              )}
            </div>
          </details>
        )}

        {dupCount > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {dupCount} email(s) appear more than once in your file. With dedupe ON, the LATER row's
            non-name fields will overwrite the earlier one.
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:text-gray-900">
          ← Back to mapping
        </button>
        <button
          onClick={onConfirm}
          disabled={validCount === 0}
          className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import {validCount.toLocaleString()} row{validCount === 1 ? '' : 's'} →
        </button>
      </div>
    </div>
  );
}

function ImportStep({ progress }: { progress: ImportProgress }) {
  const pct = progress.total === 0 ? 0 : Math.round((progress.processed / progress.total) * 100);
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8">
      <div className="text-center mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Importing…</h2>
        <p className="text-sm text-gray-500">
          Processed {progress.processed.toLocaleString()} of {progress.total.toLocaleString()} rows
        </p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
        <div
          className="bg-amber-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Inserted" value={progress.inserted} color="green" />
        <StatCard label="Updated" value={progress.updated} color="blue" />
        <StatCard label="Failed" value={progress.failed} color={progress.failed > 0 ? 'red' : 'gray'} />
      </div>
    </div>
  );
}

function DoneStep({
  progress,
  errors,
  onReset,
}: {
  progress: ImportProgress;
  errors: Array<{ row_index: number; message: string }>;
  onReset: () => void;
}) {
  const downloadErrors = () => {
    const csv = 'row_index,message\n' + errors
      .map((e) => `${e.row_index},"${e.message.replace(/"/g, '""')}"`)
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8">
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-1">Import complete</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Inserted" value={progress.inserted} color="green" />
        <StatCard label="Updated" value={progress.updated} color="blue" />
        <StatCard label="Failed" value={progress.failed} color={progress.failed > 0 ? 'red' : 'gray'} />
      </div>
      {errors.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
          <div className="font-medium text-red-800 mb-1">
            {errors.length} row(s) failed during import.
          </div>
          <button onClick={downloadErrors} className="text-red-700 hover:text-red-900 underline">
            Download error CSV →
          </button>
        </div>
      )}
      <div className="flex justify-center gap-3">
        <button
          onClick={onReset}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Import another file
        </button>
        <a
          href="/#people"
          className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
        >
          View imported people →
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'green' | 'red' | 'amber' | 'gray' | 'blue' }) {
  const colorClass = {
    green: 'text-green-700 bg-green-50',
    red:   'text-red-700 bg-red-50',
    amber: 'text-amber-700 bg-amber-50',
    blue:  'text-blue-700 bg-blue-50',
    gray:  'text-gray-700 bg-gray-50',
  }[color];
  return (
    <div className={['rounded-lg p-4 text-center', colorClass].join(' ')}>
      <div className="text-2xl font-light">{value.toLocaleString()}</div>
      <div className="text-xs uppercase tracking-wide opacity-75 mt-1">{label}</div>
    </div>
  );
}

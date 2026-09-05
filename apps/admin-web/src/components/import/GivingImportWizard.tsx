/**
 * Giving CSV import wizard — sibling to CsvImportWizard (people).
 *
 * Same flow: Upload → Map → Validate → Import → Done.
 * Differences from people:
 *   - Donor matching by email (the file usually has emails; we look
 *     up people.id from those emails server-side)
 *   - Amount parsing tolerates $sign, commas, ($N) for refunds
 *   - Unmatched donors still import (anonymous gift); operator can
 *     create the people row later and re-link
 *   - "Unmatched donor emails" list is downloadable as CSV at the end
 *     so the operator can create those people records
 *
 * Structure duplicates CsvImportWizard rather than over-abstracting —
 * the visual chrome is small, both wizards stay readable.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import {
  parseCsv,
  autoDetectGivingMapping,
  validateGivingRows,
  type CsvParseResult,
  type GivingField,
  type GivingValidationResult,
} from '../../lib/csv';

const GIVING_FIELDS: { key: GivingField; label: string; required?: boolean }[] = [
  { key: 'amount',       label: 'Amount', required: true },
  { key: 'date',         label: 'Date', required: true },
  { key: 'donor_email',  label: 'Donor email' },
  { key: 'donor_name',   label: 'Donor name' },
  { key: 'fund',         label: 'Fund / Designation' },
  { key: 'method',       label: 'Payment method' },
  { key: 'check_number', label: 'Check number' },
  { key: 'note',         label: 'Note / Memo' },
];

const BATCH_SIZE = 200;

type Step = 'upload' | 'map' | 'validate' | 'import' | 'done';

interface ImportProgress {
  total: number;
  processed: number;
  inserted: number;
  matched: number;
  unmatched: number;
  failed: number;
  unmatchedEmails: Set<string>;
}

export function GivingImportWizard() {
  const { getAuthToken } = useAuthContext();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<GivingField, string>>>({});
  const [validation, setValidation] = useState<GivingValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row_index: number; message: string }>>([]);
  const [parseError, setParseError] = useState<string | null>(null);
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
          setParseError('No data rows.');
          return;
        }
        setParsed(result);
        setMapping(autoDetectGivingMapping(result.headers));
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
    const result = validateGivingRows(parsed.rows, mapping);
    setValidation(result);
    setStep('validate');
  }, [parsed, mapping]);

  const handleImport = useCallback(async () => {
    if (!validation || validation.valid.length === 0) return;
    setStep('import');
    const token = await getAuthToken();
    if (!token) {
      setImportErrors([{ row_index: -1, message: 'Sign-in token unavailable.' }]);
      setStep('done');
      return;
    }
    const total = validation.valid.length;
    setProgress({ total, processed: 0, inserted: 0, matched: 0, unmatched: 0, failed: 0, unmatchedEmails: new Set() });
    const collected: Array<{ row_index: number; message: string }> = [];

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = validation.valid.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch('/api/import/giving', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ batch }),
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
            matched: p.matched + (body.matched ?? 0),
            unmatched: p.unmatched + (body.unmatched ?? 0),
            failed: p.failed + (body.errors?.length ?? 0),
            unmatchedEmails: new Set([...p.unmatchedEmails, ...(body.unmatched_emails ?? [])]),
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
  }, [validation, getAuthToken]);

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
  const requiredOk = !!mapping.amount && !!mapping.date;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Import giving history
          </h1>
          <p className="text-sm text-gray-600">
            Upload a giving CSV from Planning Center, Breeze, ChurchTrac, Stripe, or any spreadsheet.
            Donors are matched to existing people by email. Unmatched gifts are imported as anonymous.
          </p>
        </header>

        <StepIndicator current={step} />

        {step === 'upload' && (
          <UploadStep fileInputRef={fileInputRef} onFile={handleFile} parseError={parseError} />
        )}

        {step === 'map' && parsed && (
          <MapStep
            headers={parsed.headers}
            mapping={mapping}
            setMapping={setMapping}
            previewRows={previewRows}
            fileName={fileName}
            warnings={parsed.warnings}
            requiredOk={requiredOk}
            onBack={reset}
            onNext={handleValidate}
          />
        )}

        {step === 'validate' && validation && (
          <ValidateStep
            validation={validation}
            onBack={() => setStep('map')}
            onConfirm={handleImport}
          />
        )}

        {step === 'import' && progress && <ImportStep progress={progress} />}

        {step === 'done' && progress && (
          <DoneStep progress={progress} errors={importErrors} onReset={reset} />
        )}
      </div>
    </div>
  );
}

// ---- subcomponents ----------------------------------------------------

const STEPS: Step[] = ['upload', 'map', 'validate', 'import', 'done'];
const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload',
  map: 'Map columns',
  validate: 'Validate',
  import: 'Importing',
  done: 'Done',
};

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <ol className="flex justify-center gap-2 mb-6 flex-wrap">
      {STEPS.map((s, i) => (
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
          {STEP_LABELS[s]}
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
          const f = e.dataTransfer?.files?.[0];
          if (f) onFile(f);
        }}
        className={[
          'border-2 border-dashed rounded-xl p-12 text-center transition-colors',
          dragActive ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-gray-50',
        ].join(' ')}
      >
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v8m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-700 mb-2">Drop a CSV file here or click to choose one</p>
        <p className="text-xs text-gray-500 mb-6">Max 10 MB · UTF-8</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          className="hidden"
          id="giving-csv-input"
        />
        <label
          htmlFor="giving-csv-input"
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
  requiredOk,
  onBack,
  onNext,
}: {
  headers: string[];
  mapping: Partial<Record<GivingField, string>>;
  setMapping: (m: Partial<Record<GivingField, string>>) => void;
  previewRows: Record<string, string>[];
  fileName: string | null;
  warnings: string[];
  requiredOk: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const updateMapping = (field: GivingField, header: string) => {
    const next = { ...mapping };
    if (header === '') delete next[field];
    else next[field] = header;
    setMapping(next);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Match your columns</h2>
        <p className="text-sm text-gray-500 mb-4">
          <strong>{fileName}</strong> · {headers.length} columns
        </p>
        {warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {warnings.map((w, i) => <div key={i}>· {w}</div>)}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GIVING_FIELDS.map((f) => (
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
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      {previewRows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 overflow-x-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Preview (first 5 rows)</h3>
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
        <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:text-gray-900">← Back</button>
        <button
          onClick={onNext}
          disabled={!requiredOk}
          className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {requiredOk ? 'Validate rows →' : 'Map Amount + Date to continue'}
        </button>
      </div>
    </div>
  );
}

function ValidateStep({
  validation,
  onBack,
  onConfirm,
}: {
  validation: GivingValidationResult;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const validCount = validation.valid.length;
  const errorCount = validation.errors.length;
  const totalCents = validation.valid.reduce((sum, r) => sum + r.amount_cents, 0);
  const totalUsd = (totalCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Validation results</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Valid gifts" value={validCount} color="green" />
          <StatCard label="Errors / warnings" value={errorCount} color={errorCount > 0 ? 'amber' : 'gray'} />
          <StatCard label="Total amount" value={totalUsd} color="blue" />
        </div>

        {validation.errors.length > 0 && (
          <details className="text-sm" open={validation.errors.length <= 5}>
            <summary className="cursor-pointer font-medium text-gray-700 mb-2">
              {validation.errors.length} row(s) have issues — click for details
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

        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          <strong>Donor matching:</strong> we'll look up each donor by email and link to the existing
          people record. If an email isn't in your people list, the gift still imports — it just shows
          up as unmatched. You can create the people row later and re-link.
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:text-gray-900">← Back</button>
        <button
          onClick={onConfirm}
          disabled={validCount === 0}
          className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import {validCount.toLocaleString()} gift{validCount === 1 ? '' : 's'} →
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
          Processed {progress.processed.toLocaleString()} of {progress.total.toLocaleString()} gifts
        </p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
        <div
          className="bg-amber-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Inserted" value={progress.inserted} color="green" />
        <StatCard label="Matched" value={progress.matched} color="blue" />
        <StatCard label="Unmatched" value={progress.unmatched} color="amber" />
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
  const downloadUnmatched = () => {
    const csv = 'donor_email\n' + Array.from(progress.unmatchedEmails).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unmatched-donors-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadErrors = () => {
    const csv = 'row_index,message\n' + errors.map((e) => `${e.row_index},"${e.message.replace(/"/g, '""')}"`).join('\n');
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
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Inserted" value={progress.inserted} color="green" />
        <StatCard label="Matched" value={progress.matched} color="blue" />
        <StatCard label="Unmatched" value={progress.unmatched} color="amber" />
        <StatCard label="Failed" value={progress.failed} color={progress.failed > 0 ? 'red' : 'gray'} />
      </div>
      {progress.unmatchedEmails.size > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
          <div className="font-medium text-amber-900 mb-1">
            {progress.unmatchedEmails.size} donor email(s) had no matching person record.
          </div>
          <p className="text-amber-800 mb-2">
            Those gifts imported successfully but are not linked to anyone. Create the people records
            (or import a people CSV first), then re-import any time — duplicates are skipped.
          </p>
          <button onClick={downloadUnmatched} className="text-amber-800 hover:text-amber-900 underline">
            Download unmatched-donors CSV →
          </button>
        </div>
      )}
      {errors.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
          <div className="font-medium text-red-800 mb-1">{errors.length} row(s) failed.</div>
          <button onClick={downloadErrors} className="text-red-700 hover:text-red-900 underline">
            Download error CSV →
          </button>
        </div>
      )}
      <div className="flex justify-center gap-3">
        <button onClick={onReset} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          Import another file
        </button>
        <a href="/#giving" className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">
          View giving →
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: 'green' | 'red' | 'amber' | 'gray' | 'blue' }) {
  const colorClass = {
    green: 'text-green-700 bg-green-50',
    red:   'text-red-700 bg-red-50',
    amber: 'text-amber-700 bg-amber-50',
    blue:  'text-blue-700 bg-blue-50',
    gray:  'text-gray-700 bg-gray-50',
  }[color];
  return (
    <div className={['rounded-lg p-3 text-center', colorClass].join(' ')}>
      <div className="text-xl font-light">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-75 mt-1">{label}</div>
    </div>
  );
}

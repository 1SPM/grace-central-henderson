import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  Users,
  CheckCircle,
  AlertCircle,
  X,
  Download,
  ChevronRight,
  RefreshCw,
  Info,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { Person, SmallGroup } from '../types';

interface ImportMapping {
  sourceField: string;
  targetField: keyof Person | 'skip';
}

interface ImportPreview {
  total: number;
  valid: number;
  duplicates: number;
  errors: string[];
  people: Partial<Person>[];
  groups: Partial<SmallGroup>[];
}

interface PlanningCenterImportProps {
  existingPeople: Person[];
  existingGroups: SmallGroup[];
  onImportPeople: (people: Partial<Person>[]) => Promise<void>;
  onImportGroups?: (groups: Partial<SmallGroup>[]) => Promise<void>;
  onBack?: () => void;
}

// Planning Center field mappings
const planningCenterFieldMappings: Record<string, keyof Person> = {
  'First Name': 'firstName',
  'first_name': 'firstName',
  'Last Name': 'lastName',
  'last_name': 'lastName',
  'Email': 'email',
  'email': 'email',
  'Primary Email': 'email',
  'Phone': 'phone',
  'phone': 'phone',
  'Mobile Phone': 'phone',
  'Home Phone': 'phone',
  'Cell Phone': 'phone',
  'Address': 'address',
  'address': 'address',
  'Street': 'address',
  'Street Address': 'address',
  'City': 'city',
  'city': 'city',
  'State': 'state',
  'state': 'state',
  'Province': 'state',
  'Zip': 'zip',
  'zip': 'zip',
  'Postal Code': 'zip',
  'ZIP Code': 'zip',
  'Birthdate': 'birthDate',
  'birthdate': 'birthDate',
  'Birthday': 'birthDate',
  'Date of Birth': 'birthDate',
  'Membership Status': 'status',
  'membership_status': 'status',
  'Status': 'status',
  'Membership Date': 'joinDate',
  'Join Date': 'joinDate',
  'First Visit': 'firstVisit',
  'first_visit': 'firstVisit',
  'Notes': 'notes',
  'notes': 'notes',
};

// Status value mappings
const statusMappings: Record<string, Person['status']> = {
  'Visitor': 'visitor',
  'visitor': 'visitor',
  'Guest': 'visitor',
  'guest': 'visitor',
  'Regular Attender': 'regular',
  'regular_attender': 'regular',
  'Regular': 'regular',
  'regular': 'regular',
  'Member': 'member',
  'member': 'member',
  'Active Member': 'member',
  'Leader': 'leader',
  'leader': 'leader',
  'Staff': 'leader',
  'Inactive': 'inactive',
  'inactive': 'inactive',
  'Former': 'inactive',
};

export function PlanningCenterImport({
  existingPeople,
  // existingGroups - reserved for future group import support
  onImportPeople,
  // onImportGroups - reserved for future group import support
  onBack,
}: PlanningCenterImportProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [, setHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<ImportMapping[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [importType, setImportType] = useState<'people' | 'groups'>('people');
  const [error, setError] = useState<string | null>(null);

  // Parse CSV content
  const parseCSV = useCallback((content: string): { headers: string[]; data: Record<string, string>[] } => {
    const lines = content.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('CSV file must have headers and at least one data row');
    }

    // Parse header row
    const headerLine = lines[0];
    const csvHeaders = parseCSVLine(headerLine);

    // Parse data rows
    const data: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === csvHeaders.length) {
        const row: Record<string, string> = {};
        csvHeaders.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return { headers: csvHeaders, data };
  }, []);

  // Parse a single CSV line (handling quotes)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const content = await file.text();

      // Check if it's JSON (Planning Center API export)
      if (file.name.endsWith('.json')) {
        const json = JSON.parse(content);
        if (json.data && Array.isArray(json.data)) {
          // Planning Center API format
          const mapped = json.data.map((item: Record<string, unknown>) => {
            const attrs = (item.attributes || {}) as Record<string, unknown>;
            const record: Record<string, string> = {
              firstName: String(attrs.first_name || attrs.given_name || ''),
              lastName: String(attrs.last_name || attrs.family_name || ''),
              email: String(attrs.primary_email || attrs.email || ''),
              phone: String(attrs.primary_phone || attrs.phone || ''),
              status: String(attrs.membership || attrs.status || 'visitor'),
              birthDate: String(attrs.birthdate || ''),
              address: String(attrs.street || ''),
              city: String(attrs.city || ''),
              state: String(attrs.state || ''),
              zip: String(attrs.zip || ''),
            };
            return record;
          });
          setRawData(mapped);
          setHeaders(Object.keys(mapped[0] || {}));
          autoMapFields(Object.keys(mapped[0] || {}));
          setStep('mapping');
        } else {
          throw new Error('Invalid JSON format. Expected Planning Center API export.');
        }
      } else {
        // CSV format
        const { headers: csvHeaders, data } = parseCSV(content);
        setRawData(data);
        setHeaders(csvHeaders);
        autoMapFields(csvHeaders);
        setStep('mapping');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, [parseCSV]);

  // Auto-map fields based on known Planning Center field names
  const autoMapFields = (csvHeaders: string[]) => {
    const mappings: ImportMapping[] = csvHeaders.map((header) => {
      const targetField = planningCenterFieldMappings[header] || 'skip';
      return { sourceField: header, targetField };
    });
    setFieldMappings(mappings);
  };

  // Update field mapping
  const updateMapping = (sourceField: string, targetField: keyof Person | 'skip') => {
    setFieldMappings((prev) =>
      prev.map((m) =>
        m.sourceField === sourceField ? { ...m, targetField } : m
      )
    );
  };

  // Generate preview
  const generatePreview = useCallback(() => {
    const people: Partial<Person>[] = [];
    const errors: string[] = [];
    let duplicates = 0;

    const existingEmails = new Set(existingPeople.map((p) => p.email.toLowerCase()));
    const existingNames = new Set(existingPeople.map((p) => `${p.firstName} ${p.lastName}`.toLowerCase()));

    rawData.forEach((row, index) => {
      const person: Partial<Person> = {
        tags: [],
        smallGroups: [],
      };

      fieldMappings.forEach(({ sourceField, targetField }) => {
        if (targetField !== 'skip' && row[sourceField]) {
          let value = row[sourceField];

          // Special handling for status field
          if (targetField === 'status') {
            value = statusMappings[value] || 'visitor';
          }

          // Special handling for date fields
          if (['birthDate', 'joinDate', 'firstVisit'].includes(targetField)) {
            const date = parseDate(value);
            if (date) {
              value = date;
            }
          }

          (person as Record<string, unknown>)[targetField] = value;
        }
      });

      // Validate required fields
      if (!person.firstName || !person.lastName) {
        errors.push(`Row ${index + 2}: Missing first or last name`);
        return;
      }

      // Check for duplicates
      const fullName = `${person.firstName} ${person.lastName}`.toLowerCase();
      if (person.email && existingEmails.has(person.email.toLowerCase())) {
        duplicates++;
      } else if (existingNames.has(fullName)) {
        duplicates++;
      }

      people.push(person);
    });

    setPreview({
      total: rawData.length,
      valid: people.length,
      duplicates,
      errors,
      people,
      groups: [],
    });
    setStep('preview');
  }, [rawData, fieldMappings, existingPeople]);

  // Parse various date formats
  const parseDate = (value: string): string | null => {
    if (!value) return null;

    // Try various date formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          continue;
        }
      }
    }

    // Try native date parsing
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      return null;
    }

    return null;
  };

  // Run import
  const runImport = async () => {
    if (!preview) return;

    setStep('importing');
    setImportProgress(0);

    try {
      // Import people in batches
      const batchSize = 50;
      let success = 0;
      let failed = 0;

      for (let i = 0; i < preview.people.length; i += batchSize) {
        const batch = preview.people.slice(i, i + batchSize);
        try {
          await onImportPeople(batch);
          success += batch.length;
        } catch {
          failed += batch.length;
        }
        setImportProgress(Math.round(((i + batchSize) / preview.people.length) * 100));
      }

      setImportResult({ success, failed });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  // Reset and start over
  const reset = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setFieldMappings([]);
    setPreview(null);
    setImportProgress(0);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
          Import from Planning Center
        </h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">
          Import your people and groups data from Planning Center exports
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { id: 'upload', label: 'Upload File' },
            { id: 'mapping', label: 'Map Fields' },
            { id: 'preview', label: 'Review' },
            { id: 'complete', label: 'Complete' },
          ].map((s, i) => {
            const isCurrent = s.id === step || (step === 'importing' && s.id === 'preview');
            const isCompleted =
              (step === 'mapping' && s.id === 'upload') ||
              (step === 'preview' && ['upload', 'mapping'].includes(s.id)) ||
              (step === 'importing' && ['upload', 'mapping'].includes(s.id)) ||
              (step === 'complete' && s.id !== 'complete');

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : i + 1}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    isCurrent
                      ? 'text-gray-900 dark:text-dark-100'
                      : 'text-gray-500 dark:text-dark-400'
                  }`}
                >
                  {s.label}
                </span>
                {i < 3 && (
                  <ChevronRight className="mx-4 text-gray-300 dark:text-dark-600" size={20} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-400">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400/80 mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-8">
          {/* Import Type Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">
              What would you like to import?
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setImportType('people')}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  importType === 'people'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                }`}
              >
                <Users className={`mb-2 ${importType === 'people' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} size={24} />
                <h3 className={`font-semibold ${importType === 'people' ? 'text-indigo-900 dark:text-indigo-400' : 'text-gray-900 dark:text-dark-100'}`}>
                  People
                </h3>
                <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                  Import members, visitors, and contacts
                </p>
              </button>
              <button
                type="button"
                onClick={() => setImportType('groups')}
                disabled
                className="p-4 rounded-xl border-2 border-gray-200 dark:border-dark-600 text-left opacity-50 cursor-not-allowed"
              >
                <Users className="mb-2 text-gray-400" size={24} />
                <h3 className="font-semibold text-gray-900 dark:text-dark-100">Groups</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                  Coming soon
                </p>
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-xl p-8 text-center">
            <Upload className="mx-auto text-gray-400 dark:text-dark-500 mb-4" size={48} />
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-2">
              Upload Planning Center Export
            </h3>
            <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
              Drag and drop a CSV or JSON file, or click to browse
            </p>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 cursor-pointer"
            >
              <FileText size={18} />
              Select File
            </label>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="text-blue-500 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-400">
                  How to export from Planning Center
                </h4>
                <ol className="text-sm text-blue-700 dark:text-blue-400/80 mt-2 list-decimal list-inside space-y-1">
                  <li>Go to Planning Center People</li>
                  <li>Select the people you want to export</li>
                  <li>Click the Export button</li>
                  <li>Choose CSV or use the API for JSON</li>
                  <li>Upload the exported file here</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
          <div className="p-4 border-b border-gray-200 dark:border-dark-700">
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">
              Map Fields ({rawData.length} records found)
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              Match the imported columns to GRACE CRM fields
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {fieldMappings.map((mapping) => (
              <div key={mapping.sourceField} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-dark-100">
                    {mapping.sourceField}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">
                    Sample: {rawData[0]?.[mapping.sourceField] || '(empty)'}
                  </p>
                </div>
                <ChevronRight className="mx-4 text-gray-300 dark:text-dark-600" size={20} />
                <select
                  value={mapping.targetField}
                  onChange={(e) => updateMapping(mapping.sourceField, e.target.value as keyof Person | 'skip')}
                  className="px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="skip">Skip this field</option>
                  <option value="firstName">First Name</option>
                  <option value="lastName">Last Name</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="address">Address</option>
                  <option value="city">City</option>
                  <option value="state">State</option>
                  <option value="zip">ZIP Code</option>
                  <option value="birthDate">Birth Date</option>
                  <option value="joinDate">Join Date</option>
                  <option value="firstVisit">First Visit</option>
                  <option value="status">Status</option>
                  <option value="notes">Notes</option>
                </select>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex justify-between">
            <button
              onClick={reset}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
            >
              Start Over
            </button>
            <button
              onClick={generatePreview}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
            >
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{preview.total}</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">Total Records</p>
            </div>
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{preview.valid}</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">Valid Records</p>
            </div>
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{preview.duplicates}</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">Duplicates</p>
            </div>
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.errors.length}</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">Errors</p>
            </div>
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20 p-4">
              <h3 className="font-medium text-red-900 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={18} />
                Issues Found
              </h3>
              <ul className="mt-2 text-sm text-red-700 dark:text-red-400/80 space-y-1">
                {preview.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {preview.errors.length > 5 && (
                  <li>...and {preview.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Sample Data */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h3 className="font-semibold text-gray-900 dark:text-dark-100">Preview (first 5 records)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-dark-850">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-dark-400">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-dark-400">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-dark-400">Phone</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-dark-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {preview.people.slice(0, 5).map((person, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-900 dark:text-dark-100">
                        {person.firstName} {person.lastName}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-dark-400">{person.email || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-dark-400">{person.phone || '-'}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400 rounded">
                          {person.status || 'visitor'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
            >
              Back to Mapping
            </button>
            <button
              onClick={runImport}
              disabled={preview.valid === 0}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Download size={18} />
              Import {preview.valid} Records
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-8 text-center">
          <RefreshCw className="mx-auto text-indigo-600 dark:text-indigo-400 mb-4 animate-spin" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">
            Importing Data...
          </h2>
          <p className="text-gray-500 dark:text-dark-400 mb-6">
            Please wait while we import your data
          </p>
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-3 mb-2">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-dark-400">{importProgress}% complete</p>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && importResult && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-8 text-center">
          <CheckCircle className="mx-auto text-emerald-500 mb-4" size={64} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">
            Import Complete!
          </h2>
          <p className="text-gray-500 dark:text-dark-400 mb-6">
            Successfully imported {importResult.success} records
            {importResult.failed > 0 && ` (${importResult.failed} failed)`}
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={reset}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
            >
              Import More
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                View People
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

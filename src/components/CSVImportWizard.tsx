import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  Users,
} from 'lucide-react';
import { Person, MemberStatus } from '../types';

interface CSVImportWizardProps {
  onImport: (people: Partial<Person>[]) => Promise<void>;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'complete';

interface ColumnMapping {
  csvColumn: string;
  personField: keyof Person | 'skip';
}

const PERSON_FIELDS: { key: keyof Person | 'skip'; label: string; required?: boolean }[] = [
  { key: 'skip', label: 'Skip this column' },
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP Code' },
  { key: 'birthDate', label: 'Birth Date' },
  { key: 'joinDate', label: 'Join Date' },
  { key: 'firstVisit', label: 'First Visit' },
  { key: 'notes', label: 'Notes' },
  { key: 'tags', label: 'Tags (comma/semicolon separated)' },
];

const STATUS_MAP: Record<string, MemberStatus> = {
  visitor: 'visitor',
  guest: 'visitor',
  new: 'visitor',
  regular: 'regular',
  attendee: 'regular',
  member: 'member',
  active: 'member',
  leader: 'leader',
  staff: 'leader',
  pastor: 'leader',
  inactive: 'inactive',
  former: 'inactive',
  lapsed: 'inactive',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
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
}

function guessFieldMapping(header: string): keyof Person | 'skip' {
  const normalized = header.toLowerCase().replace(/[^a-z]/g, '');

  const mappings: Record<string, keyof Person> = {
    firstname: 'firstName',
    first: 'firstName',
    fname: 'firstName',
    givenname: 'firstName',
    lastname: 'lastName',
    last: 'lastName',
    lname: 'lastName',
    surname: 'lastName',
    familyname: 'lastName',
    email: 'email',
    emailaddress: 'email',
    mail: 'email',
    phone: 'phone',
    telephone: 'phone',
    mobile: 'phone',
    cell: 'phone',
    phonenumber: 'phone',
    status: 'status',
    memberstatus: 'status',
    type: 'status',
    address: 'address',
    streetaddress: 'address',
    street: 'address',
    address1: 'address',
    city: 'city',
    town: 'city',
    state: 'state',
    province: 'state',
    region: 'state',
    zip: 'zip',
    zipcode: 'zip',
    postalcode: 'zip',
    postal: 'zip',
    birthday: 'birthDate',
    birthdate: 'birthDate',
    dob: 'birthDate',
    dateofbirth: 'birthDate',
    joindate: 'joinDate',
    membershipdate: 'joinDate',
    joined: 'joinDate',
    firstvisit: 'firstVisit',
    visitdate: 'firstVisit',
    notes: 'notes',
    comments: 'notes',
    note: 'notes',
    tags: 'tags',
    groups: 'tags',
    categories: 'tags',
  };

  return mappings[normalized] || 'skip';
}

export function CSVImportWizard({ onImport, onClose }: CSVImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((file: File) => {
    setError('');

    if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
      setError('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCSVText(text);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const processCSVText = useCallback((text: string) => {
    try {
      const lines = text.trim().split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setError('CSV must have at least a header row and one data row');
        return;
      }

      const parsedLines = lines.map(line => parseCSVLine(line));
      const headerRow = parsedLines[0];
      const dataRows = parsedLines.slice(1);

      setCsvData(dataRows);

      // Auto-guess mappings
      const autoMappings = headerRow.map(h => ({
        csvColumn: h,
        personField: guessFieldMapping(h),
      }));
      setMappings(autoMappings);

      setStep('mapping');
    } catch {
      setError('Failed to parse CSV file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handlePaste = useCallback(() => {
    navigator.clipboard.readText().then(text => {
      if (text.trim()) {
        processCSVText(text);
      }
    }).catch(() => {
      setError('Failed to read clipboard. Please use the file upload.');
    });
  }, [processCSVText]);

  const updateMapping = useCallback((index: number, field: keyof Person | 'skip') => {
    setMappings(prev => prev.map((m, i) =>
      i === index ? { ...m, personField: field } : m
    ));
  }, []);

  const previewPeople = useMemo(() => {
    if (!csvData.length || !mappings.length) return [];

    const dataRows = hasHeaderRow ? csvData : csvData;

    return dataRows.slice(0, 5).map((row, rowIndex) => {
      const person: Partial<Person> = {};

      mappings.forEach((mapping, colIndex) => {
        if (mapping.personField === 'skip') return;

        const value = row[colIndex]?.trim() || '';
        if (!value) return;

        if (mapping.personField === 'status') {
          const normalized = value.toLowerCase();
          person.status = STATUS_MAP[normalized] || 'visitor';
        } else if (mapping.personField === 'tags') {
          const tags = value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
          person.tags = tags;
        } else {
          (person as any)[mapping.personField] = value;
        }
      });

      return { data: person, row: rowIndex + 1 };
    });
  }, [csvData, mappings, hasHeaderRow]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    const hasFirstName = mappings.some(m => m.personField === 'firstName');
    const hasLastName = mappings.some(m => m.personField === 'lastName');

    if (!hasFirstName) errors.push('First Name is required');
    if (!hasLastName) errors.push('Last Name is required');

    // Check for duplicate mappings
    const usedFields = mappings
      .filter(m => m.personField !== 'skip')
      .map(m => m.personField);
    const duplicates = usedFields.filter((f, i) => usedFields.indexOf(f) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate mapping: ${duplicates.join(', ')}`);
    }

    return errors;
  }, [mappings]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError('');

    try {
      const people: Partial<Person>[] = [];
      const errors: string[] = [];

      csvData.forEach((row, rowIndex) => {
        const person: Partial<Person> = {
          tags: [],
          smallGroups: [],
        };

        let hasRequiredFields = true;

        mappings.forEach((mapping, colIndex) => {
          if (mapping.personField === 'skip') return;

          const value = row[colIndex]?.trim() || '';

          if (mapping.personField === 'firstName' && !value) hasRequiredFields = false;
          if (mapping.personField === 'lastName' && !value) hasRequiredFields = false;

          if (!value) return;

          if (mapping.personField === 'status') {
            const normalized = value.toLowerCase();
            person.status = STATUS_MAP[normalized] || 'visitor';
          } else if (mapping.personField === 'tags') {
            const tags = value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
            person.tags = tags;
          } else {
            (person as any)[mapping.personField] = value;
          }
        });

        if (!hasRequiredFields) {
          errors.push(`Row ${rowIndex + 2}: Missing required first or last name`);
          return;
        }

        if (!person.status) person.status = 'visitor';

        people.push(person);
      });

      if (people.length === 0) {
        setError('No valid records found to import');
        setImporting(false);
        return;
      }

      await onImport(people);

      setImportResult({ success: people.length, errors });
      setStep('complete');
    } catch (err) {
      setError('Failed to import data. Please try again.');
    } finally {
      setImporting(false);
    }
  }, [csvData, mappings, onImport]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">Import People</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
              {step === 'upload' && 'Upload a CSV file or paste data'}
              {step === 'mapping' && 'Map CSV columns to person fields'}
              {step === 'preview' && 'Review data before importing'}
              {step === 'complete' && 'Import complete'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {['upload', 'mapping', 'preview', 'complete'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-indigo-600 text-white'
                    : ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > i
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
                }`}>
                  {['upload', 'mapping', 'preview', 'complete'].indexOf(step) > i ? (
                    <Check size={16} />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div className={`w-16 h-0.5 ${
                    ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-dark-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                }`}
              >
                <Upload size={48} className={`mx-auto mb-4 ${
                  dragActive ? 'text-indigo-500' : 'text-gray-400'
                }`} />
                <p className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-2">
                  Drop your CSV file here
                </p>
                <p className="text-gray-500 dark:text-dark-400 mb-4">
                  or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  <FileText size={18} />
                  Choose File
                </label>
              </div>

              {/* Paste Option */}
              <div className="text-center">
                <p className="text-gray-500 dark:text-dark-400 mb-3">Or paste from clipboard</p>
                <button
                  onClick={handlePaste}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                >
                  Paste CSV Data
                </button>
              </div>

              {/* Sample Format */}
              <div className="bg-gray-50 dark:bg-dark-900 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">Expected format:</p>
                <code className="text-xs text-gray-600 dark:text-dark-400 font-mono">
                  firstName,lastName,email,phone,status<br />
                  John,Doe,john@example.com,555-1234,member<br />
                  Jane,Smith,jane@example.com,555-5678,visitor
                </code>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                <input
                  type="checkbox"
                  id="hasHeader"
                  checked={hasHeaderRow}
                  onChange={(e) => setHasHeaderRow(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="hasHeader" className="text-sm text-blue-700 dark:text-blue-400">
                  First row contains column headers
                </label>
              </div>

              {validationErrors.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Please fix the following:</p>
                  <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">CSV Column</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Sample Data</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Map To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-dark-800">
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900 dark:text-dark-100">
                            {mapping.csvColumn || `Column ${index + 1}`}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-500 dark:text-dark-400">
                            {csvData[0]?.[index] || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="relative">
                            <select
                              value={mapping.personField}
                              onChange={(e) => updateMapping(index, e.target.value as keyof Person | 'skip')}
                              className="w-full appearance-none px-3 py-2 pr-8 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg text-sm text-gray-900 dark:text-dark-100"
                            >
                              {PERSON_FIELDS.map(field => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                  {field.required && ' *'}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                <Users size={20} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-indigo-700 dark:text-indigo-300">
                  {csvData.length} {csvData.length === 1 ? 'person' : 'people'} will be imported
                </span>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">Preview (first 5 records)</h3>
                <div className="overflow-x-auto border border-gray-200 dark:border-dark-700 rounded-xl">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-dark-900">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Row</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-dark-400">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewPeople.map(({ data, row }) => (
                        <tr key={row} className="border-t border-gray-100 dark:border-dark-800">
                          <td className="py-3 px-4 text-sm text-gray-500 dark:text-dark-400">{row}</td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-dark-100">
                            {data.firstName} {data.lastName}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 dark:text-dark-400">
                            {data.email || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300">
                              {data.status || 'visitor'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 dark:text-dark-400">
                            {data.tags?.join(', ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && importResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">
                Import Complete!
              </h3>
              <p className="text-gray-500 dark:text-dark-400 mb-6">
                Successfully imported {importResult.success} {importResult.success === 1 ? 'person' : 'people'}
              </p>

              {importResult.errors.length > 0 && (
                <div className="max-w-md mx-auto text-left p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl mb-6">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                    {importResult.errors.length} row(s) skipped:
                  </p>
                  <ul className="text-sm text-amber-600 dark:text-amber-300 list-disc list-inside">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'complete' && (
          <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-between">
            <button
              onClick={() => {
                if (step === 'mapping') setStep('upload');
                if (step === 'preview') setStep('mapping');
              }}
              disabled={step === 'upload'}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft size={18} />
              Back
            </button>

            {step === 'mapping' && (
              <button
                onClick={() => setStep('preview')}
                disabled={validationErrors.length > 0}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Preview
                <ArrowRight size={18} />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {csvData.length} People
                    <Check size={18} />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Mail,
  Printer,
  Calendar,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  Search,
  ChevronDown,
  Eye,
  X,
  Send,
  AlertCircle,
} from 'lucide-react';
import type { Giving, Person, GivingStatement } from '../types';

interface GivingStatementsProps {
  giving: Giving[];
  people: Person[];
  statements?: GivingStatement[];
  churchName?: string;
  churchAddress?: string;
  churchPhone?: string;
  churchEmail?: string;
  onGenerateStatement: (personId: string, year: number) => void;
  onSendStatement: (statementId: string, method: 'email' | 'print') => void;
  onBack?: () => void;
}

export function GivingStatements({
  giving,
  people,
  statements = [],
  churchName = 'Grace Church',
  churchAddress = '123 Main Street, City, ST 12345',
  churchPhone = '(555) 123-4567',
  churchEmail = 'giving@gracechurch.org',
  onGenerateStatement,
  onSendStatement,
  onBack,
}: GivingStatementsProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1); // Default to last year for tax purposes
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPerson, setPreviewPerson] = useState<Person | null>(null);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [bulkSendMethod, setBulkSendMethod] = useState<'email' | 'print'>('email');
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());

  // Calculate giving by person for selected year
  const givingByPerson = useMemo(() => {
    const yearGiving = giving.filter(
      (g) => new Date(g.date).getFullYear() === selectedYear
    );

    const byPerson: Record<string, {
      total: number;
      byFund: Record<string, number>;
      transactions: typeof yearGiving;
    }> = {};

    yearGiving.forEach((g) => {
      if (!g.personId) return;

      if (!byPerson[g.personId]) {
        byPerson[g.personId] = { total: 0, byFund: {}, transactions: [] };
      }

      byPerson[g.personId].total += g.amount;
      byPerson[g.personId].byFund[g.fund] =
        (byPerson[g.personId].byFund[g.fund] || 0) + g.amount;
      byPerson[g.personId].transactions.push(g);
    });

    return byPerson;
  }, [giving, selectedYear]);

  // Filter people with giving
  const peopleWithGiving = useMemo(() => {
    return people
      .filter((p) => givingByPerson[p.id]?.total > 0)
      .filter(
        (p) =>
          !searchQuery ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => (givingByPerson[b.id]?.total || 0) - (givingByPerson[a.id]?.total || 0));
  }, [people, givingByPerson, searchQuery]);

  // Generate years array
  const years = useMemo(() => {
    const minYear = Math.min(
      ...giving.map((g) => new Date(g.date).getFullYear()),
      currentYear - 5
    );
    const years: number[] = [];
    for (let y = currentYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [giving, currentYear]);

  const handleSelectAll = () => {
    if (selectedPeople.size === peopleWithGiving.length) {
      setSelectedPeople(new Set());
    } else {
      setSelectedPeople(new Set(peopleWithGiving.map((p) => p.id)));
    }
  };

  const handleTogglePerson = (personId: string) => {
    const newSelected = new Set(selectedPeople);
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    setSelectedPeople(newSelected);
  };

  const handleBulkGenerate = () => {
    selectedPeople.forEach((personId) => {
      onGenerateStatement(personId, selectedYear);
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Preview component
  const StatementPreview = ({ person }: { person: Person }) => {
    const personGiving = givingByPerson[person.id];
    if (!personGiving) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Preview Header */}
          <div className="sticky top-0 bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700 p-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100">
              Statement Preview
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onGenerateStatement(person.id, selectedYear);
                  setPreviewPerson(null);
                }}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-1"
              >
                <Download size={14} />
                Download PDF
              </button>
              <button
                onClick={() => setPreviewPerson(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Statement Content */}
          <div className="p-8" id="statement-preview">
            {/* Church Header */}
            <div className="text-center mb-8 pb-6 border-b border-gray-200 dark:border-dark-700">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                {churchName}
              </h1>
              <p className="text-gray-500 dark:text-dark-400 mt-1">{churchAddress}</p>
              <p className="text-gray-500 dark:text-dark-400">
                {churchPhone} • {churchEmail}
              </p>
            </div>

            {/* Statement Title */}
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">
                Contribution Statement
              </h2>
              <p className="text-gray-500 dark:text-dark-400 mt-1">
                For the Year {selectedYear}
              </p>
            </div>

            {/* Donor Info */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-dark-800 rounded-xl">
              <p className="font-semibold text-gray-900 dark:text-dark-100">
                {person.firstName} {person.lastName}
              </p>
              {person.address && (
                <p className="text-gray-600 dark:text-dark-400 text-sm">{person.address}</p>
              )}
              {person.city && person.state && person.zip && (
                <p className="text-gray-600 dark:text-dark-400 text-sm">
                  {person.city}, {person.state} {person.zip}
                </p>
              )}
              <p className="text-gray-600 dark:text-dark-400 text-sm mt-1">{person.email}</p>
            </div>

            {/* Summary */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-4">
                Contribution Summary
              </h3>
              <div className="border border-gray-200 dark:border-dark-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                        Fund
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                    {Object.entries(personGiving.byFund).map(([fund, amount]) => (
                      <tr key={fund}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-100 capitalize">
                          {fund}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-dark-100">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-dark-800">
                    <tr>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-dark-100">
                        Total Contributions
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(personGiving.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Transaction Detail */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-4">
                Contribution Detail
              </h3>
              <div className="border border-gray-200 dark:border-dark-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                        Fund
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                        Method
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                    {personGiving.transactions
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-dark-400">
                            {new Date(t.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-dark-100 capitalize">
                            {t.fund}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-dark-400 capitalize">
                            {t.method}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-dark-100">
                            {formatCurrency(t.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500 dark:text-dark-400 border-t border-gray-200 dark:border-dark-700 pt-6">
              <p>
                No goods or services were provided in exchange for these contributions.
              </p>
              <p className="mt-2">
                {churchName} is a 501(c)(3) non-profit organization.
              </p>
              <p className="mt-2 text-xs">
                Statement generated on {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
            Giving Statements
          </h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            Generate and send tax-deductible contribution statements
          </p>
        </div>
        <div className="flex gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              Back to Giving
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center">
              <DollarSign className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <span className="text-sm text-gray-500 dark:text-dark-400">Total for {selectedYear}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
            {formatCurrency(
              Object.values(givingByPerson).reduce((sum, p) => sum + p.total, 0)
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Users className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <span className="text-sm text-gray-500 dark:text-dark-400">Donors</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
            {peopleWithGiving.length}
          </p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
              <FileText className="text-purple-600 dark:text-purple-400" size={20} />
            </div>
            <span className="text-sm text-gray-500 dark:text-dark-400">Statements Sent</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
            {statements.filter((s) => s.year === selectedYear && s.sentAt).length}
          </p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* Year Selector */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="pl-10 pr-8 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 font-medium appearance-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donors..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            />
          </div>

          {/* Bulk Actions */}
          {selectedPeople.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleBulkGenerate}
                className="px-4 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center gap-2"
              >
                <Download size={18} />
                Generate ({selectedPeople.size})
              </button>
              <button
                onClick={() => setShowBulkSend(true)}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 flex items-center gap-2"
              >
                <Send size={18} />
                Send
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Donors List */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        {peopleWithGiving.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
            <p className="text-gray-500 dark:text-dark-400">
              No giving records found for {selectedYear}.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPeople.size === peopleWithGiving.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <span className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Select All
                    </span>
                  </label>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                  Donor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                  Total Giving
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
              {peopleWithGiving.map((person) => {
                const personGiving = givingByPerson[person.id];
                const statement = statements.find(
                  (s) => s.personId === person.id && s.year === selectedYear
                );
                const isSent = statement?.sentAt;

                return (
                  <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPeople.has(person.id)}
                        onChange={() => handleTogglePerson(person.id)}
                        className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-dark-100">
                          {person.firstName} {person.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-400">
                      {person.email}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-900 dark:text-dark-100">
                        {formatCurrency(personGiving?.total || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSent ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                          <CheckCircle size={12} />
                          Sent
                        </span>
                      ) : statement ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full">
                          <Clock size={12} />
                          Generated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewPerson(person)}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"
                          title="Preview"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => onGenerateStatement(person.id, selectedYear)}
                          className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        {person.email && (
                          <button
                            onClick={() => statement && onSendStatement(statement.id, 'email')}
                            className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg"
                            title="Send via Email"
                          >
                            <Mail size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => statement && onSendStatement(statement.id, 'print')}
                          className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg"
                          title="Print"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview Modal */}
      {previewPerson && <StatementPreview person={previewPerson} />}

      {/* Bulk Send Modal */}
      {showBulkSend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Send Statements
              </h3>
              <button
                onClick={() => setShowBulkSend(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 dark:text-dark-400 mb-4">
                Send {selectedYear} giving statements to {selectedPeople.size} selected donors.
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-dark-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-800">
                  <input
                    type="radio"
                    name="sendMethod"
                    value="email"
                    checked={bulkSendMethod === 'email'}
                    onChange={() => setBulkSendMethod('email')}
                    className="w-4 h-4 text-green-500 focus:ring-green-500"
                  />
                  <Mail className="text-blue-500" size={20} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-dark-100">Send via Email</p>
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      Statements will be sent as PDF attachments
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-dark-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-800">
                  <input
                    type="radio"
                    name="sendMethod"
                    value="print"
                    checked={bulkSendMethod === 'print'}
                    onChange={() => setBulkSendMethod('print')}
                    className="w-4 h-4 text-green-500 focus:ring-green-500"
                  />
                  <Printer className="text-amber-500" size={20} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-dark-100">Generate for Print</p>
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      Download all statements as a single PDF
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {bulkSendMethod === 'email' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl text-sm mb-6">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span>
                  Statements will only be sent to donors with valid email addresses.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkSend(false)}
                className="flex-1 py-3 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // In a real implementation, this would trigger the bulk send
                  setShowBulkSend(false);
                }}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-2"
              >
                <Send size={18} />
                {bulkSendMethod === 'email' ? 'Send Emails' : 'Download PDFs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

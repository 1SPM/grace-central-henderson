import { useState, useRef } from 'react';
import { Printer, FileText, Users, Calendar, DollarSign, Heart } from 'lucide-react';
import { Person, Task, PrayerRequest, Giving } from '../types';
import { sanitizeHtml } from '../utils/security';

interface PrintableReportsProps {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  giving: Giving[];
}

type ReportType = 'directory' | 'attendance' | 'giving' | 'prayer' | 'tasks' | 'birthdays';

export function PrintableReports({ people, tasks, prayers, giving }: PrintableReportsProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const reportTypes = [
    { id: 'directory' as ReportType, label: 'Member Directory', icon: Users, description: 'List of all members with contact info' },
    { id: 'birthdays' as ReportType, label: 'Birthday Report', icon: Calendar, description: 'Upcoming birthdays this month' },
    { id: 'giving' as ReportType, label: 'Giving Summary', icon: DollarSign, description: 'Giving totals by person and fund' },
    { id: 'prayer' as ReportType, label: 'Prayer Requests', icon: Heart, description: 'Active prayer requests' },
    { id: 'tasks' as ReportType, label: 'Follow-up Tasks', icon: FileText, description: 'Open tasks and assignments' },
  ];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Sanitize the HTML content to prevent XSS attacks
    const sanitizedContent = sanitizeHtml(printContent.innerHTML);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GRACE CRM Report</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline';">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              color: #1f2937;
            }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin: 16px 0 8px; color: #4f46e5; }
            p.subtitle { color: #6b7280; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
            .badge-blue { background: #dbeafe; color: #1e40af; }
            .badge-green { background: #dcfce7; color: #166534; }
            .badge-amber { background: #fef3c7; color: #92400e; }
            .total-row { font-weight: 600; background: #f9fafb; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          ${sanitizedContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const renderDirectoryReport = () => {
    const sortedPeople = [...people].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );

    return (
      <div>
        <h1>Member Directory</h1>
        <p className="subtitle">Generated on {new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedPeople.map((person) => (
              <tr key={person.id}>
                <td>{person.lastName}, {person.firstName}</td>
                <td>{person.email || '-'}</td>
                <td>{person.phone || '-'}</td>
                <td><span className="badge badge-blue">{person.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>
          Total: {sortedPeople.length} people
        </p>
      </div>
    );
  };

  const renderBirthdayReport = () => {
    const today = new Date();
    const currentMonth = today.getMonth();

    const birthdays = people
      .filter((p) => p.birthDate)
      .map((p) => ({
        ...p,
        birthMonth: new Date(p.birthDate!).getMonth(),
        birthDay: new Date(p.birthDate!).getDate(),
      }))
      .filter((p) => p.birthMonth === currentMonth)
      .sort((a, b) => a.birthDay - b.birthDay);

    return (
      <div>
        <h1>Birthday Report - {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
        <p className="subtitle">Generated on {new Date().toLocaleDateString()}</p>
        {birthdays.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {birthdays.map((person) => (
                <tr key={person.id}>
                  <td>{today.toLocaleDateString('en-US', { month: 'short' })} {person.birthDay}</td>
                  <td>{person.firstName} {person.lastName}</td>
                  <td>{person.email || '-'}</td>
                  <td>{person.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No birthdays this month.</p>
        )}
        <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>
          Total: {birthdays.length} birthdays this month
        </p>
      </div>
    );
  };

  const renderGivingReport = () => {
    // Group by person
    const givingByPerson = new Map<string, { name: string; total: number; count: number }>();
    const givingByFund = new Map<string, number>();

    giving.forEach((g) => {
      const person = people.find((p) => p.id === g.personId);
      const name = person ? `${person.firstName} ${person.lastName}` : 'Anonymous';

      if (givingByPerson.has(g.personId)) {
        const entry = givingByPerson.get(g.personId)!;
        entry.total += g.amount;
        entry.count++;
      } else {
        givingByPerson.set(g.personId, { name, total: g.amount, count: 1 });
      }

      givingByFund.set(g.fund, (givingByFund.get(g.fund) || 0) + g.amount);
    });

    const sortedGiving = Array.from(givingByPerson.values()).sort((a, b) => b.total - a.total);
    const totalGiving = giving.reduce((sum, g) => sum + g.amount, 0);

    return (
      <div>
        <h1>Giving Summary Report</h1>
        <p className="subtitle">Generated on {new Date().toLocaleDateString()}</p>

        <h2>By Fund</h2>
        <table>
          <thead>
            <tr>
              <th>Fund</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(givingByFund.entries()).map(([fund, total]) => (
              <tr key={fund}>
                <td style={{ textTransform: 'capitalize' }}>{fund}</td>
                <td style={{ textAlign: 'right' }}>${total.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Grand Total</td>
              <td style={{ textAlign: 'right' }}>${totalGiving.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <h2>By Contributor</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: 'right' }}>Gifts</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedGiving.slice(0, 20).map((entry, idx) => (
              <tr key={idx}>
                <td>{entry.name}</td>
                <td style={{ textAlign: 'right' }}>{entry.count}</td>
                <td style={{ textAlign: 'right' }}>${entry.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPrayerReport = () => {
    const activePrayers = prayers.filter((p) => !p.isAnswered && !p.isPrivate);

    return (
      <div>
        <h1>Prayer Requests</h1>
        <p className="subtitle">Active requests as of {new Date().toLocaleDateString()}</p>
        {activePrayers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Request</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {activePrayers.map((prayer) => {
                const person = people.find((p) => p.id === prayer.personId);
                return (
                  <tr key={prayer.id}>
                    <td>{person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}</td>
                    <td>{prayer.content}</td>
                    <td>{new Date(prayer.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No active prayer requests.</p>
        )}
        <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>
          Total: {activePrayers.length} active requests
        </p>
      </div>
    );
  };

  const renderTasksReport = () => {
    const openTasks = tasks.filter((t) => !t.completed);
    const sortedTasks = [...openTasks].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    return (
      <div>
        <h1>Follow-up Tasks Report</h1>
        <p className="subtitle">Open tasks as of {new Date().toLocaleDateString()}</p>
        {sortedTasks.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Person</th>
                <th>Due Date</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => {
                const person = people.find((p) => p.id === task.personId);
                const isOverdue = new Date(task.dueDate) < new Date();
                return (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td>{person ? `${person.firstName} ${person.lastName}` : '-'}</td>
                    <td style={{ color: isOverdue ? '#dc2626' : undefined }}>
                      {new Date(task.dueDate).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`badge ${
                        task.priority === 'high' ? 'badge-amber' :
                        task.priority === 'medium' ? 'badge-blue' : 'badge-green'
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No open tasks.</p>
        )}
        <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>
          Total: {sortedTasks.length} open tasks
        </p>
      </div>
    );
  };

  const renderReport = () => {
    switch (selectedReport) {
      case 'directory':
        return renderDirectoryReport();
      case 'birthdays':
        return renderBirthdayReport();
      case 'giving':
        return renderGivingReport();
      case 'prayer':
        return renderPrayerReport();
      case 'tasks':
        return renderTasksReport();
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Reports</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Generate and print reports</p>
      </div>

      {/* Report Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedReport === report.id
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                : 'border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 hover:border-indigo-200 dark:hover:border-indigo-500/30'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                selectedReport === report.id
                  ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
              }`}>
                <report.icon size={20} />
              </div>
              <span className="font-medium text-gray-900 dark:text-dark-100">{report.label}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-dark-400">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Report Preview */}
      {selectedReport && (
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">Preview</h2>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              <Printer size={16} />
              Print Report
            </button>
          </div>
          <div className="p-6 overflow-x-auto">
            <div ref={printRef} className="min-w-[600px]">
              {renderReport()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

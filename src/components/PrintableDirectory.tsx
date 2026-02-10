/**
 * Printable Directory Component
 *
 * Generates a printable PDF directory of church members.
 * Supports photos, filtering, and multiple layout options.
 */

import { useState, useRef } from 'react';
import {
  Printer,
  Users,
  Grid,
  List,
  Filter,
  Search,
  Eye,
  X,
} from 'lucide-react';

interface DirectoryMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  photoUrl?: string;
  familyId?: string;
  memberSince?: string;
  status: 'active' | 'inactive' | 'visitor';
}

interface PrintableDirectoryProps {
  members: DirectoryMember[];
  churchName: string;
}

type LayoutType = 'grid' | 'list' | 'compact';

export function PrintableDirectory({
  members,
  churchName,
}: PrintableDirectoryProps) {
  const [layout, setLayout] = useState<LayoutType>('grid');
  const [showPhotos, setShowPhotos] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showAddress, setShowAddress] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Filter and sort members
  const filteredMembers = members
    .filter((m) => {
      if (statusFilter === 'all') return true;
      return m.status === statusFilter;
    })
    .filter((m) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        m.firstName.toLowerCase().includes(search) ||
        m.lastName.toLowerCase().includes(search) ||
        m.email?.toLowerCase().includes(search) ||
        m.phone?.includes(search)
      );
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  // Group by last name initial
  const groupedMembers = filteredMembers.reduce(
    (groups, member) => {
      const initial = member.lastName[0]?.toUpperCase() || '#';
      if (!groups[initial]) groups[initial] = [];
      groups[initial].push(member);
      return groups;
    },
    {} as Record<string, DirectoryMember[]>
  );

  // Handle print
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${churchName} Directory</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header p { color: #6b7280; }
            .section { margin-bottom: 20px; page-break-inside: avoid; }
            .section-header { font-size: 18px; font-weight: bold; color: #4F46E5; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }

            /* Grid layout */
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .grid-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; page-break-inside: avoid; }
            .grid-card .photo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-right: 10px; float: left; }
            .grid-card .photo-placeholder { width: 60px; height: 60px; border-radius: 50%; background: #e5e7eb; margin-right: 10px; float: left; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 24px; }
            .grid-card .info { overflow: hidden; }
            .grid-card .name { font-weight: bold; font-size: 14px; }
            .grid-card .contact { font-size: 12px; color: #6b7280; }

            /* List layout */
            .list-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6; page-break-inside: avoid; }
            .list-item .photo { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-right: 15px; }
            .list-item .photo-placeholder { width: 50px; height: 50px; border-radius: 50%; background: #e5e7eb; margin-right: 15px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 20px; }
            .list-item .name { font-weight: bold; width: 200px; }
            .list-item .contact { flex: 1; font-size: 14px; color: #6b7280; }

            /* Compact layout */
            .compact { columns: 3; column-gap: 30px; }
            .compact-item { break-inside: avoid; padding: 3px 0; font-size: 13px; }
            .compact-item .name { font-weight: bold; }
            .compact-item .contact { color: #6b7280; }

            @media print {
              body { padding: 0; }
              .header { page-break-after: avoid; }
              .section { page-break-before: auto; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Render member based on layout
  const renderMember = (member: DirectoryMember) => {
    const initials = `${member.firstName[0]}${member.lastName[0]}`;

    if (layout === 'compact') {
      return (
        <div key={member.id} className="compact-item">
          <span className="name">
            {member.lastName}, {member.firstName}
          </span>
          {showPhone && member.phone && (
            <span className="contact"> - {member.phone}</span>
          )}
        </div>
      );
    }

    if (layout === 'list') {
      return (
        <div key={member.id} className="list-item">
          {showPhotos ? (
            member.photoUrl ? (
              <img src={member.photoUrl} alt="" className="photo" />
            ) : (
              <div className="photo-placeholder">{initials}</div>
            )
          ) : null}
          <span className="name">
            {member.lastName}, {member.firstName}
          </span>
          <span className="contact">
            {showEmail && member.email && <span>{member.email}</span>}
            {showEmail && showPhone && member.email && member.phone && <span> | </span>}
            {showPhone && member.phone && <span>{member.phone}</span>}
          </span>
        </div>
      );
    }

    // Grid layout (default)
    return (
      <div key={member.id} className="grid-card">
        {showPhotos ? (
          member.photoUrl ? (
            <img src={member.photoUrl} alt="" className="photo" />
          ) : (
            <div className="photo-placeholder">{initials}</div>
          )
        ) : null}
        <div className="info">
          <div className="name">
            {member.firstName} {member.lastName}
          </div>
          {showEmail && member.email && <div className="contact">{member.email}</div>}
          {showPhone && member.phone && <div className="contact">{member.phone}</div>}
          {showAddress && member.address && (
            <div className="contact">
              {member.address.city}, {member.address.state}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Printable Directory</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generate a PDF directory for printing or distribution
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Layout Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Layout Style
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setLayout('grid')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm transition-colors ${
                layout === 'grid'
                  ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => setLayout('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm transition-colors ${
                layout === 'list'
                  ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setLayout('compact')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm transition-colors ${
                layout === 'compact'
                  ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        {/* Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Include Members
          </label>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            >
              <option value="active">Active Members Only</option>
              <option value="all">All Members</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Filter className="w-5 h-5" />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-10 min-w-[200px]">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showPhotos}
                        onChange={(e) => setShowPhotos(e.target.checked)}
                        className="rounded"
                      />
                      Show Photos
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showEmail}
                        onChange={(e) => setShowEmail(e.target.checked)}
                        className="rounded"
                      />
                      Show Email
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showPhone}
                        onChange={(e) => setShowPhone(e.target.checked)}
                        className="rounded"
                      />
                      Show Phone
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showAddress}
                        onChange={(e) => setShowAddress(e.target.checked)}
                        className="rounded"
                      />
                      Show City/State
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
        <span>{filteredMembers.length} members will be included</span>
        <span>Grouped by last name</span>
      </div>

      {/* Preview Mini View */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[300px] overflow-auto">
        <div className="text-center text-sm text-gray-500 mb-3">Directory Preview (scroll to see more)</div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700">
          {Object.keys(groupedMembers).length === 0 ? (
            <p className="text-center text-gray-500 py-8">No members match your filters</p>
          ) : (
            Object.entries(groupedMembers)
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(0, 3)
              .map(([initial, sectionMembers]) => (
                <div key={initial} className="mb-4">
                  <h3 className="text-lg font-bold text-purple-600 border-b border-gray-200 pb-1 mb-2">
                    {initial}
                  </h3>
                  <div
                    className={
                      layout === 'grid'
                        ? 'grid grid-cols-2 gap-2'
                        : layout === 'compact'
                          ? 'columns-2 text-sm'
                          : 'space-y-1'
                    }
                  >
                    {sectionMembers.slice(0, 4).map((member) => (
                      <div
                        key={member.id}
                        className={`text-sm ${layout === 'compact' ? 'break-inside-avoid py-0.5' : 'p-2 border border-gray-100 rounded'}`}
                      >
                        <span className="font-medium">
                          {layout === 'compact'
                            ? `${member.lastName}, ${member.firstName}`
                            : `${member.firstName} ${member.lastName}`}
                        </span>
                        {layout !== 'compact' && showPhone && member.phone && (
                          <span className="text-gray-500 text-xs block">{member.phone}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
          {Object.keys(groupedMembers).length > 3 && (
            <p className="text-center text-gray-400 text-sm">
              ...and {Object.keys(groupedMembers).length - 3} more sections
            </p>
          )}
        </div>
      </div>

      {/* Hidden print content */}
      <div ref={printRef} className="hidden">
        <div className="header">
          <h1>{churchName}</h1>
          <p>Member Directory - {new Date().toLocaleDateString()}</p>
        </div>

        {Object.entries(groupedMembers)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([initial, sectionMembers]) => (
            <div key={initial} className="section">
              <div className="section-header">{initial}</div>
              <div className={layout}>{sectionMembers.map(renderMember)}</div>
            </div>
          ))}
      </div>

      {/* Full Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold">Directory Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="bg-white border border-gray-200 p-8 max-w-[800px] mx-auto">
                <div className="text-center mb-8 pb-4 border-b-2 border-gray-200">
                  <h1 className="text-2xl font-bold">{churchName}</h1>
                  <p className="text-gray-500">Member Directory - {new Date().toLocaleDateString()}</p>
                </div>

                {Object.entries(groupedMembers)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([initial, sectionMembers]) => (
                    <div key={initial} className="mb-6">
                      <h3 className="text-xl font-bold text-purple-600 border-b border-gray-200 pb-1 mb-3">
                        {initial}
                      </h3>
                      <div
                        className={
                          layout === 'grid'
                            ? 'grid grid-cols-3 gap-3'
                            : layout === 'compact'
                              ? 'columns-3 gap-6'
                              : 'space-y-2'
                        }
                      >
                        {sectionMembers.map((member) => {
                          const initials = `${member.firstName[0]}${member.lastName[0]}`;
                          return (
                            <div
                              key={member.id}
                              className={
                                layout === 'compact'
                                  ? 'break-inside-avoid py-1'
                                  : layout === 'grid'
                                    ? 'border border-gray-200 rounded-lg p-3 flex gap-3'
                                    : 'flex items-center gap-3 py-2 border-b border-gray-100'
                              }
                            >
                              {layout !== 'compact' && showPhotos && (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm flex-shrink-0">
                                  {initials}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">
                                  {layout === 'compact'
                                    ? `${member.lastName}, ${member.firstName}`
                                    : `${member.firstName} ${member.lastName}`}
                                </div>
                                {layout !== 'compact' && (
                                  <>
                                    {showEmail && member.email && (
                                      <div className="text-xs text-gray-500">{member.email}</div>
                                    )}
                                    {showPhone && member.phone && (
                                      <div className="text-xs text-gray-500">{member.phone}</div>
                                    )}
                                  </>
                                )}
                                {layout === 'compact' && showPhone && member.phone && (
                                  <span className="text-xs text-gray-500"> - {member.phone}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

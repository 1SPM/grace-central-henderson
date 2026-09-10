/**
 * Settings → Migrate data section.
 *
 * Surfaces the two CSV import wizards so admins can discover them
 * without knowing the magic URL. Both wizards live at top-level
 * routes (/import and /import/giving) because they need a clean
 * full-page experience — Settings just routes the user to them.
 *
 * Source-system hints are intentional: the operator has to know we
 * accept Planning Center / Breeze / ChurchTrac exports without
 * conversion. That removes the most common migration objection.
 */

import { Upload, FileSpreadsheet, Heart } from 'lucide-react';

export function SettingsImport() {
  return (
    <section className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Upload size={18} className="text-gray-500" />
        <h2 className="font-semibold text-gray-900 dark:text-dark-100">Migrate data from another system</h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-dark-300">
        Bring people and giving history over from Planning Center, Breeze, ChurchTrac, or any
        spreadsheet. Both wizards auto-detect the columns; most uploads are one click.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/import"
          className="block rounded-xl border border-gray-200 dark:border-dark-600 p-5 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-dark-700 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200">
              <FileSpreadsheet size={18} className="text-amber-700" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-dark-100">Import people</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-300">
            First and last name, email, phone, address, birthday, status. Up to 10 MB
            per file. Dedupe by email is on by default.
          </p>
          <div className="text-xs text-amber-700 mt-3 group-hover:text-amber-900">
            Open wizard →
          </div>
        </a>

        <a
          href="/import/giving"
          className="block rounded-xl border border-gray-200 dark:border-dark-600 p-5 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-dark-700 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200">
              <Heart size={18} className="text-amber-700" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-dark-100">Import giving history</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-300">
            Amount, date, donor email, fund, payment method. Donors matched by email.
            Unmatched gifts still import — re-link later.
          </p>
          <div className="text-xs text-amber-700 mt-3 group-hover:text-amber-900">
            Open wizard →
          </div>
        </a>
      </div>

      <div className="text-xs text-gray-500 dark:text-dark-400 pt-2 border-t border-gray-100 dark:border-dark-700">
        Recommended order: people first, then giving — donors match by email so importing
        people first gets you the most matches on first try.
      </div>
    </section>
  );
}

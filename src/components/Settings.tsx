import { Church, Users, Bell, Database } from 'lucide-react';

export function Settings() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your GRACE CRM configuration</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Church className="text-indigo-600" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Church Profile</h2>
              <p className="text-sm text-gray-500">Basic information about your church</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Church Name"
              defaultValue="Grace Community Church"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Address"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Phone"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="text-purple-600" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Team Members</h2>
              <p className="text-sm text-gray-500">Manage staff access</p>
            </div>
          </div>
          <div className="text-center py-6 text-gray-400 text-sm">
            Team management coming soon
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Bell className="text-amber-600" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">Email and alert preferences</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">New visitor alerts</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Task reminders</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Prayer request notifications</span>
              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Database className="text-green-600" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Data & Backup</h2>
              <p className="text-sm text-gray-500">Export and backup options</p>
            </div>
          </div>
          <div className="space-y-2">
            <button className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Export All Data (CSV)
            </button>
            <button className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Import Data
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">GRACE CRM</h2>
            <p className="text-sm opacity-80">Growth · Relationships · Attendance · Community · Engagement</p>
            <p className="text-xs opacity-60 mt-2">Version 1.0.0</p>
          </div>
          <Church size={48} className="opacity-20" />
        </div>
      </div>
    </div>
  );
}

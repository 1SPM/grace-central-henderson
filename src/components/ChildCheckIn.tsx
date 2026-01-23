import { useState, useMemo } from 'react';
import {
  Baby,
  Search,
  Shield,
  AlertTriangle,
  Check,
  Clock,
  User,
  Phone,
  Printer,
  X,
  ArrowLeft,
  Heart,
  Pill,
} from 'lucide-react';
import type { Person } from '../types';

interface ChildCheckInProps {
  people: Person[];
  onBack?: () => void;
}

interface CheckedInChild {
  id: string;
  childId: string;
  childName: string;
  parentName: string;
  parentPhone: string;
  securityCode: string;
  room: string;
  checkedInAt: string;
  allergies?: string;
  medicalNotes?: string;
  checkedOut: boolean;
  checkedOutAt?: string;
}

const ROOMS = [
  { id: 'nursery', name: 'Nursery', ageRange: '0-2 years' },
  { id: 'toddlers', name: 'Toddlers', ageRange: '2-3 years' },
  { id: 'preschool', name: 'Preschool', ageRange: '3-5 years' },
  { id: 'elementary', name: 'Elementary', ageRange: '6-10 years' },
  { id: 'preteen', name: 'Preteen', ageRange: '11-12 years' },
];

function generateSecurityCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function ChildCheckIn({ people, onBack }: ChildCheckInProps) {
  const [search, setSearch] = useState('');
  const [checkedIn, setCheckedIn] = useState<CheckedInChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<Person | null>(null);
  const [checkoutCode, setCheckoutCode] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [printBadge, setPrintBadge] = useState<CheckedInChild | null>(null);

  // Form state for check-in
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Filter children (people with birthDate that makes them under 13)
  const children = useMemo(() => {
    return people.filter(p => {
      if (!p.birthDate) return false;
      const age = getAge(p.birthDate);
      return age >= 0 && age <= 12;
    });
  }, [people]);

  const filteredChildren = useMemo(() => {
    if (!search) return children;
    const searchLower = search.toLowerCase();
    return children.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchLower)
    );
  }, [children, search]);

  const handleCheckIn = () => {
    if (!selectedChild || !parentName || !parentPhone || !selectedRoom) return;

    const securityCode = generateSecurityCode();
    const newCheckIn: CheckedInChild = {
      id: `checkin-${Date.now()}`,
      childId: selectedChild.id,
      childName: `${selectedChild.firstName} ${selectedChild.lastName}`,
      parentName,
      parentPhone,
      securityCode,
      room: selectedRoom,
      checkedInAt: new Date().toISOString(),
      allergies: allergies || undefined,
      medicalNotes: medicalNotes || undefined,
      checkedOut: false,
    };

    setCheckedIn(prev => [...prev, newCheckIn]);
    setPrintBadge(newCheckIn);

    // Reset form
    setSelectedChild(null);
    setParentName('');
    setParentPhone('');
    setSelectedRoom('');
    setAllergies('');
    setMedicalNotes('');
  };

  const handleCheckout = () => {
    const found = checkedIn.find(c => c.securityCode === checkoutCode.toUpperCase() && !c.checkedOut);
    if (found) {
      setCheckedIn(prev =>
        prev.map(c =>
          c.id === found.id
            ? { ...c, checkedOut: true, checkedOutAt: new Date().toISOString() }
            : c
        )
      );
      setCheckoutCode('');
      setShowCheckout(false);
    }
  };

  const activeCheckIns = checkedIn.filter(c => !c.checkedOut);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Baby className="w-6 h-6 text-pink-600" />
              Children's Check-In
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {activeCheckIns.length} children currently checked in
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCheckout(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Shield className="w-4 h-4" />
          Check Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-in Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Check In a Child</h2>

          {!selectedChild ? (
            <>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for child by name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredChildren.map(child => {
                  const age = child.birthDate ? getAge(child.birthDate) : null;
                  const isCheckedIn = checkedIn.some(c => c.childId === child.id && !c.checkedOut);

                  return (
                    <button
                      key={child.id}
                      onClick={() => !isCheckedIn && setSelectedChild(child)}
                      disabled={isCheckedIn}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isCheckedIn
                          ? 'bg-green-50 dark:bg-green-900/20 cursor-not-allowed'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        {child.firstName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {child.firstName} {child.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {age !== null ? `${age} years old` : 'Age unknown'}
                        </p>
                      </div>
                      {isCheckedIn && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                          Checked In
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredChildren.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No children found</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {selectedChild.firstName[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedChild.firstName} {selectedChild.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedChild.birthDate ? `${getAge(selectedChild.birthDate)} years old` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedChild(null)}
                  className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="inline w-4 h-4 mr-1" /> Parent/Guardian Name *
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={e => setParentName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Phone className="inline w-4 h-4 mr-1" /> Parent Phone *
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Room Assignment *
                </label>
                <select
                  value={selectedRoom}
                  onChange={e => setSelectedRoom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select room...</option>
                  {ROOMS.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.ageRange})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <AlertTriangle className="inline w-4 h-4 mr-1 text-amber-500" /> Allergies
                </label>
                <input
                  type="text"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="Peanuts, dairy, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Pill className="inline w-4 h-4 mr-1 text-blue-500" /> Medical Notes
                </label>
                <input
                  type="text"
                  value={medicalNotes}
                  onChange={e => setMedicalNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="Asthma inhaler in bag, etc."
                />
              </div>

              <button
                onClick={handleCheckIn}
                disabled={!parentName || !parentPhone || !selectedRoom}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Check In
              </button>
            </div>
          )}
        </div>

        {/* Currently Checked In */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Currently Checked In ({activeCheckIns.length})
          </h2>

          {activeCheckIns.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Baby className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No children currently checked in</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {activeCheckIns.map(child => {
                const room = ROOMS.find(r => r.id === child.room);
                return (
                  <div
                    key={child.id}
                    className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{child.childName}</p>
                        <p className="text-sm text-gray-500">{room?.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full font-mono font-bold text-lg">
                          <Shield className="w-4 h-4" />
                          {child.securityCode}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="text-gray-500">
                        Parent: {child.parentName} • {child.parentPhone}
                      </span>
                    </div>

                    {(child.allergies || child.medicalNotes) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {child.allergies && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            {child.allergies}
                          </span>
                        )}
                        {child.medicalNotes && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                            <Heart className="w-3 h-3" />
                            {child.medicalNotes}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setPrintBadge(child)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Printer className="w-4 h-4" />
                        Print Badge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-green-600" />
              Child Check-Out
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Enter the 4-character security code to check out a child.
            </p>
            <input
              type="text"
              value={checkoutCode}
              onChange={e => setCheckoutCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="XXXX"
              className="w-full px-4 py-4 text-center text-3xl font-mono font-bold border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white tracking-widest"
              maxLength={4}
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCheckout(false); setCheckoutCode(''); }}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutCode.length !== 4}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Check Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Badge Modal */}
      {printBadge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            {/* Badge Preview */}
            <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <div className="text-center">
                <p className="text-sm opacity-80">Grace Church</p>
                <p className="text-2xl font-bold mt-1">{printBadge.childName}</p>
                <p className="text-sm opacity-80 mt-1">{ROOMS.find(r => r.id === printBadge.room)?.name}</p>
              </div>
              <div className="mt-4 flex justify-center">
                <div className="bg-white text-indigo-600 px-6 py-3 rounded-lg">
                  <p className="text-xs text-center text-gray-500 mb-1">Security Code</p>
                  <p className="text-3xl font-mono font-bold tracking-widest">{printBadge.securityCode}</p>
                </div>
              </div>
              {printBadge.allergies && (
                <div className="mt-4 bg-amber-500/20 border border-amber-400/50 rounded-lg p-2 text-center">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Allergy Alert: {printBadge.allergies}</p>
                </div>
              )}
            </div>
            <div className="p-4 flex gap-3">
              <button
                onClick={() => setPrintBadge(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

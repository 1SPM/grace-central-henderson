import React, { useState } from 'react';
import { Heart, Check, Lock, Unlock, Sparkles } from 'lucide-react';
import { PrayerRequest, Person } from '../types';

interface PrayerProps {
  prayers: PrayerRequest[];
  people: Person[];
  onMarkAnswered: (id: string, testimony?: string) => void;
}

export function Prayer({ prayers, people, onMarkAnswered }: PrayerProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'answered'>('active');
  const [testimonyInput, setTestimonyInput] = useState<Record<string, string>>({});

  const filtered = prayers.filter((p) => {
    if (filter === 'active') return !p.isAnswered;
    if (filter === 'answered') return p.isAnswered;
    return true;
  });

  const handleMarkAnswered = (id: string) => {
    onMarkAnswered(id, testimonyInput[id] || undefined);
    setTestimonyInput({ ...testimonyInput, [id]: '' });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prayer Requests</h1>
          <p className="text-gray-500 mt-1">Lift up your community in prayer</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['active', 'answered', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Prayer List */}
      <div className="space-y-4">
        {filtered.map((prayer) => {
          const person = people.find(p => p.id === prayer.personId);
          
          return (
            <div
              key={prayer.id}
              className={`bg-white rounded-2xl border p-6 ${
                prayer.isAnswered ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {person && (
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                      {person.firstName[0]}{person.lastName[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(prayer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {prayer.isPrivate ? (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Lock size={12} />
                      Private
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Unlock size={12} />
                      Public
                    </span>
                  )}
                  {prayer.isAnswered && (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                      <Check size={12} />
                      Answered
                    </span>
                  )}
                </div>
              </div>

              <p className="text-gray-700">{prayer.content}</p>

              {prayer.testimony && (
                <div className="mt-4 p-4 bg-green-100 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
                    <Sparkles size={16} />
                    Testimony
                  </div>
                  <p className="text-green-800 text-sm">{prayer.testimony}</p>
                </div>
              )}

              {!prayer.isAnswered && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <textarea
                    placeholder="Add testimony (optional)..."
                    value={testimonyInput[prayer.id] || ''}
                    onChange={(e) => setTestimonyInput({ ...testimonyInput, [prayer.id]: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-2"
                  />
                  <button
                    onClick={() => handleMarkAnswered(prayer.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    <Check size={16} />
                    Mark as Answered
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <Heart className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-400">No prayer requests found</p>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Cake, Gift } from 'lucide-react';
import { Person } from '../types';

interface BirthdayCalendarProps {
  people: Person[];
  onViewPerson: (id: string) => void;
}

export function BirthdayCalendar({ people, onViewPerson }: BirthdayCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get birthdays for current month
  const birthdaysThisMonth = people
    .filter((p) => p.birthDate)
    .map((p) => {
      const bday = new Date(p.birthDate!);
      return {
        ...p,
        birthMonth: bday.getMonth(),
        birthDay: bday.getDate(),
        birthYear: bday.getFullYear(),
        age: currentYear - bday.getFullYear(),
      };
    })
    .filter((p) => p.birthMonth === currentMonth)
    .sort((a, b) => a.birthDay - b.birthDay);

  // Get upcoming birthdays (next 30 days)
  const today = new Date();
  const upcomingBirthdays = people
    .filter((p) => p.birthDate)
    .map((p) => {
      const bday = new Date(p.birthDate!);
      const thisYearBirthday = new Date(currentYear, bday.getMonth(), bday.getDate());
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(currentYear + 1);
      }
      const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...p,
        daysUntil,
        nextBirthday: thisYearBirthday,
        age: thisYearBirthday.getFullYear() - bday.getFullYear(),
      };
    })
    .filter((p) => p.daysUntil <= 30 && p.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentYear, currentMonth + direction, 1));
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get days in month for calendar grid
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Map birthdays to days
  const birthdaysByDay = new Map<number, typeof birthdaysThisMonth>();
  birthdaysThisMonth.forEach((p) => {
    if (!birthdaysByDay.has(p.birthDay)) {
      birthdaysByDay.set(p.birthDay, []);
    }
    birthdaysByDay.get(p.birthDay)!.push(p);
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Birthdays & Celebrations</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">
          Never miss a birthday - {birthdaysThisMonth.length} this month
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          {/* Month Navigation */}
          <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600 dark:text-dark-400" />
            </button>
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">{monthName}</h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600 dark:text-dark-400" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 dark:text-dark-400 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before first of month */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24" />
              ))}

              {calendarDays.map((day) => {
                const isToday =
                  day === today.getDate() &&
                  currentMonth === today.getMonth() &&
                  currentYear === today.getFullYear();
                const dayBirthdays = birthdaysByDay.get(day) || [];

                return (
                  <div
                    key={day}
                    className={`min-h-24 p-2 border rounded-lg ${
                      isToday
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-gray-100 dark:border-dark-700'
                    } ${dayBirthdays.length > 0 ? 'bg-pink-50 dark:bg-pink-500/5' : ''}`}
                  >
                    <div className={`text-sm font-medium ${
                      isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-dark-300'
                    }`}>
                      {day}
                    </div>
                    {dayBirthdays.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => onViewPerson(person.id)}
                        className="mt-1 w-full text-left text-xs px-1.5 py-1 bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 rounded truncate hover:bg-pink-200 dark:hover:bg-pink-500/30 transition-colors flex items-center gap-1"
                      >
                        <Cake size={10} />
                        <span className="truncate">{person.firstName}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Birthdays Sidebar */}
        <div className="space-y-6">
          {/* This Month */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center gap-2">
              <Cake size={18} className="text-pink-500" />
              <h3 className="font-semibold text-gray-900 dark:text-dark-100">This Month</h3>
              <span className="ml-auto text-sm text-gray-500 dark:text-dark-400">
                {birthdaysThisMonth.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700 max-h-80 overflow-y-auto">
              {birthdaysThisMonth.length > 0 ? (
                birthdaysThisMonth.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onViewPerson(person.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white font-medium">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-dark-100 truncate">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-dark-400">
                          {monthName.split(' ')[0]} {person.birthDay} • Turns {person.age}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-dark-400">
                  No birthdays this month
                </div>
              )}
            </div>
          </div>

          {/* Upcoming (Next 30 Days) */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center gap-2">
              <Gift size={18} className="text-purple-500" />
              <h3 className="font-semibold text-gray-900 dark:text-dark-100">Coming Up</h3>
              <span className="ml-auto text-sm text-gray-500 dark:text-dark-400">
                Next 30 days
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700 max-h-64 overflow-y-auto">
              {upcomingBirthdays.length > 0 ? (
                upcomingBirthdays.slice(0, 10).map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onViewPerson(person.id)}
                    className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {person.nextBirthday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        person.daysUntil === 0
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400'
                          : person.daysUntil <= 7
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300'
                      }`}>
                        {person.daysUntil === 0
                          ? 'Today!'
                          : person.daysUntil === 1
                          ? 'Tomorrow'
                          : `${person.daysUntil} days`}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-dark-400">
                  No upcoming birthdays
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

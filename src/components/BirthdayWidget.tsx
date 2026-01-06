import { Cake, Gift, ChevronRight } from 'lucide-react';
import type { Person } from '../types';

interface BirthdayWidgetProps {
  people: Person[];
  onViewPerson: (id: string) => void;
}

interface UpcomingBirthday {
  person: Person;
  daysUntil: number;
  date: Date;
}

export function BirthdayWidget({ people, onViewPerson }: BirthdayWidgetProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get upcoming birthdays in the next 30 days
  const upcomingBirthdays: UpcomingBirthday[] = people
    .filter((person) => person.birthDate)
    .map((person) => {
      const birthDate = new Date(person.birthDate!);
      const thisYearBirthday = new Date(
        today.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      );

      // If birthday has passed this year, use next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(thisYearBirthday.getFullYear() + 1);
      }

      const daysUntil = Math.ceil(
        (thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        person,
        daysUntil,
        date: thisYearBirthday,
      };
    })
    .filter((b) => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  const getDaysLabel = (days: number) => {
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  const getAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age + 1; // +1 for upcoming birthday
  };

  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
          <Cake className="text-white" size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-dark-100">Upcoming Birthdays</h3>
          <p className="text-sm text-gray-500 dark:text-dark-400">Next 30 days</p>
        </div>
      </div>

      {upcomingBirthdays.length === 0 ? (
        <div className="py-8 text-center">
          <Gift className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={32} />
          <p className="text-sm text-gray-500 dark:text-dark-400">No birthdays in the next 30 days</p>
          <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
            Add birth dates to people profiles
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingBirthdays.map(({ person, daysUntil, date }) => (
            <button
              key={person.id}
              onClick={() => onViewPerson(person.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
                daysUntil === 0
                  ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-500/10 dark:to-rose-500/10 border border-pink-200 dark:border-pink-500/30'
                  : 'hover:bg-gray-50 dark:hover:bg-dark-800'
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white font-medium">
                  {person.firstName[0]}{person.lastName[0]}
                </div>
                {daysUntil === 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                    <span className="text-xs">🎂</span>
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-dark-100">
                  {person.firstName} {person.lastName}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${
                    daysUntil === 0
                      ? 'text-pink-600 dark:text-pink-400 font-semibold'
                      : daysUntil <= 7
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-dark-400'
                  }`}>
                    {getDaysLabel(daysUntil)}
                  </span>
                  <span className="text-gray-300 dark:text-dark-600">•</span>
                  <span className="text-xs text-gray-500 dark:text-dark-400">
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {person.birthDate && (
                    <>
                      <span className="text-gray-300 dark:text-dark-600">•</span>
                      <span className="text-xs text-gray-500 dark:text-dark-400">
                        Turning {getAge(person.birthDate)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 dark:group-hover:text-dark-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { Person } from '../types';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface ProfileCompletenessProps {
  person: Person;
  showDetails?: boolean;
}

interface FieldCheck {
  label: string;
  filled: boolean;
  weight: number;
}

export function getProfileCompleteness(person: Person): { score: number; fields: FieldCheck[] } {
  const fields: FieldCheck[] = [
    { label: 'First Name', filled: !!person.firstName, weight: 10 },
    { label: 'Last Name', filled: !!person.lastName, weight: 10 },
    { label: 'Email', filled: !!person.email, weight: 15 },
    { label: 'Phone', filled: !!person.phone, weight: 15 },
    { label: 'Address', filled: !!person.address, weight: 10 },
    { label: 'City', filled: !!person.city, weight: 5 },
    { label: 'State', filled: !!person.state, weight: 5 },
    { label: 'Birth Date', filled: !!person.birthDate, weight: 10 },
    { label: 'Photo', filled: !!person.photo, weight: 5 },
    { label: 'Tags', filled: person.tags.length > 0, weight: 5 },
    { label: 'Notes', filled: !!person.notes, weight: 5 },
    { label: 'Join Date', filled: !!person.joinDate, weight: 5 },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const filledWeight = fields.filter(f => f.filled).reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round((filledWeight / totalWeight) * 100);

  return { score, fields };
}

export function ProfileCompleteness({ person, showDetails = false }: ProfileCompletenessProps) {
  const { score, fields } = getProfileCompleteness(person);

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getBarColor = () => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const missingFields = fields.filter(f => !f.filled);

  return (
    <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-dark-100">Profile Completeness</h3>
        <span className={`text-lg font-bold ${getScoreColor()}`}>{score}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Status message */}
      <p className="text-sm text-gray-500 dark:text-dark-400 mb-3">
        {score >= 80 ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle size={14} /> Profile is well completed
          </span>
        ) : score >= 50 ? (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertCircle size={14} /> Profile needs some attention
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <AlertCircle size={14} /> Profile incomplete - please add more info
          </span>
        )}
      </p>

      {/* Missing fields */}
      {showDetails && missingFields.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-dark-700">
          <p className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase mb-2">
            Missing Information
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <span
                key={field.label}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400 rounded"
              >
                {field.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact badge version for lists
export function ProfileCompletenessBadge({ person }: { person: Person }) {
  const { score, fields } = getProfileCompleteness(person);
  const missingFields = fields.filter(f => !f.filled);

  const getBadgeColor = () => {
    if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
    if (score >= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
  };

  const tooltip = missingFields.length > 0
    ? `Missing: ${missingFields.map(f => f.label).join(', ')}`
    : 'Profile complete';

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBadgeColor()}`}
      title={tooltip}
    >
      {score}%
    </span>
  );
}

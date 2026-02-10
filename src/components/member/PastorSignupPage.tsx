import { useState } from 'react';
import { Heart, CheckCircle } from 'lucide-react';
import { LeaderRegistrationForm } from '../pastoral/LeaderRegistrationForm';
import type { LeaderFormData } from '../pastoral/LeaderRegistrationForm';

interface PastorSignupPageProps {
  churchName?: string;
  onSubmit?: (data: LeaderFormData) => void;
  onBack?: () => void;
}

export function PastorSignupPage({ churchName = 'Grace Church', onSubmit, onBack }: PastorSignupPageProps) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Application Submitted
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Thank you for signing up to serve in pastoral care at {churchName}. Our team will review your profile and get back to you soon.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={20} className="text-violet-200" />
            <span className="text-violet-200 text-sm font-medium">Pastoral Care Ministry</span>
          </div>
          <h1 className="text-xl font-bold mb-1">Become a Pastoral Leader</h1>
          <p className="text-violet-100 text-sm">
            Join {churchName}'s pastoral care team and help serve our community through counseling, prayer, and spiritual guidance.
          </p>
        </div>
      </div>

      {/* Form */}
      <LeaderRegistrationForm
        onSubmit={(data) => {
          onSubmit?.(data);
          setSubmitted(true);
        }}
        onBack={onBack || (() => {})}
      />
    </div>
  );
}

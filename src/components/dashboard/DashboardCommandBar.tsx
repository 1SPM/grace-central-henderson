import { Sparkles, UserPlus, ListTodo, Mail, Church, BookOpen } from 'lucide-react';

interface DashboardCommandBarProps {
  greeting: string;
  addressee: string;
  churchName: string;
  heroSubline: string;
  mailBacklog: number;
  mailFlagged: number;
  onAskGrace: () => void;
  onAddPerson?: () => void;
  onWorkQueue: () => void;
  onMail?: () => void;
  onSundayPrep?: () => void;
  onOpenTutorials?: () => void;
}

export function DashboardCommandBar({
  greeting,
  addressee,
  churchName,
  heroSubline,
  mailBacklog,
  mailFlagged,
  onAskGrace,
  onAddPerson,
  onWorkQueue,
  onMail,
  onSundayPrep,
  onOpenTutorials,
}: DashboardCommandBarProps) {
  return (
    <div className="mb-6 px-5 sm:px-6 py-5 rounded-2xl bg-gradient-to-br from-white via-stone-50 to-amber-50/50 dark:from-dark-800 dark:via-dark-800 dark:to-amber-950/20 border border-stone-200 dark:border-dark-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={13} className="text-amber-500" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-gray-500 dark:text-dark-400 font-medium">
              {greeting}
            </span>
          </div>
          <h1 className="serif text-2xl text-slate-900 dark:text-dark-100 leading-tight truncate">
            {addressee}
          </h1>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
            {churchName}
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">{heroSubline}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onAskGrace}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-950 text-white rounded-lg transition-colors"
          >
            <Sparkles size={14} className="text-amber-300" />
            Ask Grace
          </button>
          {onAddPerson && (
            <button
              type="button"
              onClick={onAddPerson}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-dark-700 hover:bg-stone-100 dark:hover:bg-dark-600 text-slate-800 dark:text-dark-100 border border-stone-300 dark:border-dark-600 rounded-lg transition-colors"
            >
              <UserPlus size={14} />
              Add person
            </button>
          )}
          <button
            type="button"
            onClick={onWorkQueue}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-dark-700 hover:bg-stone-100 dark:hover:bg-dark-600 text-slate-800 dark:text-dark-100 border border-stone-300 dark:border-dark-600 rounded-lg transition-colors"
          >
            <ListTodo size={14} />
            Work Queue
          </button>
          {onMail && (
            <button
              type="button"
              onClick={onMail}
              className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-dark-700 hover:bg-stone-100 dark:hover:bg-dark-600 text-slate-800 dark:text-dark-100 border border-stone-300 dark:border-dark-600 rounded-lg transition-colors"
            >
              <Mail size={14} />
              Mail
              {mailBacklog > 0 && (
                <span
                  className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full ${
                    mailFlagged > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                  }`}
                >
                  {mailBacklog}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-200 dark:border-dark-700">
        {onSundayPrep && (
          <button
            type="button"
            data-tutorial="dashboard-sunday-prep"
            onClick={onSundayPrep}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-dark-300 hover:bg-stone-200/60 dark:hover:bg-dark-700 transition-all"
          >
            <Church size={14} />
            Sunday Service Tools
          </button>
        )}
        {onOpenTutorials && (
          <button
            type="button"
            onClick={onOpenTutorials}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-dark-300 hover:bg-stone-200/60 dark:hover:bg-dark-700 transition-all ml-auto"
          >
            <BookOpen size={14} />
            Take a Tour
          </button>
        )}
      </div>
    </div>
  );
}

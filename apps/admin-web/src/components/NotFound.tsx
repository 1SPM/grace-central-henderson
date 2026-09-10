import { Home } from 'lucide-react';

interface NotFoundProps {
  onGoHome: () => void;
}

export function NotFound({ onGoHome }: NotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center" role="alert">
      <div className="w-20 h-20 bg-gray-100 dark:bg-dark-700 rounded-2xl flex items-center justify-center mb-6">
        <span className="text-4xl font-bold text-gray-300 dark:text-dark-500">404</span>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">Page Not Found</h2>
      <p className="text-gray-500 dark:text-dark-400 max-w-sm mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <button
        onClick={onGoHome}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        <Home size={16} />
        Go to Dashboard
      </button>
    </div>
  );
}

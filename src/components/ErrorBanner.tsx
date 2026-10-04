import React from 'react';
import { ErrorAlert } from '../types';
import { AlertCircle, X, Terminal, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  error: ErrorAlert | null;
  onDismiss: () => void;
  onOpenDebug: () => void;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onDismiss,
  onOpenDebug,
  onRetry,
}) => {
  if (!error) return null;

  return (
    <div className="bg-rose-50 border-l-4 border-rose-500 p-4 mb-4 rounded-r-md shadow-xs animate-in fade-in duration-150">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-rose-800">
              Notice: Admission Assistance Issue
            </h3>
            <p className="text-sm text-rose-700 mt-1">
              {error.userMessage}
            </p>
            {error.debugCode && (
              <p className="text-xs font-mono text-rose-600/80 mt-1">
                Ref Code: {error.debugCode}
              </p>
            )}
            <div className="mt-3 flex items-center space-x-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center text-xs font-medium text-rose-800 bg-rose-100 hover:bg-rose-200 px-2.5 py-1.5 rounded transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Try Again
                </button>
              )}
              <button
                onClick={onOpenDebug}
                className="inline-flex items-center text-xs font-medium text-rose-700 hover:text-rose-900 underline"
              >
                <Terminal className="w-3.5 h-3.5 mr-1" />
                View Full Debug Log
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-rose-400 hover:text-rose-600 p-1"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

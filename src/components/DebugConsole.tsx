import React, { useState, useEffect } from 'react';
import { LogItem, SystemHealth } from '../types';
import { appLogger } from '../utils/logger';
import {
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Server,
} from 'lucide-react';

interface DebugConsoleProps {
  systemHealth: SystemHealth | null;
  onRefreshHealth: () => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({
  systemHealth,
  onRefreshHealth,
}) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = appLogger.subscribe((updated) => {
      setLogs(updated);
    });
    // Initial fetch from server
    handleRefresh();
    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await appLogger.fetchServerLogs();
    onRefreshHealth();
    setIsRefreshing(false);
  };

  const handleClear = () => {
    appLogger.clearLogs();
  };

  const handleCopyLogs = () => {
    const logText = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    return true;
  });

  const getLevelBadge = (level: LogItem['level']) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            WARN
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            <Info className="w-3 h-3 mr-1" />
            INFO
          </span>
        );
      case 'debug':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
            <Bug className="w-3 h-3 mr-1" />
            DEBUG
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Diagnostics / System Health Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              ITI AI Assistant System Diagnostics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live runtime health, model aliases, and environment status.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Diagnostics
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium block">API Key Status</span>
            <span
              className={`font-semibold flex items-center mt-1 ${
                systemHealth?.apiKeyConfigured ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {systemHealth?.apiKeyConfigured ? (
                <>
                  <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                  Configured & Injected
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-1 text-amber-600" />
                  Missing GEMINI_API_KEY
                </>
              )}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium block">Chat Model</span>
            <span className="font-mono font-semibold text-slate-900 mt-1 block">
              {systemHealth?.models.chat || 'gemini-3.8-flash'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium block">Voice & TTS Model</span>
            <span className="font-mono font-semibold text-slate-900 mt-1 block">
              {systemHealth?.models.tts || 'gemini-3.8-flash-lite-tts'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium block">Live Audio Model</span>
            <span className="font-mono font-semibold text-slate-900 mt-1 block">
              {systemHealth?.models.live || 'gemini-3.8-live'}
            </span>
          </div>
        </div>
      </div>

      {/* Unified Log Console */}
      <div className="bg-slate-900 text-slate-100 rounded-lg border border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Console Toolbar */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-bold text-slate-200">
              DEBUG CONSOLE ({filteredLogs.length} events)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700 focus:outline-hidden"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors Only</option>
              <option value="warn">Warnings & Errors</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700 focus:outline-hidden"
            >
              <option value="all">All Modalities</option>
              <option value="speech">Speech to Speech</option>
              <option value="text">Text to Text</option>
              <option value="tts">TTS</option>
              <option value="live">Live WebSocket</option>
              <option value="system">System / General</option>
            </select>

            <button
              onClick={handleCopyLogs}
              className="inline-flex items-center px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
              title="Copy JSON to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handleClear}
              className="inline-flex items-center px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 transition-colors"
              title="Clear all console logs"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear
            </button>
          </div>
        </div>

        {/* Log Viewer Window */}
        <div className="p-4 max-h-[500px] overflow-y-auto space-y-2 font-mono text-xs scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No logs match the current filter criteria.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasDetails = log.details !== undefined && log.details !== null;

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded border transition-colors ${
                    log.level === 'error'
                      ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                      : log.level === 'warn'
                      ? 'bg-amber-950/30 border-amber-900/50 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          // @ts-ignore
                          fractionalSecondDigits: 3,
                        })}
                      </span>
                      {getLevelBadge(log.level)}
                      <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                        {log.source}
                      </span>
                      <span className="text-[10px] text-blue-400 uppercase font-semibold">
                        [{log.category}]
                      </span>
                    </div>

                    {hasDetails && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-slate-400 hover:text-white p-0.5"
                        title="Toggle JSON details"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="mt-1 text-slate-200 font-sans text-xs">
                    {log.message}
                  </div>

                  {/* Expandable Details Payload */}
                  {isExpanded && hasDetails && (
                    <div className="mt-2 p-2 bg-black/60 rounded border border-slate-800 text-[11px] overflow-x-auto text-emerald-400">
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

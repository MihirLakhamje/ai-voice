import React from 'react';
import { ModalityMode, SystemHealth } from '../types';
import { Mic, MessageSquare, Volume2, History, Terminal, Phone, CheckCircle2, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  activeTab: ModalityMode;
  setActiveTab: (tab: ModalityMode) => void;
  systemHealth: SystemHealth | null;
  errorCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  systemHealth,
  errorCount,
}) => {
  const tabs: { id: ModalityMode; label: string; icon: React.ReactNode }[] = [
    { id: 'speech-to-speech', label: 'Speech to Speech', icon: <Mic className="w-4 h-4" /> },
    { id: 'text-to-text', label: 'Text to Text', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'text-to-speech', label: 'Text to Speech', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'history', label: 'Counseling History', icon: <History className="w-4 h-4" /> },
    { id: 'debug', label: 'Error & Debug Logs', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          {/* Logo & Portal Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              ITI
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Aarav <span className="text-slate-500 font-normal text-sm">| ITI Admission Counselor</span>
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
                  Online
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official Voice & Text Portal for NCVT / SCVT Vocational Admissions
              </p>
            </div>
          </div>

          {/* Quick info / Helpdesk Helpline */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden sm:flex items-center text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
              <Phone className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              <span>Admissions Helpline: <strong className="text-slate-900 font-mono">1800-120-4848</strong></span>
            </div>

            {/* API Key state */}
            {systemHealth && (
              <div className="flex items-center">
                {systemHealth.apiKeyConfigured ? (
                  <span className="flex items-center text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200" title="Gemini API is ready">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    AI Connected
                  </span>
                ) : (
                  <span className="flex items-center text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200" title="API key not detected">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                    Key Required
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto space-x-1 border-t border-slate-100 pt-1 -mb-px scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2.5 px-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'debug' && errorCount > 0 && (
                  <span className="ml-1.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {errorCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

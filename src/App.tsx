import React, { useState, useEffect } from 'react';
import { ModalityMode, ChatMessage, TtsRecord, SystemHealth, ErrorAlert } from './types';
import { Header } from './components/Header';
import { ErrorBanner } from './components/ErrorBanner';
import { LiveVoiceSession } from './components/LiveVoiceSession';
import { TextChat } from './components/TextChat';
import { TtsStudio } from './components/TtsStudio';
import { HistoryViewer } from './components/HistoryViewer';
import { DebugConsole } from './components/DebugConsole';
import { appLogger } from './utils/logger';

export default function App() {
  const [activeTab, setActiveTab] = useState<ModalityMode>('speech-to-speech');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [activeError, setActiveError] = useState<ErrorAlert | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);

  // Interaction logs / history with initial welcoming message
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('iti_chat_messages');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
      {
        id: 'welcome-counselor',
        role: 'assistant',
        text: 'Hello, I am Aarav, your official ITI Admission Counselor. How can I assist you today with trade choices, eligibility criteria, or registration?',
        timestamp: new Date().toISOString(),
        source: 'text',
      },
    ];
  });

  const [ttsRecords, setTtsRecords] = useState<TtsRecord[]>(() => {
    try {
      const saved = localStorage.getItem('iti_tts_records');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('iti_chat_messages', JSON.stringify(chatMessages.slice(-50)));
    } catch (_) {}
  }, [chatMessages]);

  useEffect(() => {
    try {
      localStorage.setItem('iti_tts_records', JSON.stringify(ttsRecords.slice(-50)));
    } catch (_) {}
  }, [ttsRecords]);

  // Subscribe to error count in logger
  useEffect(() => {
    const unsub = appLogger.subscribe((logs) => {
      const errors = logs.filter((l) => l.level === 'error');
      setErrorCount(errors.length);
    });
    fetchHealth();
    return () => unsub();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (err: any) {
      appLogger.addLog('warn', 'system', 'client', `Health check failed: ${err?.message}`);
    }
  };

  const handleError = (error: ErrorAlert) => {
    setActiveError(error);
  };

  const handleAddMessage = (msg: ChatMessage) => {
    setChatMessages((prev) => [...prev, msg]);
  };

  const handleAddTtsRecord = (rec: TtsRecord) => {
    setTtsRecords((prev) => [rec, ...prev]);
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'Session reset. I am Aarav. What would you like to explore regarding ITI admissions?',
        timestamp: new Date().toISOString(),
        source: 'text',
      },
    ]);
  };

  const handleClearAllHistory = () => {
    setChatMessages([]);
    setTtsRecords([]);
    try {
      localStorage.removeItem('iti_chat_messages');
      localStorage.removeItem('iti_tts_records');
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
        errorCount={errorCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* User-friendly Error Alert Banner */}
        <ErrorBanner
          error={activeError}
          onDismiss={() => setActiveError(null)}
          onOpenDebug={() => {
            setActiveError(null);
            setActiveTab('debug');
          }}
          onRetry={fetchHealth}
        />

        {/* Tab 1: Speech to Speech */}
        {activeTab === 'speech-to-speech' && (
          <LiveVoiceSession
            onAddHistory={handleAddMessage}
            onError={handleError}
            selectedTrade={selectedTrade}
            setSelectedTrade={setSelectedTrade}
          />
        )}

        {/* Tab 2: Text to Text */}
        {activeTab === 'text-to-text' && (
          <TextChat
            messages={chatMessages}
            onAddMessage={handleAddMessage}
            onClearChat={handleClearChat}
            onError={handleError}
            selectedTrade={selectedTrade}
            setSelectedTrade={setSelectedTrade}
          />
        )}

        {/* Tab 3: Text to Speech */}
        {activeTab === 'text-to-speech' && (
          <TtsStudio
            onAddTtsRecord={handleAddTtsRecord}
            onError={handleError}
          />
        )}

        {/* Tab 4: History Logs */}
        {activeTab === 'history' && (
          <HistoryViewer
            chatMessages={chatMessages}
            ttsRecords={ttsRecords}
            onClearHistory={handleClearAllHistory}
          />
        )}

        {/* Tab 5: Debug Console & Error Logger */}
        {activeTab === 'debug' && (
          <DebugConsole
            systemHealth={systemHealth}
            onRefreshHealth={fetchHealth}
          />
        )}
      </main>

      {/* Institutional Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span>© {new Date().getFullYear()} Directorate General of Training (DGT) ITI Admissions.</span>
            <span>•</span>
            <span>Aarav Admission AI Assistant</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>NCVT / SCVT Approved Trades</span>
            <span>Helpline: 1800-120-4848</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

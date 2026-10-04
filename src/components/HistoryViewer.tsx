import React, { useState, useRef } from 'react';
import { ChatMessage, TtsRecord } from '../types';
import { playWavBase64 } from '../utils/audio';
import {
  History,
  Download,
  Trash2,
  Search,
  Volume2,
  Pause,
  MessageSquare,
  Mic,
  FileAudio,
  Calendar,
  Filter,
} from 'lucide-react';

interface HistoryViewerProps {
  chatMessages: ChatMessage[];
  ttsRecords: TtsRecord[];
  onClearHistory: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({
  chatMessages,
  ttsRecords,
  onClearHistory,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'speech' | 'text' | 'tts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Combine entries
  type CombinedItem = {
    id: string;
    type: 'speech' | 'text' | 'tts';
    role?: 'user' | 'assistant';
    text: string;
    timestamp: string;
    audioBase64?: string;
    voice?: string;
    trade?: string;
    durationMs?: number;
  };

  const combinedItems: CombinedItem[] = [
    ...chatMessages.map((m) => ({
      id: m.id,
      type: (m.source === 'live' || m.source === 'speech' ? 'speech' : 'text') as 'speech' | 'text',
      role: m.role,
      text: m.text,
      timestamp: m.timestamp,
      audioBase64: m.audioBase64,
      trade: m.trade,
      durationMs: m.durationMs,
    })),
    ...ttsRecords.map((t) => ({
      id: t.id,
      type: 'tts' as const,
      text: t.text,
      timestamp: t.timestamp,
      audioBase64: t.audioBase64,
      voice: t.voice,
      durationMs: t.durationMs,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredItems = combinedItems.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.text.toLowerCase().includes(q) || (item.trade && item.trade.toLowerCase().includes(q));
    }
    return true;
  });

  const handlePlayAudio = (id: string, base64: string) => {
    if (playingAudioId === id && activeAudioRef.current) {
      activeAudioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    setPlayingAudioId(id);
    const audio = playWavBase64(base64, () => setPlayingAudioId(null));
    activeAudioRef.current = audio;
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(combinedItems, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iti-counseling-history-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    let textOutput = 'ITI ADMISSIONS COUNSELOR (AARAV) - SESSION HISTORY\n';
    textOutput += `Exported at: ${new Date().toLocaleString()}\n`;
    textOutput += '===================================================\n\n';

    combinedItems.forEach((item, idx) => {
      textOutput += `[${idx + 1}] [${item.type.toUpperCase()}] ${new Date(item.timestamp).toLocaleString()}\n`;
      if (item.role) textOutput += `Speaker: ${item.role === 'user' ? 'Student' : 'Aarav (Counselor)'}\n`;
      if (item.trade) textOutput += `Trade: ${item.trade}\n`;
      textOutput += `Content:\n${item.text}\n`;
      textOutput += '---------------------------------------------------\n\n';
    });

    const blob = new Blob([textOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iti-counseling-transcript-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Counseling Interaction History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail of voice calls, text chats, and synthesized speech responses.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {combinedItems.length > 0 && (
            <>
              <button
                onClick={handleExportJson}
                className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
                title="Export as JSON"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                JSON
              </button>
              <button
                onClick={handleExportText}
                className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
                title="Export as Text transcript"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Transcript TXT
              </button>
              <button
                onClick={onClearHistory}
                className="inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded transition-colors"
                title="Clear all interaction history"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inquiries, keywords (e.g. Electrician, fee, 10th)..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Modality Filter Pills */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
          {(['all', 'speech', 'text', 'tts'] as const).map((type) => {
            const active = filterType === type;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === 'all' ? 'All Records' : type === 'tts' ? 'TTS Studio' : type}
              </button>
            );
          })}
        </div>
      </div>

      {/* List of Entries */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No counseling interactions found.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPlaying = playingAudioId === item.id;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center space-x-2">
                    {/* Badge for Type */}
                    {item.type === 'speech' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Mic className="w-3 h-3 mr-1" />
                        Voice
                      </span>
                    )}
                    {item.type === 'text' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Text Chat
                      </span>
                    )}
                    {item.type === 'tts' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        <FileAudio className="w-3 h-3 mr-1" />
                        TTS Studio ({item.voice})
                      </span>
                    )}

                    {/* Role indicator */}
                    {item.role && (
                      <span className="font-semibold text-slate-700">
                        {item.role === 'user' ? 'Student' : 'Aarav (Counselor)'}
                      </span>
                    )}

                    {item.trade && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        Trade: {item.trade}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    {item.durationMs && <span>{item.durationMs}ms</span>}
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {item.text}
                </div>

                {/* Audio playback row if audio exists */}
                {item.audioBase64 && (
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={() => handlePlayAudio(item.id, item.audioBase64!)}
                      className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3 h-3 mr-1.5" />
                          Pause Audio
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3 mr-1.5" />
                          Play Recording
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

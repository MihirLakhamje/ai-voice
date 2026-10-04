import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ErrorAlert, ITI_TRADES } from '../types';
import { appLogger } from '../utils/logger';
import { playWavBase64 } from '../utils/audio';
import {
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  Loader2,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface TextChatProps {
  messages: ChatMessage[];
  onAddMessage: (msg: ChatMessage) => void;
  onClearChat: () => void;
  onError: (err: ErrorAlert) => void;
  selectedTrade: string;
  setSelectedTrade: (trade: string) => void;
}

export const TextChat: React.FC<TextChatProps> = ({
  messages,
  onAddMessage,
  onClearChat,
  onError,
  selectedTrade,
  setSelectedTrade,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [synthesizingId, setSynthesizingId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputText;
    if (!message.trim() || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text: message.trim(),
      timestamp: new Date().toISOString(),
      source: 'text',
      trade: selectedTrade !== 'all' ? selectedTrade : undefined,
    };

    onAddMessage(userMsg);
    setInputText('');
    setIsLoading(true);

    try {
      appLogger.addLog('info', 'text', 'client', `Sending text query: "${message.substring(0, 50)}..."`);

      // Prepare conversation history (last 10 turns)
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          history,
          tradeInterest: selectedTrade !== 'all' ? selectedTrade : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error processing your question.');
      }

      const assistantMsg: ChatMessage = {
        id: `counselor-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
        source: 'text',
        durationMs: data.durationMs,
        trade: selectedTrade !== 'all' ? selectedTrade : undefined,
      };

      onAddMessage(assistantMsg);
      appLogger.addLog('info', 'text', 'client', `Received response in ${data.durationMs}ms`);
    } catch (err: any) {
      appLogger.addLog('error', 'text', 'client', `Chat request failed: ${err.message}`, err);
      onError({
        id: String(Date.now()),
        userMessage: err.message || 'Could not contact the admission counselor. Please try again.',
        debugCode: 'CHAT_REQUEST_ERROR',
        details: err,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayVoice = async (msg: ChatMessage) => {
    // If audio already playing, pause it
    if (playingAudioId === msg.id && activeAudioRef.current) {
      activeAudioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    // If audioBase64 exists, play directly
    if (msg.audioBase64) {
      if (activeAudioRef.current) activeAudioRef.current.pause();
      setPlayingAudioId(msg.id);
      const audio = playWavBase64(msg.audioBase64, () => setPlayingAudioId(null));
      activeAudioRef.current = audio;
      return;
    }

    // Synthesize via TTS
    try {
      setSynthesizingId(msg.id);
      appLogger.addLog('info', 'tts', 'client', `Synthesizing audio for message ${msg.id}...`);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.text,
          voiceName: 'Zephyr',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to synthesize speech.');

      msg.audioBase64 = data.audioBase64;
      if (activeAudioRef.current) activeAudioRef.current.pause();
      setPlayingAudioId(msg.id);
      const audio = playWavBase64(data.audioBase64, () => setPlayingAudioId(null));
      activeAudioRef.current = audio;
    } catch (err: any) {
      appLogger.addLog('error', 'tts', 'client', `Speech synthesis error: ${err.message}`, err);
      onError({
        id: String(Date.now()),
        userMessage: 'Unable to play voice response.',
        debugCode: 'TTS_PLAY_ERROR',
        details: err,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSynthesizingId(null);
    }
  };

  const quickChips = [
    'Can I get admission with 50% in 10th standard?',
    'Is ITI as valuable as a regular diploma or degree?',
    'What documents are needed for verification?',
    'What are the fees for Government ITIs?',
    'I am confused between Electrician and COPA trade.',
    'Is 8th pass eligible for Welder or Wireman?',
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col h-[680px]">
      {/* Top Bar with Context Selector */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
            AR
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Aarav — ITI Admission Helpdesk
            </h2>
            <p className="text-xs text-slate-500">
              Direct text counselor with objection resolution & eligibility guidance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            {ITI_TRADES.map((t) => (
              <option key={t.id} value={t.id}>
                Focus: {t.name}
              </option>
            ))}
          </select>

          {messages.length > 0 && (
            <button
              onClick={onClearChat}
              className="text-xs text-slate-500 hover:text-slate-800 p-1.5 rounded hover:bg-slate-200 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Welcome to the ITI Admissions Portal!
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              I am Aarav, your official admission counselor. Ask any questions about eligibility, trade selection, online registration, or certificates.
            </p>

            {/* Quick Prompts */}
            <div className="mt-6 w-full max-w-lg">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Frequently Asked Inquiries:
              </span>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip)}
                    className="text-xs text-left bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-3 py-1.5 rounded-full border border-slate-200 hover:border-blue-200 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isCounselor = msg.role === 'assistant';
            const isPlaying = playingAudioId === msg.id;
            const isSynth = synthesizingId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isCounselor ? 'justify-start' : 'justify-end'}`}
              >
                {isCounselor && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                    AR
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${
                    isCounselor
                      ? 'bg-slate-100 text-slate-900 border border-slate-200'
                      : 'bg-blue-600 text-white shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Footer with Voice Action & Timestamp */}
                  <div
                    className={`mt-2 pt-1.5 flex items-center justify-between text-[10px] border-t ${
                      isCounselor ? 'border-slate-200 text-slate-500' : 'border-blue-500/50 text-blue-100'
                    }`}
                  >
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.durationMs && ` (${msg.durationMs}ms)`}
                    </span>

                    {isCounselor && (
                      <button
                        onClick={() => handlePlayVoice(msg)}
                        disabled={isSynth}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium ml-3 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                        title="Listen to spoken response"
                      >
                        {isSynth ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Synthesizing...
                          </>
                        ) : isPlaying ? (
                          <>
                            <VolumeX className="w-3 h-3 mr-1" />
                            Stop Voice
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 mr-1" />
                            Listen (TTS)
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {!isCounselor && (
                  <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Aarav is reviewing ITI counseling guidelines...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Quick Inquiry Chips */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 overflow-x-auto flex space-x-2 scrollbar-none">
          {quickChips.slice(0, 3).map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip)}
              className="text-[11px] whitespace-nowrap bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 px-2.5 py-1 rounded border border-slate-200 transition-colors shrink-0"
            >
              + {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-slate-200 bg-white rounded-b-lg flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Aarav about ITI admission, trade choice, documents, fees..."
          disabled={isLoading}
          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-md py-2.5 px-3 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="inline-flex items-center px-4 py-2.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline ml-1.5">Send</span>
        </button>
      </form>
    </div>
  );
};

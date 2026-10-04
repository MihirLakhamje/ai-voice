import React, { useState, useRef } from 'react';
import { ErrorAlert, TTS_VOICES, TtsRecord } from '../types';
import { appLogger } from '../utils/logger';
import { playWavBase64 } from '../utils/audio';
import {
  Volume2,
  Play,
  Pause,
  Download,
  Loader2,
  Sparkles,
  FileText,
  Clock,
  Radio,
} from 'lucide-react';

interface TtsStudioProps {
  onAddTtsRecord: (record: TtsRecord) => void;
  onError: (err: ErrorAlert) => void;
}

export const TtsStudio: React.FC<TtsStudioProps> = ({ onAddTtsRecord, onError }) => {
  const [inputText, setInputText] = useState(
    'I completely understand your concern. While degrees focus on theory, an ITI qualification gives you hands-on practical skills that industries hire for immediately. Would you like to know which trades have the highest job placement right now?'
  );
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<{
    base64: string;
    mimeType: string;
    durationMs: number;
    text: string;
    voice: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const presetScripts = [
    {
      title: 'Objection: Value of ITI vs Degree',
      text: 'I completely understand your concern. While degrees focus on theory, an ITI qualification gives you hands-on practical skills that industries hire for immediately. Would you like to know which trades have the highest job placement right now?',
    },
    {
      title: 'Objection: Low 10th Marks',
      text: 'Absolutely. ITI admissions consider merit across a wide range of trades, and several high-demand trades are open based on standard passing marks. What subjects or practical work do you enjoy most?',
    },
    {
      title: 'Objection: Cost & Private Fees',
      text: 'That is a very valid concern. Government ITIs offer subsidized fees, and there are multiple state and central government scholarship schemes available for eligible students. Would you like me to share details on the fee structure?',
    },
    {
      title: 'Portal Helpline Escalation',
      text: 'For this specific account payment issue, let me direct you to our admissions helpdesk executive at 1800-120-4848. Would you like me to note your registration number?',
    },
  ];

  const handleSynthesize = async () => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    appLogger.addLog('info', 'tts', 'client', `Synthesizing custom speech: "${inputText.substring(0, 40)}..."`);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          voiceName: selectedVoice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Speech synthesis failed on server.');
      }

      setCurrentAudio({
        base64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        durationMs: data.durationMs,
        text: inputText.trim(),
        voice: selectedVoice,
      });

      onAddTtsRecord({
        id: `tts-${Date.now()}`,
        text: inputText.trim(),
        voice: selectedVoice,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        durationMs: data.durationMs,
        timestamp: new Date().toISOString(),
      });

      // Automatically play the generated speech
      handlePlay(data.audioBase64);
    } catch (err: any) {
      appLogger.addLog('error', 'tts', 'client', `TTS generation failed: ${err.message}`, err);
      onError({
        id: String(Date.now()),
        userMessage: err.message || 'Failed to synthesize speech.',
        debugCode: 'TTS_SYNTH_FAILED',
        details: err,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (base64Audio: string) => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setIsPlaying(true);
    const audio = playWavBase64(base64Audio, () => {
      setIsPlaying(false);
    });
    audioElementRef.current = audio;
  };

  const handleStop = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleDownload = () => {
    if (!currentAudio) return;
    const link = document.createElement('a');
    link.href = `data:audio/wav;base64,${currentAudio.base64}`;
    link.download = `aarav-tts-${selectedVoice.toLowerCase()}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Configuration & Input */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-600" />
              Text to Speech Voice Synthesizer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transform counseling text into high-fidelity voice using Gemini 3.8 Flash Lite TTS.
            </p>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="pt-4">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Select Voice Persona:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {TTS_VOICES.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              return (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{voice.name}</span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {voice.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Input Area */}
        <div className="pt-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Counseling Text / Announcement:
            </label>
            <span className="text-[11px] text-slate-400">
              {inputText.length} characters (recommending under 200 for voice)
            </span>
          </div>
          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste admission announcement or response here..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSynthesize}
                disabled={isLoading || !inputText.trim()}
                className="inline-flex items-center px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating Audio...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                    Generate & Play Speech
                  </>
                )}
              </button>

              {currentAudio && (
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download WAV
                </button>
              )}
            </div>

            {currentAudio && (
              <span className="text-[11px] font-mono text-slate-500">
                Generated in {currentAudio.durationMs}ms ({currentAudio.voice})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preset Admission Scripts */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center">
          <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
          Test with Aarav's Standard Admission Counsel Scripts:
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presetScripts.map((script, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-800">{script.title}</span>
                <button
                  onClick={() => setInputText(script.text)}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  Load Script
                </button>
              </div>
              <p className="text-xs text-slate-600 italic line-clamp-3">"{script.text}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ErrorAlert, ITI_TRADES, TTS_VOICES } from '../types';
import { float32ToInt16PCM, arrayBufferToBase64, LiveAudioPlayer, playWavBase64, blobToBase64 } from '../utils/audio';
import { appLogger } from '../utils/logger';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  AlertCircle,
  HelpCircle,
  Radio,
  Sparkles,
  Info
} from 'lucide-react';

interface LiveVoiceSessionProps {
  onAddHistory: (message: ChatMessage) => void;
  onError: (err: ErrorAlert) => void;
  selectedTrade: string;
  setSelectedTrade: (trade: string) => void;
}

export const LiveVoiceSession: React.FC<LiveVoiceSessionProps> = ({
  onAddHistory,
  onError,
  selectedTrade,
  setSelectedTrade,
}) => {
  // Mode: 'live' (Real-time duplex WebSocket) vs 'push-to-talk' (Recorded snippets)
  const [voiceMode, setVoiceMode] = useState<'live' | 'push-to-talk'>('live');

  // Live WebSocket state
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [liveStatus, setLiveStatus] = useState<string>('Idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [liveOutputText, setLiveOutputText] = useState<string>('');
  const [liveInputText, setLiveInputText] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Push-to-Talk state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingPtt, setIsProcessingPtt] = useState<boolean>(false);
  const [pttLastResult, setPttLastResult] = useState<{
    transcript: string;
    reply: string;
    audioBase64?: string;
  } | null>(null);
  const [isPlayingPttAudio, setIsPlayingPttAudio] = useState<boolean>(false);

  // Settings
  const [selectedVoice, setSelectedVoice] = useState<string>('Zephyr');

  // Refs for Live session
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const liveAudioPlayerRef = useRef<LiveAudioPlayer | null>(null);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Refs for Push-to-Talk
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Setup player on mount
  useEffect(() => {
    liveAudioPlayerRef.current = new LiveAudioPlayer();
    return () => {
      stopLiveSession();
      liveAudioPlayerRef.current?.close();
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
    };
  }, []);

  console.log('Secure:', window.isSecureContext);
  console.log('MediaDevices:', navigator.mediaDevices);
  console.log('getUserMedia:', navigator.mediaDevices?.getUserMedia);
  // --- Real-Time Live WebSocket Methods ---
  const startLiveSession = async () => {
    try {
      appLogger.addLog('info', 'live', 'client', 'Requesting microphone access for Live counseling...');
      setLiveStatus('Requesting mic access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = stream;

      // Audio context for 16kHz mic recording
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtxClass({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      // Analyze input volume
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Volume poll
      const volumeInterval = window.setInterval(() => {
        if (!isLiveActive && !mediaStreamRef.current) {
          clearInterval(volumeInterval);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
      }, 100);

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      appLogger.addLog('info', 'live', 'client', `Connecting to Live WebSocket: ${wsUrl}`);
      setLiveStatus('Connecting to counselor server...');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        appLogger.addLog('info', 'live', 'websocket', 'WebSocket connected. Initializing audio pipeline...');
        setLiveStatus('Connecting to Aarav...');
        setIsLiveActive(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status') {
            setLiveStatus(msg.message || msg.status);
            appLogger.addLog('info', 'live', 'gemini', `Live status: ${msg.message}`);
          } else if (msg.type === 'audio' && msg.audio) {
            setLiveStatus('Aarav is speaking...');
            liveAudioPlayerRef.current?.queuePcmChunk(msg.audio);
          } else if (msg.type === 'output_transcript') {
            setLiveOutputText((prev) => {
              const updated = prev ? `${prev} ${msg.text}` : msg.text;
              return updated;
            });
          } else if (msg.type === 'interrupted') {
            appLogger.addLog('debug', 'live', 'gemini', 'User interrupted counselor. Stopping audio playback.');
            liveAudioPlayerRef.current?.stop();
            setLiveStatus('Listening to you...');
          } else if (msg.type === 'turn_complete') {
            setLiveStatus('Aarav is listening...');
          } else if (msg.type === 'error') {
            const errorMsg = msg.message || 'Error communicating with Live API session.';
            appLogger.addLog('error', 'live', 'websocket', errorMsg, msg.details);
            onError({
              id: String(Date.now()),
              userMessage: errorMsg,
              debugCode: msg.code || 'LIVE_WS_ERROR',
              details: msg.details,
              timestamp: new Date().toISOString(),
            });
            stopLiveSession();
          }
        } catch (err: any) {
          appLogger.addLog('warn', 'live', 'client', `Failed to parse message: ${err?.message}`);
        }
      };

      ws.onerror = (evt) => {
        appLogger.addLog('error', 'live', 'websocket', 'WebSocket connection failed', evt);
        onError({
          id: String(Date.now()),
          userMessage: 'Could not connect to Live Audio Counselor. You can also use the Push-to-Talk mode.',
          debugCode: 'WS_CONNECTION_ERROR',
          timestamp: new Date().toISOString(),
        });
        stopLiveSession();
      };

      ws.onclose = () => {
        appLogger.addLog('info', 'live', 'websocket', 'Live WebSocket closed');
        stopLiveSession();
      };

      // Script processor to read raw PCM audio
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isMuted) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBuffer = float32ToInt16PCM(inputData);
          const base64Audio = arrayBufferToBase64(pcmBuffer);
          ws.send(
            JSON.stringify({
              type: 'audio',
              data: base64Audio,
            })
          );
        }
      };
    } catch (err: any) {
      appLogger.addLog('error', 'live', 'client', `Microphone permission or audio error: ${err?.message}`, err);
      onError({
        id: String(Date.now()),
        userMessage: 'Microphone permission was denied or unavailable. Please grant microphone access to talk to Aarav.',
        debugCode: 'MIC_PERMISSION_DENIED',
        details: err?.message,
        timestamp: new Date().toISOString(),
      });
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    setIsLiveActive(false);
    setLiveStatus('Disconnected');
    setAudioLevel(0);

    // Save final transcript to history if present
    if (liveOutputText) {
      onAddHistory({
        id: `live-${Date.now()}`,
        role: 'assistant',
        text: liveOutputText,
        timestamp: new Date().toISOString(),
        source: 'live',
        trade: selectedTrade !== 'all' ? selectedTrade : undefined,
      });
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => { });
      inputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    liveAudioPlayerRef.current?.stop();
  };

  // --- Push-to-Talk Speech-to-Speech Methods ---
  const startRecordingPtt = async () => {
    try {
      setPttLastResult(null);
      recordedChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        await processPttAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      appLogger.addLog('info', 'speech', 'client', 'Push-to-Talk recording started');
    } catch (err: any) {
      appLogger.addLog('error', 'speech', 'client', `Failed to start PTT recording: ${err.message}`);
      onError({
        id: String(Date.now()),
        userMessage: 'Could not access microphone for Push-to-Talk recording.',
        debugCode: 'PTT_MIC_ERROR',
        details: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const stopRecordingPtt = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const processPttAudio = async (audioBlob: Blob) => {
    setIsProcessingPtt(true);
    appLogger.addLog('info', 'speech', 'client', `Processing PTT audio blob (${Math.round(audioBlob.size / 1024)} KB)...`);

    try {
      const base64Audio = await blobToBase64(audioBlob);

      const res = await fetch('/api/speech-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: 'audio/webm',
          voiceName: selectedVoice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Speech-to-Speech processing failed on server.');
      }

      setPttLastResult({
        transcript: data.userTranscript,
        reply: data.responseText,
        audioBase64: data.audioBase64,
      });

      // Add user and assistant to history
      onAddHistory({
        id: `ptt-user-${Date.now()}`,
        role: 'user',
        text: data.userTranscript,
        timestamp: new Date().toISOString(),
        source: 'speech',
      });

      onAddHistory({
        id: `ptt-reply-${Date.now()}`,
        role: 'assistant',
        text: data.responseText,
        timestamp: new Date().toISOString(),
        source: 'speech',
        audioBase64: data.audioBase64,
        durationMs: data.durationMs,
      });

      // Auto-play counselor's audio response
      if (data.audioBase64) {
        playPttAudio(data.audioBase64);
      }
    } catch (err: any) {
      appLogger.addLog('error', 'speech', 'client', `PTT processing error: ${err.message}`, err);
      onError({
        id: String(Date.now()),
        userMessage: err.message || 'Failed to process voice query.',
        debugCode: 'PTT_PROCESSING_FAILED',
        details: err,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsProcessingPtt(false);
    }
  };

  const playPttAudio = (base64Audio: string) => {
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
    }
    setIsPlayingPttAudio(true);
    const audio = playWavBase64(base64Audio, () => {
      setIsPlayingPttAudio(false);
    });
    activeAudioElementRef.current = audio;
  };

  const quickVoicePrompts = [
    'What is the eligibility for Electrician trade?',
    'I scored 55% in 10th standard. Can I get admission?',
    'Is ITI recognized for jobs abroad or government exams?',
    'What documents do I need to bring for seat verification?',
  ];

  return (
    <div className="space-y-6">
      {/* Mode Selector & Counselor Context */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-600" />
              Speech to Speech Admission Counselor
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Talk directly with Aarav in natural spoken language for instant admission advice.
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => {
                if (isLiveActive) stopLiveSession();
                setVoiceMode('live');
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${voiceMode === 'live'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Real-Time Live Call (Gemini 3.8 Live)
            </button>
            <button
              onClick={() => {
                if (isLiveActive) stopLiveSession();
                setVoiceMode('push-to-talk');
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${voiceMode === 'push-to-talk'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Push-to-Talk (Record & Respond)
            </button>
          </div>
        </div>

        {/* Trade Selector & Voice Persona */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Specific Trade of Interest (Optional):
            </label>
            <select
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {ITI_TRADES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Counselor Voice Preset:
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} - {v.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mode A: Real-Time Live Call View */}
      {voiceMode === 'live' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center py-6">
            {/* Visualizer / Call State Indicator */}
            <div className="relative mb-4">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center transition-all ${isLiveActive
                    ? 'bg-blue-50 border-4 border-blue-500 ring-8 ring-blue-100'
                    : 'bg-slate-100 border-4 border-slate-200'
                  }`}
              >
                {isLiveActive ? (
                  <div className="flex flex-col items-center">
                    <Mic className="w-8 h-8 text-blue-600 animate-pulse" />
                    <span className="text-[10px] font-mono text-blue-600 font-bold mt-1">
                      {liveStatus === 'Aarav is speaking...' ? 'SPEAKING' : 'LISTENING'}
                    </span>
                  </div>
                ) : (
                  <PhoneCall className="w-8 h-8 text-slate-400" />
                )}
              </div>

              {/* Minimal Audio Volume Level Meter */}
              {isLiveActive && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-75"
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900">
              {isLiveActive ? 'Live Audio Counseling Session Active' : 'Start Live Voice Call with Aarav'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {isLiveActive
                ? `Status: ${liveStatus}. Speak naturally into your microphone. Aarav will respond in 2-3 spoken sentences.`
                : 'Click the button below to initiate real-time duplex voice assistance via Gemini 3.8 Live API.'}
            </p>

            {/* Call Controls */}
            <div className="flex items-center gap-3 mt-6">
              {!isLiveActive ? (
                <button
                  onClick={startLiveSession}
                  className="inline-flex items-center px-6 py-3 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
                >
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Start Live Voice Call
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsMuted(!isMuted);
                      liveAudioPlayerRef.current?.setMuted(!isMuted);
                    }}
                    className={`inline-flex items-center px-4 py-2.5 rounded-lg text-xs font-medium border transition-colors ${isMuted
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 mr-1.5 text-amber-600" /> : <Mic className="w-4 h-4 mr-1.5 text-slate-600" />}
                    {isMuted ? 'Muted' : 'Mute Mic'}
                  </button>

                  <button
                    onClick={stopLiveSession}
                    className="inline-flex items-center px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors shadow-sm"
                  >
                    <PhoneOff className="w-4 h-4 mr-2" />
                    End Call
                  </button>
                </>
              )}
            </div>

            {/* Live Spoken Transcript Feedback */}
            {isLiveActive && (
              <div className="w-full max-w-xl mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Live Spoken Response:
                </span>
                <p className="text-sm text-slate-800 italic">
                  {liveOutputText || 'Aarav is listening for your admission query...'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode B: Push-to-Talk View */}
      {voiceMode === 'push-to-talk' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center py-6">
            <div className="mb-4">
              <button
                onMouseDown={startRecordingPtt}
                onMouseUp={stopRecordingPtt}
                onTouchStart={startRecordingPtt}
                onTouchEnd={stopRecordingPtt}
                disabled={isProcessingPtt}
                className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all ${isRecording
                    ? 'bg-rose-600 text-white shadow-lg ring-8 ring-rose-100 scale-105'
                    : isProcessingPtt
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  }`}
                title="Hold to speak, release to send"
              >
                <Mic className={`w-8 h-8 ${isRecording ? 'animate-bounce' : ''}`} />
                <span className="text-[10px] font-semibold mt-1 uppercase">
                  {isRecording ? 'Recording' : isProcessingPtt ? 'Thinking...' : 'Hold to Speak'}
                </span>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {isRecording
                ? 'Listening to your query... Release button to process.'
                : isProcessingPtt
                  ? 'Aarav is analyzing your question and synthesizing audio response...'
                  : 'Click and hold (or tap and hold on mobile) to ask your ITI question.'}
            </p>

            {/* Result Box */}
            {pttLastResult && (
              <div className="w-full max-w-xl mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-left space-y-3">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">
                    You Asked:
                  </span>
                  <p className="text-xs text-slate-800 mt-0.5">"{pttLastResult.transcript}"</p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-blue-700 block">
                      Aarav's Response:
                    </span>
                    {pttLastResult.audioBase64 && (
                      <button
                        onClick={() => playPttAudio(pttLastResult.audioBase64!)}
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {isPlayingPttAudio ? (
                          <>
                            <Pause className="w-3.5 h-3.5 mr-1" />
                            Playing
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Replay Audio
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-800 mt-1 font-normal">
                    {pttLastResult.reply}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Quick Questions */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h4 className="text-xs font-semibold text-slate-700 flex items-center mb-2.5">
          <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
          Common Voice Inquiries to Try:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickVoicePrompts.map((prompt, idx) => (
            <div
              key={idx}
              className="text-xs bg-white text-slate-700 p-2.5 rounded border border-slate-200"
            >
              "{prompt}"
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

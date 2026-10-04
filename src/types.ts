export type ModalityMode = 'speech-to-speech' | 'text-to-text' | 'text-to-speech' | 'history' | 'debug';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source: 'text' | 'speech' | 'live';
  audioBase64?: string;
  durationMs?: number;
  trade?: string;
}

export interface TtsRecord {
  id: string;
  text: string;
  voice: string;
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  timestamp: string;
}

export interface LogItem {
  id: string;
  timestamp: string;
  source: 'server' | 'client' | 'gemini' | 'websocket';
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'text' | 'tts' | 'speech' | 'live' | 'system';
  message: string;
  details?: any;
}

export interface SystemHealth {
  status: string;
  apiKeyConfigured: boolean;
  serverTime: string;
  models: {
    chat: string;
    tts: string;
    live: string;
    transcribe: string;
  };
}

export interface ErrorAlert {
  id: string;
  userMessage: string;
  debugCode?: string;
  details?: any;
  timestamp: string;
}

export const ITI_TRADES = [
  { id: 'all', name: 'General Inquiries' },
  { id: 'electrician', name: 'Electrician (10th Pass)' },
  { id: 'fitter', name: 'Fitter (10th Pass)' },
  { id: 'copa', name: 'COPA - Computer Operator (10th Pass)' },
  { id: 'welder', name: 'Welder (8th Pass)' },
  { id: 'wireman', name: 'Wireman (8th Pass)' },
  { id: 'mmv', name: 'Mechanic Motor Vehicle (10th Pass)' },
  { id: 'stenographer', name: 'Stenography & Secretarial (10th Pass)' },
];

export const TTS_VOICES = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Clear, balanced, and reassuring (Default Counselor)' },
  { id: 'Puck', name: 'Puck', description: 'Energetic, friendly, and youthful tone' },
  { id: 'Kore', name: 'Kore', description: 'Calm, patient, and warm guide' },
  { id: 'Charon', name: 'Charon', description: 'Deep, steady, authoritative advisory tone' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Crisp, confident, distinct articulation' },
];

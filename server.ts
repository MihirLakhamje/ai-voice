import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory debug log buffer for client-server unified log viewer
interface LogEntry {
  id: string;
  timestamp: string;
  source: 'server' | 'client' | 'gemini' | 'websocket';
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'text' | 'tts' | 'speech' | 'live' | 'system';
  message: string;
  details?: any;
}

const serverLogs: LogEntry[] = [];
function logEvent(
  level: LogEntry['level'],
  category: LogEntry['category'],
  source: LogEntry['source'],
  message: string,
  details?: any
) {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    source,
    level,
    category,
    message,
    details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details)) : details) : undefined,
  };
  serverLogs.unshift(entry);
  if (serverLogs.length > 500) {
    serverLogs.pop();
  }
  // Also log to stdout for server tracing
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}]`;
  if (level === 'error') {
    console.error(prefix, message, details || '');
  } else if (level === 'warn') {
    console.warn(prefix, message, details || '');
  } else {
    console.log(prefix, message, details || '');
  }
}

// System Instruction for Aarav - ITI Admission Voice Assistant
export const AARAV_SYSTEM_INSTRUCTION = `You are Aarav, the official AI Voice Admission Counselor for the Industrial Training Institute (ITI) Admissions Portal.
Your objective is to assist prospective students, parents, and candidates by answering admissions-related inquiries, guiding them through registration workflows, resolving common doubts, and politely overcoming hesitations or objections regarding vocational education.

Voice Persona & Tone Guidelines:
- Name: Aarav
- Tone: Professional, empathetic, reassuring, patient, and concise.
- Pacing & Style: Keep responses short, typically 2 to 3 sentences (under 40 words) per turn, to sound natural over voice and easy to understand.
- Speak in clear, plain language; avoid academic jargon, excessive technical acronyms, or complex bullet points.
- Use conversational connectors (e.g., "I understand," "Certainly," "That's a very fair question").
- Never list long URLs or complicated paths aloud; offer to send SMS/WhatsApp links or direct them to key portal buttons instead.

Core Knowledge & FAQ Handling:
A. Eligibility & Minimum Criteria:
- Age: Minimum 14 years completed by admission cut-off date (no upper age limit for most regular trades).
- Academic Qualifications:
  - 8th Pass: Wireman, Welder, Carpenter, Plumber, Sheet Metal Worker.
  - 10th (Matriculation) Pass: Standard requirement for Electrician, Fitter, Turner, Machinist, COPA (Computer Operator and Programming Assistant), Stenography, Mechanic Motor Vehicle.
  - 12th Pass / Science Stream: Preferred/required for advanced technical tracks.

B. Application Process & Documents:
- Process: Online registration -> Profile completion -> Uploading documents -> Choice filling (trades & colleges) -> Merit list verification -> Seat allotment -> Physical reporting & fee deposit.
- Essential Documents: Mark sheet (8th/10th/12th), Aadhaar Card, Passport photos, Category/Caste certificate (if applicable), Domicile certificate, Income certificate (if claiming concessions).

C. Certification & Fees:
- Certificates: NCVT (National Council for Vocational Training - recognized nationwide and abroad) and SCVT (State Council for Vocational Training).
- Fees: Government ITIs have nominal subsidized tuition fees; scholarship schemes available for eligible students.

Objection Handling & Empathy Framework (Listen -> Acknowledge -> Reframe -> Call to Action):
1. "Is ITI as valuable as a regular degree or diploma?": Explain that while degrees focus on theory, ITI gives hands-on practical skills industries hire for immediately, and lateral entry into Diploma or Engineering is still open later.
2. "I don't have very high marks in 10th. Can I still get admission?": Reassure them that admissions consider merit across many high-demand trades that accept standard passing marks.
3. "Private colleges are too expensive": Highlight government ITIs' subsidized fees and government scholarships.
4. "I am confused about which trade to pick": Guide them between practical engineering trades (Electrician, Fitter) or computer/office trades (COPA).

Conversational Guardrails:
1. One Question at a Time: Never ask multiple questions in a single response.
2. Clarification Before Escalation: Gently clarify if voice input was unclear.
3. Escalation to Human Helpdesk: For payment disputes, deducted money, or specific disputes, offer to connect to admissions helpdesk executive (Helpline: 1800-120-4848).
4. No Guarantees: Never guarantee seat allotment or jobs; explain it depends on merit list cut-offs and seat availability.
5. Session Wrap-up: Conclude politely when user has finished.`;

// Get Gemini Client helper
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// User-friendly error message formatter
function formatErrorMessage(error: any): { userMessage: string; debugDetails: any; status: number } {
  const errMsg = error?.message || String(error);
  const status = error?.status || 500;

  if (errMsg.includes('API key') || errMsg.includes('API_KEY')) {
    return {
      userMessage: 'Gemini API key is not configured or invalid. Please check your secrets configuration in Settings > Secrets.',
      debugDetails: { code: 'API_KEY_ERROR', error: errMsg },
      status: 401,
    };
  }
  if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429') || errMsg.includes('quota')) {
    return {
      userMessage: 'The AI service is experiencing high demand right now. Please wait a few seconds and try again.',
      debugDetails: { code: 'QUOTA_EXHAUSTED', error: errMsg },
      status: 429,
    };
  }
  if (errMsg.includes('NOT_FOUND') || errMsg.includes('404')) {
    return {
      userMessage: 'The requested AI model is temporarily unavailable. Please verify model configuration.',
      debugDetails: { code: 'MODEL_NOT_FOUND', error: errMsg },
      status: 404,
    };
  }
  return {
    userMessage: 'An error occurred while communicating with the admission counselor assistant. Please try again.',
    debugDetails: { code: 'INTERNAL_ERROR', error: errMsg, stack: error?.stack },
    status: 500,
  };
}

// API Routes

// 1. Health check & configuration status
app.get('/api/health', (req: Request, res: Response) => {
  const apiKeyPresent = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  res.json({
    status: 'ok',
    apiKeyConfigured: apiKeyPresent,
    serverTime: new Date().toISOString(),
    features: {
      textToText: true,
      textToSpeech: true,
      speechToSpeech: true,
      liveApi: true,
    },
    models: {
      chat: 'gemini-3.8-flash',
      tts: 'gemini-3.8-flash-lite-tts',
      live: 'gemini-3.8-live',
      transcribe: 'gemini-3.5-transcribe',
    },
  });
});

// 2. Client logs relay
app.get('/api/logs', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '100', 10);
  const level = req.query.level as string;
  const category = req.query.category as string;

  let filtered = serverLogs;
  if (level) {
    filtered = filtered.filter((l) => l.level === level);
  }
  if (category) {
    filtered = filtered.filter((l) => l.category === category);
  }

  res.json({ logs: filtered.slice(0, limit) });
});

app.post('/api/logs', (req: Request, res: Response) => {
  const { level = 'info', category = 'system', message, details } = req.body;
  logEvent(level, category, 'client', message || 'Client log entry', details);
  res.json({ success: true });
});

app.delete('/api/logs', (req: Request, res: Response) => {
  serverLogs.length = 0;
  logEvent('info', 'system', 'server', 'Debug log buffer cleared');
  res.json({ success: true, message: 'Logs cleared' });
});

// 3. Text to Text Processing (Chat)
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { message, history = [], tradeInterest } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message text is required.' });
    return;
  }

  logEvent('info', 'text', 'server', `Processing Text-to-Text query: "${message.substring(0, 60)}..."`, {
    messageLength: message.length,
    historyTurns: Array.isArray(history) ? history.length : 0,
    tradeInterest,
  });

  const ai = getGeminiClient();
  if (!ai) {
    const errorInfo = formatErrorMessage(new Error('GEMINI_API_KEY environment variable is not configured.'));
    logEvent('error', 'text', 'server', 'Missing GEMINI_API_KEY', errorInfo.debugDetails);
    res.status(errorInfo.status).json({
      error: errorInfo.userMessage,
      debug: errorInfo.debugDetails,
    });
    return;
  }

  try {
    // Format conversation history for Gemini API
    const formattedContents: any[] = [];

    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn.role && turn.text) {
          formattedContents.push({
            role: turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: turn.text }],
          });
        }
      }
    }

    // Add current user prompt
    formattedContents.push({
      role: 'user',
      parts: [
        {
          text: tradeInterest ? `[Context: Candidate is interested in ${tradeInterest} trade]\n${message}` : message,
        },
      ],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedContents,
      config: {
        systemInstruction: AARAV_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "I'm here to help with your ITI admission queries. Could you please specify your question?";
    const durationMs = Date.now() - startTime;

    logEvent('info', 'text', 'server', `Text-to-Text generated response in ${durationMs}ms`, {
      replyLength: replyText.length,
      durationMs,
    });

    res.json({
      reply: replyText,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const errInfo = formatErrorMessage(error);
    logEvent('error', 'text', 'gemini', `Gemini chat failed: ${error?.message}`, errInfo.debugDetails);
    res.status(errInfo.status).json({
      error: errInfo.userMessage,
      debug: errInfo.debugDetails,
    });
  }
});

// 4. Text to Speech (TTS)
app.post('/api/tts', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { text, voiceName = 'Zephyr' } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Text is required for speech synthesis.' });
    return;
  }

  const validVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

  logEvent('info', 'tts', 'server', `Synthesizing speech with voice "${selectedVoice}": "${text.substring(0, 50)}..."`, {
    textLength: text.length,
    voice: selectedVoice,
  });

  const ai = getGeminiClient();
  if (!ai) {
    const errorInfo = formatErrorMessage(new Error('GEMINI_API_KEY is not configured.'));
    logEvent('error', 'tts', 'server', 'Missing GEMINI_API_KEY for TTS', errorInfo.debugDetails);
    res.status(errorInfo.status).json({
      error: errorInfo.userMessage,
      debug: errorInfo.debugDetails,
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: 'Clear, reassuring, professional admission counselor Aarav',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('No audio data received in Gemini TTS response.');
    }

    const durationMs = Date.now() - startTime;
    logEvent('info', 'tts', 'server', `TTS synthesis completed in ${durationMs}ms`, {
      audioBytesApprox: Math.round((base64Audio.length * 3) / 4),
      durationMs,
    });

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: selectedVoice,
      text,
      durationMs,
    });
  } catch (error: any) {
    const errInfo = formatErrorMessage(error);
    logEvent('error', 'tts', 'gemini', `TTS generation failed: ${error?.message}`, errInfo.debugDetails);
    res.status(errInfo.status).json({
      error: errInfo.userMessage,
      debug: errInfo.debugDetails,
    });
  }
});

// 5. Speech to Speech Processing (Push-to-Talk or Audio Upload)
app.post('/api/speech-to-speech', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { audioBase64, mimeType = 'audio/webm', textInput, voiceName = 'Zephyr', history = [] } = req.body;

  logEvent('info', 'speech', 'server', 'Initiating Speech-to-Speech processing', {
    hasAudio: Boolean(audioBase64),
    hasText: Boolean(textInput),
    mimeType,
    voiceName,
  });

  const ai = getGeminiClient();
  if (!ai) {
    const errorInfo = formatErrorMessage(new Error('GEMINI_API_KEY is not configured.'));
    logEvent('error', 'speech', 'server', 'Missing GEMINI_API_KEY for Speech-to-Speech', errorInfo.debugDetails);
    res.status(errorInfo.status).json({
      error: errorInfo.userMessage,
      debug: errorInfo.debugDetails,
    });
    return;
  }

  try {
    let candidateQuestion = textInput || '';

    // Step A: If audio was provided without transcript, transcribe or process audio
    if (audioBase64 && !candidateQuestion) {
      logEvent('info', 'speech', 'server', 'Transcribing spoken input audio...');
      try {
        const transcribeRes = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              { text: 'Transcribe the user speech verbatim. If in Hindi or English, transcribe exactly as spoken. Return only the transcription text.' },
            ],
          },
        });
        candidateQuestion = transcribeRes.text?.trim() || '';
        logEvent('info', 'speech', 'server', `Transcription result: "${candidateQuestion}"`);
      } catch (transcribeErr: any) {
        logEvent('warn', 'speech', 'gemini', `Dedicated transcription fallback: ${transcribeErr?.message}`);
        // Fallback: use direct audio understanding in 3.8-flash
        const flashRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              { text: 'Transcribe what the speaker is asking regarding ITI admission. Output only what they asked.' },
            ],
          },
        });
        candidateQuestion = flashRes.text?.trim() || 'Could you tell me about ITI admission?';
      }
    }

    if (!candidateQuestion) {
      candidateQuestion = 'Hello, can you help me with ITI admission?';
    }

    // Step B: Generate Aarav's concise conversational response
    const formattedContents: any[] = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn.role && turn.text) {
          formattedContents.push({
            role: turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: turn.text }],
          });
        }
      }
    }
    formattedContents.push({
      role: 'user',
      parts: [{ text: candidateQuestion }],
    });

    const counselorResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedContents,
      config: {
        systemInstruction: `${AARAV_SYSTEM_INSTRUCTION}\nCRITICAL: Keep your response under 35 words and strictly 2 to 3 concise spoken sentences for direct audio playback.`,
        temperature: 0.6,
      },
    });

    const responseText = counselorResponse.text?.trim() || 'Welcome to ITI Admissions. I am Aarav. How can I guide you today?';

    // Step C: Synthesize Speech Output using gemini-3.8-flash-lite-tts
    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: responseText,
              speechMetadata: {
                style: 'Reassuring, crisp, warm ITI admission counselor Aarav',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' },
          },
        },
      },
    });

    const responseAudioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const totalDurationMs = Date.now() - startTime;

    logEvent('info', 'speech', 'server', `Speech-to-Speech processed in ${totalDurationMs}ms`, {
      userQuestion: candidateQuestion,
      replyText: responseText,
      hasAudio: Boolean(responseAudioBase64),
      totalDurationMs,
    });

    res.json({
      userTranscript: candidateQuestion,
      responseText,
      audioBase64: responseAudioBase64,
      mimeType: 'audio/wav',
      durationMs: totalDurationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const errInfo = formatErrorMessage(error);
    logEvent('error', 'speech', 'server', `Speech-to-Speech failed: ${error?.message}`, errInfo.debugDetails);
    res.status(errInfo.status).json({
      error: errInfo.userMessage,
      debug: errInfo.debugDetails,
    });
  }
});

// HTTP Server creation for both Express and WebSockets
const httpServer = http.createServer(app);

// WebSocket Server for Gemini Live API (`gemini-3.8-live`)
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade on `/live` or `/api/live`
httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/live' || pathname === '/api/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Let other upgrades proceed or close
    socket.destroy();
  }
});

// WebSocket connection lifecycle
wss.on('connection', async (clientWs: WebSocket) => {
  const sessionId = `live-${Date.now()}`;
  logEvent('info', 'live', 'websocket', `Live WebSocket client connected (${sessionId})`);

  const ai = getGeminiClient();
  if (!ai) {
    const errMsg = 'Gemini API key is not configured. Real-time Live session cannot start.';
    logEvent('error', 'live', 'websocket', errMsg);
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'Gemini API key is missing. Please set GEMINI_API_KEY in Settings > Secrets.',
        code: 'MISSING_API_KEY',
      })
    );
    clientWs.close();
    return;
  }

  let session: any = null;

  try {
    clientWs.send(
      JSON.stringify({
        type: 'status',
        status: 'connecting',
        message: 'Connecting to Gemini Live Counselor session...',
      })
    );

    // Connect to gemini-3.8-live per official skill instructions
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
        systemInstruction: `${AARAV_SYSTEM_INSTRUCTION}\nCRITICAL: You are Aarav in a live audio call. Keep answers short (1-2 clear sentences, under 30 words), empathetic, and ask one question at a time.`,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          logEvent('info', 'live', 'gemini', `Live API session connected with Gemini (${sessionId})`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'status',
                status: 'connected',
                message: 'Aarav is listening. You can start speaking now.',
              })
            );
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          // 1. Audio data from model
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                  })
                );
              }
              if (part.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'output_transcript',
                    text: part.text,
                  })
                );
              }
            }
          }

          // 2. Interruption flag
          if (message.serverContent?.interrupted) {
            logEvent('debug', 'live', 'gemini', 'Live speech interrupted by user speech');
            clientWs.send(
              JSON.stringify({
                type: 'interrupted',
              })
            );
          }

          // 3. User speech transcript if provided by live model
          // @ts-ignore
          const userTranscript = message.serverContent?.turnComplete;
          if (userTranscript) {
            clientWs.send(
              JSON.stringify({
                type: 'turn_complete',
              })
            );
          }
        },
        onerror: (err: any) => {
          logEvent('error', 'live', 'gemini', `Gemini Live session error: ${err?.message || err}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: 'Live session encountered an issue. Falling back to push-to-talk counselor.',
                details: err?.message || String(err),
              })
            );
          }
        },
        onclose: (e: any) => {
          logEvent('info', 'live', 'gemini', `Gemini Live session closed (${sessionId})`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'status',
                status: 'closed',
                message: 'Live voice session ended.',
              })
            );
          }
        },
      },
    });

    logEvent('info', 'live', 'websocket', `Live connection established successfully (${sessionId})`);

    // Handle incoming audio from client
    clientWs.on('message', (rawData) => {
      try {
        const payload = JSON.parse(rawData.toString());

        if (payload.type === 'audio' && payload.data && session) {
          // Send 16kHz PCM audio to gemini-3.8-live
          session.sendRealtimeInput({
            audio: {
              data: payload.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.type === 'text' && payload.text && session) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err: any) {
        logEvent('warn', 'live', 'websocket', `Malformed client live message: ${err?.message}`);
      }
    });

    clientWs.on('close', () => {
      logEvent('info', 'live', 'websocket', `Client disconnected (${sessionId})`);
      if (session && typeof session.close === 'function') {
        try {
          session.close();
        } catch (_) {}
      }
    });

    clientWs.on('error', (err) => {
      logEvent('error', 'live', 'websocket', `Client WebSocket error: ${err.message}`);
    });
  } catch (error: any) {
    const errInfo = formatErrorMessage(error);
    logEvent('error', 'live', 'gemini', `Failed to start Live session: ${error?.message}`, errInfo.debugDetails);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: errInfo.userMessage,
          details: errInfo.debugDetails,
        })
      );
      clientWs.close();
    }
  }
});

// Setup Vite dev server or serve production build
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logEvent('info', 'system', 'server', 'Vite dev middleware attached');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    logEvent('info', 'system', 'server', `Static files served from ${distPath}`);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logEvent('info', 'system', 'server', `ITI Admission Voice Assistant Server listening on port ${PORT}`);
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

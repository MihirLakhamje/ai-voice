/**
 * Audio helpers for Real-Time PCM 16kHz capture, 24kHz playback, and WAV base64 handling.
 */

// Convert Float32Array (-1.0 to 1.0) to 16-bit signed PCM ArrayBuffer
export function float32ToInt16PCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
  }
  return buffer;
}

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to 16-bit PCM Float32Array for Web Audio playback
export function base64PCMToFloat32(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

// Convert Blob to Base64 data string (without prefix)
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Audio Queue Player for streaming 24kHz PCM from Gemini Live
 */
export class LiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private isMuted: boolean = false;

  constructor() {
    // Lazy init on first user interaction
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public queuePcmChunk(base64Audio: string) {
    if (this.isMuted) return;

    try {
      const ctx = this.getAudioContext();
      const float32Data = base64PCMToFloat32(base64Audio);
      if (float32Data.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      // Schedule immediately or seamlessly after previous chunk
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSourceNodes.push(source);
      source.onended = () => {
        const index = this.activeSourceNodes.indexOf(source);
        if (index !== -1) {
          this.activeSourceNodes.splice(index, 1);
        }
      };
    } catch (err) {
      console.error('Error scheduling audio chunk:', err);
    }
  }

  public stop() {
    for (const node of this.activeSourceNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch (_) {}
    }
    this.activeSourceNodes = [];
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
  }

  public close() {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

/**
 * Plays unary WAV base64 string
 */
export function playWavBase64(base64Wav: string, onEnded?: () => void): HTMLAudioElement {
  const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
  if (onEnded) {
    audio.onended = onEnded;
  }
  audio.play().catch((err) => {
    console.error('Autoplay prevented or playback error:', err);
  });
  return audio;
}

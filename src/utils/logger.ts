import { LogItem } from '../types';

type LogListener = (logs: LogItem[]) => void;

class LoggerService {
  private logs: LogItem[] = [];
  private listeners: Set<LogListener> = new Set();

  constructor() {
    this.addLog('info', 'system', 'client', 'Application initialized');
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public addLog(
    level: LogItem['level'],
    category: LogItem['category'],
    source: LogItem['source'],
    message: string,
    details?: any
  ): LogItem {
    const entry: LogItem = {
      id: `client-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      source,
      level,
      category,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > 500) {
      this.logs.pop();
    }

    // Notify local listeners
    this.notify();

    // Async relay to server if network is alive
    if (source === 'client') {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, category, message, details }),
      }).catch(() => {
        // Ignore network failure when posting logs to prevent infinite loops
      });
    }

    return entry;
  }

  public async fetchServerLogs(): Promise<LogItem[]> {
    try {
      const res = await fetch('/api/logs?limit=200');
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        // Merge and deduplicate by ID
        const existingIds = new Set(this.logs.map((l) => l.id));
        const newServerLogs = data.logs.filter((l: LogItem) => !existingIds.has(l.id));
        this.logs = [...newServerLogs, ...this.logs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        this.notify();
      }
      return this.logs;
    } catch (err) {
      console.warn('Could not fetch server logs:', err);
      return this.logs;
    }
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
    fetch('/api/logs', { method: 'DELETE' }).catch(() => {});
  }

  public getLogs(): LogItem[] {
    return [...this.logs];
  }

  private notify() {
    const snapshot = [...this.logs];
    this.listeners.forEach((fn) => fn(snapshot));
  }
}

export const appLogger = new LoggerService();

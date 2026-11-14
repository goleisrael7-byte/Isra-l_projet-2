interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ResilientCache {
  private store = new Map<string, CacheEntry<unknown>>();
  public hits = 0;
  public misses = 0;
  public invalidations = 0;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = 30_000): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this.invalidations += 1;
      }
    }
  }

  clear(): void {
    const size = this.store.size;
    this.store.clear();
    this.invalidations += size;
  }

  stats() {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
    const total = this.hits + this.misses;
    return {
      backend: 'ResilientMemoryStore (Redis-compatible API)',
      activeKeys: this.store.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
      hitRatio: total > 0 ? Number(((this.hits / total) * 100).toFixed(1)) : 100,
    };
  }
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  public state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureAt = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  public readonly name: string;

  constructor(name: string, failureThreshold = 3, resetTimeoutMs = 15_000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureAt >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`CircuitBreaker [${this.name}] OPEN : service temporairement isolé.`);
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'CLOSED';
      return result;
    } catch (err) {
      this.failures += 1;
      this.lastFailureAt = Date.now();
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      throw err;
    }
  }

  status() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
    };
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 150
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 50);
        const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export interface LogRecord {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  meta?: Record<string, unknown>;
}

class CentralizedLogger {
  private logs: LogRecord[] = [];
  private readonly maxLogs = 200;

  log(level: 'INFO' | 'WARN' | 'ERROR', module: string, message: string, meta?: Record<string, unknown>) {
    const entry: LogRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      meta,
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.length = this.maxLogs;
    }
    if (level === 'ERROR') {
      console.error(`[${entry.timestamp}] [${module}] ${message}`, meta || '');
    }
  }

  recent(limit = 50): LogRecord[] {
    return this.logs.slice(0, limit);
  }
}

export const cache = new ResilientCache();
export const dbCircuitBreaker = new CircuitBreaker('DatabasePrimary', 5, 10_000);
export const logger = new CentralizedLogger();

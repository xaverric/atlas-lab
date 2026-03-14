export interface EvaluationResult {
  rule: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

export interface ExecutionResult {
  exitCode?: number;
  statusCode?: number;
  stdout?: string;
  stderr?: string;
  body?: string;
  error?: string;
  evaluationResults?: EvaluationResult[];
  data?: unknown;
}

export interface RunLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface StorageAccess {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ExecutionContext {
  jobId: string;
  runId: string;
  logger: RunLogger;
  storage: StorageAccess;
  env: Record<string, string>;
}

export interface Executor {
  execute(config: Record<string, unknown>, timeoutMs: number, ctx?: ExecutionContext): Promise<ExecutionResult>;
}

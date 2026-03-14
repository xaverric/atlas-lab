export interface ExecutionResult {
  exitCode?: number;
  statusCode?: number;
  stdout?: string;
  stderr?: string;
  body?: string;
  error?: string;
}

export interface Executor {
  execute(config: Record<string, unknown>, timeoutMs: number): Promise<ExecutionResult>;
}

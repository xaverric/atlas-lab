export interface EventEnvelope {
  event: string;
  payload: Record<string, unknown>;
  source: string;
  timestamp: string;
  correlationId?: string;
}

export type EventHandler = (envelope: EventEnvelope) => void | Promise<void>;

export interface EventBusConfig {
  host: string;
  port: number;
  password?: string;
}

export interface EventBus {
  publish(event: string, payload: Record<string, unknown>, source: string): Promise<void>;
  subscribe(pattern: string, handler: EventHandler): void;
  close(): Promise<void>;
  isConnected(): boolean;
}

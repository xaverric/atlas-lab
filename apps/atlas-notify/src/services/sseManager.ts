import type { Response } from 'express';

const clients = new Map<string, Set<Response>>();

const HEARTBEAT_INTERVAL = 30000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const ensureHeartbeat = () => {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const resSet of clients.values()) {
      for (const res of resSet) {
        res.write(': keepalive\n\n');
      }
    }
  }, HEARTBEAT_INTERVAL);
};

export const addClient = (userId: string, res: Response) => {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
  ensureHeartbeat();
};

export const removeClient = (userId: string, res: Response) => {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
  if (clients.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

export const pushToUser = (userId: string, eventName: string, data: unknown) => {
  const set = clients.get(userId);
  if (!set) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
};

export const getConnectedCount = () => {
  let count = 0;
  for (const set of clients.values()) count += set.size;
  return count;
};

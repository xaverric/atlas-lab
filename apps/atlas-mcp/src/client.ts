import { config } from './config.js';
import { refreshAccessToken } from './session.js';

type ServiceName = keyof typeof config.services;

interface RequestOptions {
  method?: string;
  path: string;
  token: string;
  sessionId?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

const buildUrl = (base: string, path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
};

const doFetch = async (url: string, method: string, headers: Record<string, string>, body?: unknown) => {
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
};

export const request = async (service: ServiceName, opts: RequestOptions) => {
  const base = config.services[service];
  const url = buildUrl(base, opts.path, opts.query);
  const buildHeaders = (token: string): Record<string, string> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  };

  let res = await doFetch(url, opts.method || 'GET', buildHeaders(opts.token), opts.body);

  if (res.status === 401 && opts.sessionId) {
    const newToken = await refreshAccessToken(opts.sessionId);
    if (newToken) {
      res = await doFetch(url, opts.method || 'GET', buildHeaders(newToken), opts.body);
    }
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    if (!res.ok) throw new Error(`${res.status}: ${text}`);
    return text;
  }

  if (!res.ok) {
    const err = json as { error?: string; details?: unknown };
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return json;
};

export const uploadMultipart = async (
  service: ServiceName,
  opts: {
    path: string;
    token: string;
    sessionId?: string;
    filename: string;
    mimeType: string;
    base64Content: string;
    fields?: Record<string, string>;
    query?: Record<string, string | undefined>;
  },
) => {
  const base = config.services[service];
  const url = buildUrl(base, opts.path, opts.query);

  const doUpload = async (token: string) => {
    const blob = new Blob(
      [Buffer.from(opts.base64Content, 'base64')],
      { type: opts.mimeType },
    );
    const form = new FormData();
    form.append('file', blob, opts.filename);
    if (opts.fields) {
      for (const [k, v] of Object.entries(opts.fields)) {
        form.append(k, v);
      }
    }
    return fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  };

  let res = await doUpload(opts.token);

  if (res.status === 401 && opts.sessionId) {
    const newToken = await refreshAccessToken(opts.sessionId);
    if (newToken) {
      res = await doUpload(newToken);
    }
  }

  const json = await res.json();
  if (!res.ok) {
    const err = json as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return json;
};

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from '../config.js';

export const registerHealthTools = (server: McpServer) => {
  server.tool(
    'health_check',
    'Check health status of all Atlas backend services',
    {},
    async () => {
      const services = Object.entries(config.services) as [string, string][];
      const results = await Promise.allSettled(
        services.map(async ([name, url]) => {
          const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
          const ok = res.ok;
          return { name, url, ok, status: res.status };
        }),
      );

      const lines = results.map((r, i) => {
        const [name] = services[i];
        if (r.status === 'fulfilled') {
          return `${r.value.ok ? 'OK' : 'FAIL'} ${name} (${services[i][1]}) — HTTP ${r.value.status}`;
        }
        return `FAIL ${name} (${services[i][1]}) — ${(r.reason as Error).message}`;
      });

      const allOk = results.every(r => r.status === 'fulfilled' && r.value.ok);

      return {
        content: [{
          type: 'text',
          text: `Health Check: ${allOk ? 'ALL OK' : 'SOME FAILURES'}\n\n${lines.join('\n')}`,
        }],
      };
    },
  );
};

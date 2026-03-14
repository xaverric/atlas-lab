import type { Executor, ExecutionResult, EvaluationResult, ExecutionContext } from './types.js';

const MAX_BODY = 50_000;

interface EvaluationRule {
  type: 'statusEquals' | 'bodyContains' | 'jsonPathEquals' | 'jsonSchema';
  value: unknown;
  path?: string;
}

interface WebhookConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  auth?: {
    type: 'bearer' | 'basic' | 'header';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
    headerValue?: string;
  };
  evaluationRules?: EvaluationRule[];
}

const buildAuthHeaders = (auth: WebhookConfig['auth']): Record<string, string> => {
  if (!auth) return {};
  switch (auth.type) {
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` };
    case 'basic':
      return { Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}` };
    case 'header':
      return auth.headerName ? { [auth.headerName]: auth.headerValue || '' } : {};
    default:
      return {};
  }
};

const evaluateRule = async (rule: EvaluationRule, statusCode: number, body: string): Promise<EvaluationResult> => {
  switch (rule.type) {
    case 'statusEquals':
      return {
        rule: `status equals ${rule.value}`,
        passed: statusCode === Number(rule.value),
        expected: rule.value,
        actual: statusCode,
      };

    case 'bodyContains':
      return {
        rule: `body contains "${rule.value}"`,
        passed: body.includes(String(rule.value)),
        expected: rule.value,
        actual: body.length > 200 ? body.slice(0, 200) + '...' : body,
      };

    case 'jsonPathEquals': {
      try {
        const { JSONPath } = await import('jsonpath-plus');
        const parsed = JSON.parse(body);
        const matches = JSONPath({ path: rule.path!, json: parsed });
        const actual = matches.length === 1 ? matches[0] : matches;
        const passed = JSON.stringify(actual) === JSON.stringify(rule.value);
        return { rule: `jsonPath ${rule.path} equals ${JSON.stringify(rule.value)}`, passed, expected: rule.value, actual };
      } catch (err) {
        return { rule: `jsonPath ${rule.path}`, passed: false, expected: rule.value, actual: String(err) };
      }
    }

    case 'jsonSchema': {
      try {
        const Ajv = (await import('ajv')).default;
        const ajv = new Ajv();
        const parsed = JSON.parse(body);
        const valid = ajv.validate(rule.value as object, parsed);
        return { rule: 'jsonSchema', passed: !!valid, expected: 'valid', actual: valid ? 'valid' : ajv.errorsText() };
      } catch (err) {
        return { rule: 'jsonSchema', passed: false, expected: 'valid', actual: String(err) };
      }
    }

    default:
      return { rule: `unknown: ${rule.type}`, passed: false, expected: null, actual: null };
  }
};

export const webhookExecutor: Executor = {
  async execute(config, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    const {
      url, method = 'GET', headers = {}, body, auth, evaluationRules = [],
    } = config as unknown as WebhookConfig;

    ctx?.logger.info(`${method} ${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const authHeaders = buildAuthHeaders(auth);
      const requestHeaders: Record<string, string> = { ...headers, ...authHeaders };

      if (body && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }

      const res = await fetch(url, {
        method,
        headers: requestHeaders,
        ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const responseBody = (await res.text()).slice(0, MAX_BODY);
      ctx?.logger.info(`Response: ${res.status}`, { statusCode: res.status, bodyLength: responseBody.length });

      const evaluationResults: EvaluationResult[] = [];
      for (const rule of evaluationRules) {
        const result = await evaluateRule(rule, res.status, responseBody);
        evaluationResults.push(result);
        ctx?.logger.info(`Eval [${result.rule}]: ${result.passed ? 'PASS' : 'FAIL'}`);
      }

      const hasEvalFailures = evaluationResults.some((r) => !r.passed);

      return {
        statusCode: res.status,
        body: responseBody,
        evaluationResults: evaluationResults.length > 0 ? evaluationResults : undefined,
        ...(hasEvalFailures ? { error: 'Evaluation rules failed' } : {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx?.logger.error(`Request failed: ${message}`);
      return { error: message };
    } finally {
      clearTimeout(timer);
    }
  },
};

import * as templateDao from '../daos/templateDao.js';

const interpolate = (template: string, vars: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');

const humanizeEvent = (event: string) =>
  event.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const resolve = async (
  event: string,
  templateKey?: string,
  variables: Record<string, string> = {},
): Promise<{ title: string; body: string }> => {
  const template = templateKey
    ? await templateDao.findByKey(templateKey)
    : await templateDao.findByEvent(event);

  if (template) {
    return {
      title: interpolate(template.subject, variables),
      body: interpolate(template.body, variables),
    };
  }

  return {
    title: humanizeEvent(event),
    body: Object.entries(variables).map(([k, v]) => `${k}: ${v}`).join('\n') || event,
  };
};

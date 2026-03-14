import TurndownService from 'turndown';
import Showdown from 'showdown';
import { api } from './api';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

turndown.addRule('taskList', {
  filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
    return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

turndown.addRule('attachmentImage', {
  filter: (node) => {
    if (node.nodeName !== 'IMG') return false;
    const src = node.getAttribute('src') || '';
    return !!node.getAttribute('data-attachment-id') || src.includes('/files/documents/');
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const docId = el.getAttribute('data-attachment-id') || extractDocIdFromUrl(el.getAttribute('src') || '');
    const alt = el.getAttribute('alt') || 'image';
    if (docId) return `![${alt}](attachment:${docId})`;
    return `![${alt}](${el.getAttribute('src') || ''})`;
  },
});

turndown.addRule('attachmentLink', {
  filter: (node) => {
    if (node.nodeName !== 'A') return false;
    return !!node.getAttribute('data-attachment-id');
  },
  replacement: (content, node) => {
    const el = node as HTMLElement;
    const docId = el.getAttribute('data-attachment-id');
    if (docId) return `[${content}](attachment:${docId})`;
    return `[${content}](${el.getAttribute('href') || ''})`;
  },
});

const showdown = new Showdown.Converter({
  tables: true,
  tasklists: true,
  strikethrough: true,
  ghCodeBlocks: true,
});

export const htmlToMarkdown = (html: string): string => {
  if (!html || html === '<p></p>') return '';
  return turndown.turndown(html);
};

export const markdownToHtml = (md: string): string => {
  if (!md) return '';
  return showdown.makeHtml(md);
};

const ATTACHMENT_PATTERN = /!\[([^\]]*)\]\(attachment:([a-f0-9]{24})\)/g;
const ATTACHMENT_LINK_PATTERN = /\[([^\]]+)\]\(attachment:([a-f0-9]{24})\)/g;

function extractDocIdFromUrl(url: string): string | null {
  const match = url.match(/\/files\/documents\/([a-f0-9]{24})\//);
  return match ? match[1] : null;
}

const resolvePresignedUrl = async (docId: string): Promise<string | null> => {
  try {
    const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${docId}/preview`);
    return res.data.url;
  } catch {
    return null;
  }
};

export const resolveAttachmentUrls = async (html: string): Promise<string> => {
  const imgPattern = /(<img[^>]*?)src="attachment:([a-f0-9]{24})"([^>]*?>)/g;
  const linkPattern = /(<a[^>]*?)href="attachment:([a-f0-9]{24})"([^>]*?>)/g;

  const docIds = new Set<string>();

  let match;
  while ((match = imgPattern.exec(html)) !== null) docIds.add(match[2]);
  imgPattern.lastIndex = 0;
  while ((match = linkPattern.exec(html)) !== null) docIds.add(match[2]);
  linkPattern.lastIndex = 0;

  if (docIds.size === 0) return html;

  const urlMap = new Map<string, string>();
  await Promise.all(
    Array.from(docIds).map(async (id) => {
      const url = await resolvePresignedUrl(id);
      if (url) urlMap.set(id, url);
    }),
  );

  let resolved = html.replace(imgPattern, (_, prefix, docId, suffix) => {
    const url = urlMap.get(docId);
    if (!url) return `${prefix}src="attachment:${docId}"${suffix}`;
    return `${prefix}src="${url}" data-attachment-id="${docId}"${suffix}`;
  });

  resolved = resolved.replace(linkPattern, (_, prefix, docId, suffix) => {
    const url = urlMap.get(docId);
    if (!url) return `${prefix}href="attachment:${docId}"${suffix}`;
    return `${prefix}href="${url}" data-attachment-id="${docId}"${suffix}`;
  });

  return resolved;
};

export const resolveMarkdownAttachments = async (md: string): Promise<string> => {
  if (!md) return '';

  const docIds = new Set<string>();
  let match;

  while ((match = ATTACHMENT_PATTERN.exec(md)) !== null) docIds.add(match[2]);
  ATTACHMENT_PATTERN.lastIndex = 0;
  while ((match = ATTACHMENT_LINK_PATTERN.exec(md)) !== null) docIds.add(match[2]);
  ATTACHMENT_LINK_PATTERN.lastIndex = 0;

  if (docIds.size === 0) return md;

  const urlMap = new Map<string, string>();
  await Promise.all(
    Array.from(docIds).map(async (id) => {
      const url = await resolvePresignedUrl(id);
      if (url) urlMap.set(id, url);
    }),
  );

  let resolved = md;

  resolved = resolved.replace(ATTACHMENT_PATTERN, (full, alt, docId) => {
    const url = urlMap.get(docId);
    return url ? `![${alt}](${url})` : full;
  });

  resolved = resolved.replace(ATTACHMENT_LINK_PATTERN, (full, text, docId) => {
    const url = urlMap.get(docId);
    return url ? `[${text}](${url})` : full;
  });

  return resolved;
};

import { config } from '../config/index.js';

const EMBEDDING_DIMS = 768;

export const prepareText = (title: string, content: string, tags: string[] = []) => {
  const tagStr = tags.length ? `Tags: ${tags.join(', ')}` : '';
  return [title, tagStr, content].filter(Boolean).join('\n\n');
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const res = await fetch(`${config.ollama.url}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.ollama.model, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embedding failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { embeddings: number[][] };
  const embedding = data.embeddings[0];

  if (!embedding || embedding.length !== EMBEDDING_DIMS) {
    throw new Error(`Expected ${EMBEDDING_DIMS} dims, got ${embedding?.length}`);
  }

  return embedding;
};

export { EMBEDDING_DIMS };

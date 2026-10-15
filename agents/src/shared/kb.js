import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kbDir = path.resolve(here, '../../kb');

function score(text, terms) {
  const haystack = text.toLowerCase();
  return terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
}

export async function kbSearch(query, limit = 4) {
  const files = (await fs.readdir(kbDir)).filter(name => name.endsWith('.md'));
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const docs = [];

  for (const file of files) {
    const text = await fs.readFile(path.join(kbDir, file), 'utf8');
    const relevance = score(text, terms);
    if (relevance > 0) docs.push({ file, relevance, text });
  }

  return docs.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}
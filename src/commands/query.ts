import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { callLLM } from '../lib/anthropic.js';

export async function queryCommand(question: string): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const wikiDir = join(bwDir, 'wiki');

  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
  let context = '';
  for (const file of files) {
    const rel = relative(wikiDir, file);
    const content = readFileSync(file, 'utf-8');
    context += `\n\n### ${rel}\n\n${content}`;
    if (context.length > 180000) break;
  }

  const langLabel = config.language === 'ja' ? '日本語' : 'English';

  const system = `You are an expert on the "${config.projectName}" project. Answer questions using ONLY the wiki articles provided as context. If the wiki doesn't contain the answer, say so clearly.

Answer in ${langLabel}. Cite article paths when referencing facts. Be concise and structured.`;

  const user = `WIKI CONTEXT:\n${context}\n\n---\n\nQUESTION: ${question}`;

  const provider = config.provider ?? 'claude-cli';
  console.log(pc.cyan(`Querying (provider: ${provider})...`));
  const answer = await callLLM({
    model: config.model.query,
    system,
    user,
    maxTokens: 4096,
    provider,
  });

  console.log();
  console.log(answer);

  const outPath = join(bwDir, 'outputs', `query-${Date.now()}.md`);
  writeFileSync(outPath, `# Q: ${question}\n\n${answer}\n`, 'utf-8');
  console.log();
  console.log(pc.dim(`Saved to ${relative(root, outPath)}`));
}

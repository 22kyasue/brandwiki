import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const callLLM = vi.fn();
vi.mock('../lib/anthropic.js', () => ({ callLLM: (...a: unknown[]) => callLLM(...a) }));
vi.mock('../lib/notify.js', () => ({ sendNotification: vi.fn(async () => {}) }));
vi.mock('./compile.js', () => ({ compileCommand: vi.fn(async () => {}) }));

const { researchCommand } = await import('./research.js');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bw-research-'));
  mkdirSync(join(root, '.brandwiki'));
  writeFileSync(
    join(root, '.brandwiki', 'config.json'),
    JSON.stringify({
      projectName: 'test',
      model: {},
      sources: [],
      research: { competitors: [{ name: 'Alpha' }, { name: 'Beta' }] },
    })
  );
  process.env.BRANDWIKI_ROOT = root;
  process.exitCode = undefined;
  callLLM.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.BRANDWIKI_ROOT;
  process.exitCode = undefined;
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('researchCommand exit code', () => {
  it('fails when every competitor fails', async () => {
    callLLM.mockRejectedValue(new Error('boom'));
    await researchCommand({});
    expect(process.exitCode).toBe(1);
  });

  it('fails when only some competitors fail', async () => {
    callLLM.mockResolvedValueOnce('## Executive summary\n- ok').mockRejectedValueOnce(new Error('boom'));
    await researchCommand({});
    expect(process.exitCode).toBe(1);
  });

  it('treats an empty LLM response as a failure', async () => {
    callLLM.mockResolvedValue('   ');
    await researchCommand({});
    expect(process.exitCode).toBe(1);
  });

  it('succeeds when every competitor succeeds', async () => {
    callLLM.mockResolvedValue('## Executive summary\n- ok');
    await researchCommand({});
    expect(process.exitCode).toBeUndefined();
  });

  it('fails when --competitor matches nothing', async () => {
    await researchCommand({ competitor: 'Nope' });
    expect(process.exitCode).toBe(1);
    expect(callLLM).not.toHaveBeenCalled();
  });
});

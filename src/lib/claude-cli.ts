import { spawn } from 'node:child_process';

/**
 * Call Claude Code CLI (`claude -p "..."`) as a child process.
 * Uses the Pro plan subscription — no API credits consumed.
 *
 * Sends the prompt via stdin to avoid shell-escaping issues with
 * long multi-line content (raw source dumps can be hundreds of KB).
 */
export async function callClaudeCLI(params: {
  system: string;
  user: string;
  bin?: string;
  timeoutMs?: number;
  cwd?: string;
  /** Total attempts before giving up (default 3 = 1 try + 2 retries). */
  retries?: number;
}): Promise<string> {
  const attempts = Math.max(1, params.retries ?? 3);
  let lastErr: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callClaudeOnce(params);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) {
        // Exponential backoff: 2s, 4s — rides out the transient `code 1`
        // and spawn flakiness seen under fan-out / post-commit-hook load.
        const backoffMs = 2000 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  throw new Error(
    `claude CLI failed after ${attempts} attempt(s): ${lastErr?.message ?? 'unknown error'}`,
  );
}

function callClaudeOnce(params: {
  system: string;
  user: string;
  bin?: string;
  timeoutMs?: number;
  cwd?: string;
}): Promise<string> {
  const bin = params.bin ?? 'claude';
  const timeoutMs = params.timeoutMs ?? 10 * 60 * 1000;

  const fullPrompt = `${params.system}\n\n---\n\n${params.user}`;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-p', '--output-format', 'text'], {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(params.cwd ? { cwd: params.cwd } : {}),
    });

    const stdout: string[] = [];
    const stderr: string[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {}
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk.toString('utf-8')));
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString('utf-8')));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to spawn ${bin}: ${err.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = stdout.join('');
      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr.join('').slice(0, 2000)}`));
        return;
      }
      resolve(output);
    });

    try {
      child.stdin.end(fullPrompt);
    } catch (err: any) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to write stdin: ${err.message}`));
    }
  });
}

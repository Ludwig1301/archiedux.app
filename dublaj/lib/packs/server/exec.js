import { spawn } from "node:child_process";

export class CommandError extends Error {
  command;
  code;
  stderr;
  constructor(message, command, code, stderr) {
    super(message);
    this.name = "CommandError";
    this.command = command;
    this.code = code;
    this.stderr = stderr;
  }
}

const MAX_CAPTURE = 2 * 1024 * 1024;

/** Spawns a process without a shell (arguments are never interpolated). */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : null;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      if (stdout.length < MAX_CAPTURE) stdout += d;
      opts.onStdout?.(d);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > MAX_CAPTURE) stderr = stderr.slice(-MAX_CAPTURE);
      opts.onStderr?.(d);
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      const msg = err.code === "ENOENT" ? `Komut bulunamadı: ${cmd}` : err.message;
      reject(new CommandError(msg, cmd, null, stderr));
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new CommandError(`${cmd} zaman aşımına uğradı`, cmd, code, stderr));
      } else if (code !== 0) {
        const tail = stderr.trim().split("\n").slice(-8).join("\n");
        reject(new CommandError(`${cmd} hata kodu ${code} ile çıktı:\n${tail}`, cmd, code, stderr));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/** Returns true if the binary can be executed. */
export async function hasBinary(cmd, versionArgs = ["--version"]) {
  try {
    await run(cmd, versionArgs, { timeoutMs: 15000 });
    return true;
  } catch (e) {
    return e instanceof CommandError && e.code !== null; // ran but returned non-zero => exists
  }
}

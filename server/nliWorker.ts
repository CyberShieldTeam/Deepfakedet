import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export const NLI_MODEL = "cross-encoder/nli-MiniLM2-L6-H768",
  NLI_VERSION = "b95119ce93d3e065de6214e38cd4a97b0f2f2c6d";
export const NLI_CAPS = {
  startupMs: 90000,
  requestMs: 20000,
  pairs: 8,
  bytes: 65536,
  idleMs: 300000,
  restarts: 3,
  restartWindowMs: 600000,
};
const score = z.number().finite().min(0).max(1);
const scores = z
  .object({ contradiction: score, entailment: score, neutral: score })
  .strict()
  .refine((s) => Math.abs(s.contradiction + s.entailment + s.neutral - 1) < 0.001);
const item = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("executed"),
      scores,
      tokens: z.number().int().min(1).max(512),
      elapsedMs: z.number().finite().nonnegative(),
    })
    .strict(),
  z.object({ status: z.literal("input_over_limit"), tokens: z.number().int().positive() }).strict(),
  z.object({ status: z.literal("unsupported_language") }).strict(),
]);
const memory = z
  .object({
    rssBytes: z.number().int().nonnegative(),
    peakWorkingSetBytes: z.number().int().nonnegative().nullable(),
  })
  .strict();
const ready = z
  .object({
    event: z.literal("ready"),
    modelId: z.literal(NLI_MODEL),
    version: z.literal(NLI_VERSION),
    startupMs: z.number().finite().nonnegative(),
    memory,
  })
  .strict();
const reply = z
  .object({
    requestId: z.string(),
    results: z.array(item).min(1).max(8),
    elapsedMs: z.number().finite().nonnegative(),
    memory,
  })
  .strict();
export type NliPair = { premise: string; hypothesis: string; language: string };
type ReadyMessage={event:'ready';modelId:string;version:string;startupMs:number;memory:z.infer<typeof memory>};
type ReplyMessage<T>={requestId:string;results:T[];elapsedMs:number;memory:z.infer<typeof memory>};
type ModelProtocol<T>={ready:z.ZodType<ReadyMessage>;reply:z.ZodType<ReplyMessage<T>>};
export class NliWorkerError extends Error {
  constructor(public category: string) {
    super(category);
  }
}
/** Single local model worker. No request cache or cross-owner claim retention. */
export class NliWorker<T=z.infer<typeof item>> {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private waiter: ((line: string) => void) | null = null;
  private rejecter: ((error: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private busy = false;
  private starts: number[] = [];
  private startup: ReadyMessage | undefined;
  private retiring: Promise<boolean> = Promise.resolve(true);
  constructor(
    private command: string,
    private args: string[],
    private limits = NLI_CAPS,
    private protocol:ModelProtocol<T>={ready,reply} as unknown as ModelProtocol<T>,
  ) {}
  private fail(category: string) {
    this.rejecter?.(new NliWorkerError(category));
    this.waiter = null;
    this.rejecter = null;
    this.stop();
  }
  stop() {
    this.rejecter?.(new NliWorkerError("WORKER_STOPPED"));
    this.rejecter = null;
    this.waiter = null;
    clearTimeout(this.timer);
    clearTimeout(this.idle);
    const child = this.child;
    this.child = null;
    this.startup = undefined;
    this.buffer = "";
    if (child?.pid) {
      this.retiring = new Promise((resolve) => {
        let settled = false;
        const deadline = setTimeout(() => finish(false), 5000);
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          resolve(ok);
        };
        if (process.platform === "win32") {
          const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            windowsHide: true,
            stdio: "ignore",
          });
          killer.once("error", () => finish(false));
          killer.once("exit", (code) => finish(code === 0 || child.exitCode !== null));
        } else {
          child.once("exit", () => finish(true));
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch {
            finish(child.exitCode !== null);
          }
        }
      });
    }
  }
  private line(timeout: number) {
    return new Promise<string>((resolve, reject) => {
      this.waiter = (line) => {
        clearTimeout(this.timer);
        this.waiter = null;
        this.rejecter = null;
        resolve(line);
      };
      this.rejecter = reject;
      this.timer = setTimeout(() => this.fail("TIMEOUT"), timeout);
    });
  }
  private async load() {
    if (!(await this.retiring)) throw new NliWorkerError("WORKER_STOP_FAILED");
    if (this.child && this.startup) return;
    this.starts = this.starts.filter((t) => Date.now() - t < this.limits.restartWindowMs);
    if (this.starts.length >= this.limits.restarts)
      throw new NliWorkerError("RESTART_BUDGET_EXHAUSTED");
    this.starts.push(Date.now());
    const loading = this.line(this.limits.startupMs);
    const env = {
      ...process.env,
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      OMP_NUM_THREADS: "2",
      MKL_NUM_THREADS: "2",
    };
    for (const name of Object.keys(env))
      if (/TOKEN|SECRET|PASSWORD|API_KEY|^VERITAS_USERS$|^VERITAS_STORE$/i.test(name))
        delete env[name];
    const child = spawn(this.command, this.args, {
      windowsHide: true,
      detached: process.platform !== "win32",
      env,
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (this.child !== child) return;
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer) > this.limits.bytes) {
        this.fail("OUTPUT_LIMIT");
        return;
      }
      let pos: number;
      while ((pos = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, pos);
        this.buffer = this.buffer.slice(pos + 1);
        if (!this.waiter) {
          this.fail("UNEXPECTED_PROTOCOL_OUTPUT");
          return;
        }
        this.waiter(line);
      }
    });
    // Drain, but never retain/echo stderr: library logs can contain paths or source text.
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {
      if (this.child === child) this.fail("WORKER_PIPE_FAILED");
    });
    child.once("error", () => {
      if (this.child === child) this.fail("WORKER_START_FAILED");
    });
    child.once("exit", () => {
      if (this.child === child) this.fail("WORKER_EXITED");
    });
    const message = JSON.parse(await loading);
    if (message?.event === "unavailable")
      throw new NliWorkerError(
        [
          "INSUFFICIENT_MEMORY_HEADROOM",
          "SNAPSHOT_MISSING",
          "PINNED_SIZE_MISMATCH",
          "PINNED_HASH_MISMATCH",
          "UNEXPECTED_LABEL_MAPPING",
        ].includes(message.category)
          ? message.category
          : "MODEL_LOAD_FAILED",
      );
    this.startup = this.protocol.ready.parse(message);
  }
  async infer(pairs: NliPair[]) {
    if (this.busy) throw new NliWorkerError("BUSY");
    if (
      !pairs.length ||
      pairs.length > this.limits.pairs ||
      pairs.some(
        (p) =>
          !p.premise || p.premise.length > 10000 || !p.hypothesis || p.hypothesis.length > 1000,
      )
    )
      throw new NliWorkerError("INPUT_LIMIT");
    this.busy = true;
    clearTimeout(this.idle);
    try {
      await this.load();
      const requestId = randomUUID(),
        line = JSON.stringify({ requestId, pairs }) + "\n";
      if (Buffer.byteLength(line) > this.limits.bytes) throw new NliWorkerError("INPUT_LIMIT");
      const output = this.line(this.limits.requestMs);
      this.child!.stdin.write(line);
      const parsed = this.protocol.reply.parse(JSON.parse(await output));
      if (parsed.requestId !== requestId || parsed.results.length !== pairs.length)
        throw new NliWorkerError("MISMATCHED_RESPONSE");
      return { ...parsed, startupMs: this.startup!.startupMs };
    } catch (error) {
      this.stop();
      throw error instanceof NliWorkerError
        ? error
        : new NliWorkerError("INVALID_OR_FAILED_RESPONSE");
    } finally {
      this.busy = false;
      if (this.child) {
        this.idle = setTimeout(() => this.stop(), this.limits.idleMs);
        this.idle.unref();
      }
    }
  }
}
let worker: NliWorker | undefined,
  key = "";
export async function runNli(pairs: NliPair[]) {
  const config = JSON.stringify([
    process.env.VERITAS_NLI_PYTHON,
    process.env.VERITAS_NLI_MODEL_PATH,
  ]);
  if (config !== key) {
    worker?.stop();
    key = config;
    worker = undefined;
  }
  if (!worker)
    worker = new NliWorker(process.env.VERITAS_NLI_PYTHON || "python", [
      "-u",
      "-m",
      "ai_service.claim_nli",
      "--worker",
      "--snapshot",
      process.env.VERITAS_NLI_MODEL_PATH || "",
    ]);
  return worker.infer(pairs);
}
export function shutdownNli() {
  worker?.stop();
  worker = undefined;
}
process.once("exit", shutdownNli);

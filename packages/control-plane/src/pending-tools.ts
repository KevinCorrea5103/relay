type Key = `${string}:${string}`;

type Waiter = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

export class PendingTools {
  private waiters = new Map<Key, Waiter>();
  private results = new Map<Key, { value: unknown; gc: NodeJS.Timeout }>();

  private static makeKey(runId: string, toolUseId: string): Key {
    return `${runId}:${toolUseId}`;
  }

  wait(runId: string, toolUseId: string, timeoutMs: number): Promise<unknown> {
    const key = PendingTools.makeKey(runId, toolUseId);

    const buffered = this.results.get(key);
    if (buffered) {
      clearTimeout(buffered.gc);
      this.results.delete(key);
      return Promise.resolve(buffered.value);
    }

    if (this.waiters.has(key)) {
      return Promise.reject(new Error(`already awaiting result for ${key}`));
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(key);
        reject(new Error("tool result timed out"));
      }, timeoutMs);
      this.waiters.set(key, { resolve, reject, timer });
    });
  }

  resolve(runId: string, toolUseId: string, value: unknown): void {
    const key = PendingTools.makeKey(runId, toolUseId);
    const waiter = this.waiters.get(key);
    if (waiter) {
      clearTimeout(waiter.timer);
      this.waiters.delete(key);
      waiter.resolve(value);
      return;
    }
    const gc = setTimeout(() => this.results.delete(key), 60_000);
    this.results.set(key, { value, gc });
  }
}

export const pendingTools = new PendingTools();

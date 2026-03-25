// ---------------------------------------------------------------------------
// Matrix Operator – AI Call Queue
// Rate-limits concurrent Haiku API calls to prevent overload.
// ---------------------------------------------------------------------------

type QueuedCall = () => Promise<void>;

class AICallQueue {
  private queue: QueuedCall[] = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(fn: QueuedCall): void {
    this.queue.push(fn);
    this.processNext();
  }

  private processNext(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const fn = this.queue.shift()!;
      this.running++;
      fn()
        .catch(() => {
          // Silently handle errors — callers handle their own fallbacks
        })
        .finally(() => {
          this.running--;
          this.processNext();
        });
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.running;
  }
}

/** Shared singleton queue for all AI calls */
export const aiCallQueue = new AICallQueue(2);

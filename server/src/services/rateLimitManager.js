import crypto from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const STATE_FILE = '/tmp/rl_state.json';

// How often to flush counters to disk (ms). Avoids a writeFileSync on every request.
const SAVE_DEBOUNCE_MS = 5000;

class RateLimitManager {
  constructor() {
    // Per-model in-flight request sets (for true concurrency tracking)
    this.inFlight = {};

    // Model limit configurations (RPM, TPM, RPD, TPD)
    this.configs = {
      'cerebras-120b': {
        rpm: 30,
        tpm: 60000,     // 60,000 TPM
        rpd: 1000,      // 1,000 RPD
        tpd: 1000000,   // 1M tokens/day
      },
      'groq-70b': {
        rpm: 30,
        tpm: 6000,      // 6,000 TPM
        rpd: 1000,
        tpd: 500000,
      },
      'groq-8b': {
        rpm: 30,
        tpm: 6000,      // 6,000 TPM
        rpd: 14400,     // 14,400 RPD
        tpd: 1000000,
      },
      'groq-scout': {   // Llama 4 Scout
        rpm: 30,
        tpm: 6000,
        rpd: 1000,
        tpd: 500000,
      },
      'gemini': {
        rpm: 15,
        tpm: 1000000,   // Gemini 2.0 Flash: very generous TPM
        rpd: 1500,
        tpd: 5000000,
      },
      'gemini-pro':    { rpm: 15,  tpm: 360000,  rpd: 1000,  tpd: 3000000  },
      'cloudflare-llama-3.2-vision': { rpm: 50,  tpm: 100000, rpd: 1000,  tpd: 1000000  },
    };

    // Budgets / Counters
    this.counters = {};
    for (const k of Object.keys(this.configs)) {
      this.counters[k] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
      this.inFlight[k] = new Set();
    }

    // Last reset times
    const now = Date.now();
    this.lastMinuteReset = {};
    this.lastDayReset    = {};
    for (const k of Object.keys(this.configs)) {
      this.lastMinuteReset[k] = now;
      this.lastDayReset[k]    = now;
    }

    // Cooldown periods (timestamps when blocked until due to 429)
    this.cooldownUntil = {};
    for (const k of Object.keys(this.configs)) this.cooldownUntil[k] = 0;

    // Queues – stored as arrays for O(1) shift
    this.highPriorityQueue = [];
    this.lowPriorityQueue  = [];

    // Queue processing loop state
    this._loopRunning = false;

    // Debounced save handle
    this._saveTimer = null;

    this.loadState();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  loadState() {
    if (existsSync(STATE_FILE)) {
      try {
        const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
        if (saved.counters)     this.counters     = { ...this.counters,     ...saved.counters };
        if (saved.lastDayReset) this.lastDayReset = { ...this.lastDayReset, ...saved.lastDayReset };
        console.log('[RateLimitManager] Loaded persisted state from', STATE_FILE);
      } catch (err) {
        console.error('[RateLimitManager] Failed to load state:', err.message);
      }
    }
  }

  /**
   * Debounced save — coalesces rapid reserveBudget / refundBudget / adjustBudget
   * calls into a single disk write every SAVE_DEBOUNCE_MS milliseconds.
   * FIX #7: removes synchronous writeFileSync from the hot path.
   */
  saveState() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        writeFileSync(STATE_FILE, JSON.stringify({
          counters:     this.counters,
          lastDayReset: this.lastDayReset,
        }));
      } catch (err) {
        console.error('[RateLimitManager] Failed to save state:', err.message);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  // ─── Counter management ───────────────────────────────────────────────────────

  resetCounters(modelKey) {
    const now = Date.now();
    if (now - this.lastMinuteReset[modelKey] >= 60000) {
      this.counters[modelKey].reqMinute    = 0;
      this.counters[modelKey].tokensMinute = 0;
      this.lastMinuteReset[modelKey]       = now;
    }
    if (now - this.lastDayReset[modelKey] >= 86400000) {
      this.counters[modelKey].reqDay    = 0;
      this.counters[modelKey].tokensDay = 0;
      this.lastDayReset[modelKey]       = now;
      this.saveState();
    }
  }

  canMakeRequest(modelKey, estimatedTokens) {
    this.resetCounters(modelKey);
    const now = Date.now();

    if (now < this.cooldownUntil[modelKey]) {
      const waitTime = Math.ceil((this.cooldownUntil[modelKey] - now) / 1000);
      return { allowed: false, reason: `Cooling down for ${waitTime}s due to upstream 429` };
    }

    const config  = this.configs[modelKey];
    const counter = this.counters[modelKey];

    if (counter.reqMinute >= config.rpm)
      return { allowed: false, reason: 'RPM limit reached' };

    if (counter.tokensMinute + estimatedTokens > config.tpm)
      return { allowed: false, reason: `TPM limit reached. Est: ${estimatedTokens}, Remaining: ${config.tpm - counter.tokensMinute}` };

    if (counter.reqDay >= config.rpd)
      return { allowed: false, reason: 'RPD limit reached' };

    if (counter.tokensDay + estimatedTokens > config.tpd)
      return { allowed: false, reason: 'TPD limit reached' };

    return { allowed: true };
  }

  reserveBudget(modelKey, estimatedTokens) {
    this.resetCounters(modelKey);
    this.counters[modelKey].reqMinute    += 1;
    this.counters[modelKey].reqDay       += 1;
    this.counters[modelKey].tokensMinute += estimatedTokens;
    this.counters[modelKey].tokensDay    += estimatedTokens;
    this.saveState(); // debounced — no blocking I/O on hot path
  }

  refundBudget(modelKey, estimatedTokens) {
    this.counters[modelKey].reqMinute    = Math.max(0, this.counters[modelKey].reqMinute    - 1);
    this.counters[modelKey].reqDay       = Math.max(0, this.counters[modelKey].reqDay       - 1);
    this.counters[modelKey].tokensMinute = Math.max(0, this.counters[modelKey].tokensMinute - estimatedTokens);
    this.counters[modelKey].tokensDay    = Math.max(0, this.counters[modelKey].tokensDay    - estimatedTokens);
    this.saveState();
  }

  adjustBudget(modelKey, estimatedTokens, actualTokens) {
    const diff = actualTokens - estimatedTokens;
    this.counters[modelKey].tokensMinute = Math.max(0, this.counters[modelKey].tokensMinute + diff);
    this.counters[modelKey].tokensDay    = Math.max(0, this.counters[modelKey].tokensDay    + diff);
    this.saveState();
  }

  setCooldown(modelKey, durationMs) {
    this.cooldownUntil[modelKey] = Date.now() + durationMs;
  }

  // ─── Token estimation ─────────────────────────────────────────────────────────

  /**
   * FIX #5: Removed the previous `Math.ceil(defaultMaxTokens * 0.5)` padding that
   * doubled effective token estimates and caused false TPM rejections.
   * We now add a flat 512-token completion buffer — conservative but not punishing.
   */
  estimateTokens(messages, _defaultMaxTokens = 2048) {
    let text = '';
    let imageCount = 0;

    const inspectPart = (part) => {
      if (typeof part === 'string') {
        if (
          (part.startsWith('data:image/') && part.includes(';base64,')) ||
          (part.length > 5000 && /^[A-Za-z0-9+/=]+$/.test(part.substring(0, 100)))
        ) {
          imageCount++;
          return;
        }
        text += part;
      } else if (part && typeof part === 'object') {
        if      (part.type === 'text')      text += part.text || '';
        else if (part.type === 'image_url') imageCount++;
        else if (part.inlineData || part.inline_data) imageCount++;
        else if (part.text)                 text += part.text;
        else { for (const key in part) inspectPart(part[key]); }
      }
    };

    if (Array.isArray(messages)) {
      messages.forEach(m => {
        if (m.content) {
          Array.isArray(m.content) ? m.content.forEach(inspectPart) : inspectPart(m.content);
        } else if (m.parts) {
          Array.isArray(m.parts) ? m.parts.forEach(inspectPart) : inspectPart(m.parts);
        } else {
          inspectPart(m);
        }
      });
    } else {
      inspectPart(messages);
    }

    const promptTokens = Math.ceil(text.length / 3.7);
    const imageTokens  = imageCount * 1000;
    return promptTokens + imageTokens + 512; // flat completion buffer
  }

  // ─── Enqueue ──────────────────────────────────────────────────────────────────

  enqueue(fn, modelKey, messages, priority = 'low', maxRetries = 3, failFast = false) {
    return new Promise((resolve, reject) => {
      const estimatedTokens = this.estimateTokens(messages);

      if (failFast) {
        const decision = this.canMakeRequest(modelKey, estimatedTokens);
        if (!decision.allowed) {
          const err = new Error(`Rate limit pre-check failed for ${modelKey}: ${decision.reason}`);
          err.status = 429;
          err.isRateLimit = true;
          return reject(err);
        }
      }

      const queueItem = {
        id: crypto.randomUUID(),
        fn,
        modelKey,
        estimatedTokens,
        priority,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        failFast,
        createdAt: Date.now(),
      };

      if (priority === 'high') {
        this.highPriorityQueue.push(queueItem);
      } else {
        this.lowPriorityQueue.push(queueItem);
      }

      // Kick the loop — it's a no-op if already running
      this._drainQueue();
    });
  }

  // ─── Queue drain loop ─────────────────────────────────────────────────────────

  /**
   * FIX #1 + #2 + #4:
   *
   * Old behaviour: a single `isProcessing` mutex ran one item at a time, breaking
   * out of the scan loop after every dispatch and busy-waiting every 50 ms.
   *
   * New behaviour:
   *  - Items are dispatched *immediately* as capacity allows, without waiting for
   *    previous items to complete (they run concurrently via `_executeRequest`).
   *  - The loop checks all queued items each tick and fires as many as the budget
   *    allows.
   *  - When nothing can be dispatched, we wait until the soonest cooldown expires
   *    (or 60 s for a minute-counter reset) instead of spinning every 50 ms.
   *  - A second call to `_drainQueue` while the loop is running is a no-op.
   */
  async _drainQueue() {
    if (this._loopRunning) return;
    this._loopRunning = true;

    try {
      while (this.highPriorityQueue.length > 0 || this.lowPriorityQueue.length > 0) {
        let dispatched = false;

        // Process high-priority first, then low
        for (const queue of [this.highPriorityQueue, this.lowPriorityQueue]) {
          let i = 0;
          while (i < queue.length) {
            const item = queue[i];
            const decision = this.canMakeRequest(item.modelKey, item.estimatedTokens);
            if (decision.allowed) {
              queue.splice(i, 1); // remove from queue
              this.reserveBudget(item.modelKey, item.estimatedTokens);
              this._executeRequest(item); // fire-and-forget (concurrent)
              dispatched = true;
              // Don't increment i — re-check same slot (queue shifted left)
            } else {
              i++;
            }
          }
        }

        if (!dispatched) {
          // Nothing could be dispatched — sleep until the soonest wake-up event
          const sleepMs = this._msUntilNextSlot();
          await new Promise(r => setTimeout(r, sleepMs));
        }
      }
    } finally {
      this._loopRunning = false;
    }
  }

  /**
   * Compute the minimum wait time before any queued item might become dispatchable.
   * Considers: minute counter resets and active cooldowns.
   */
  _msUntilNextSlot() {
    const now = Date.now();
    let soonest = 60000; // worst case: wait for the next minute reset

    const allItems = [...this.highPriorityQueue, ...this.lowPriorityQueue];
    const uniqueModels = [...new Set(allItems.map(i => i.modelKey))];

    for (const modelKey of uniqueModels) {
      // Time until minute counter resets
      const msSinceMinuteReset = now - this.lastMinuteReset[modelKey];
      const msUntilMinuteReset = Math.max(0, 60000 - msSinceMinuteReset);
      if (msUntilMinuteReset > 0) soonest = Math.min(soonest, msUntilMinuteReset);

      // Time until 429 cooldown expires
      const cooldownRemaining = Math.max(0, this.cooldownUntil[modelKey] - now);
      if (cooldownRemaining > 0) soonest = Math.min(soonest, cooldownRemaining);
    }

    // Floor at 50 ms to avoid degenerate zero-sleep loops
    return Math.max(50, soonest);
  }

  // ─── Request execution ────────────────────────────────────────────────────────

  async _executeRequest(item) {
    const { fn, modelKey, estimatedTokens, resolve, reject, failFast } = item;
    try {
      const result = await fn();

      // Reconcile actual token usage
      let actualTokens = estimatedTokens;
      if (result && typeof result === 'object') {
        const usage = result.usage || result.data?.usage;
        if (usage?.total_tokens) {
          actualTokens = usage.total_tokens;
        } else if (result.candidates?.[0]?.usageMetadata?.totalTokenCount) {
          actualTokens = result.candidates[0].usageMetadata.totalTokenCount;
        }
      }

      this.adjustBudget(modelKey, estimatedTokens, actualTokens);
      resolve(result);
    } catch (err) {
      this.refundBudget(modelKey, estimatedTokens);

      const isRateLimit =
        err.response?.status === 429 ||
        err.status === 429 ||
        err.message?.includes('429') ||
        err.message?.includes('Too Many Requests');

      if (isRateLimit && !failFast && item.retries < item.maxRetries) {
        item.retries += 1;

        let retryAfterMs = 2000 * Math.pow(2, item.retries); // exponential backoff
        const retryAfterHeader =
          err.response?.headers?.['retry-after'] || err.headers?.['retry-after'];
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed)) retryAfterMs = parsed * 1000;
        }

        console.warn(
          `[RateLimitManager] 429 on ${modelKey}. Cooldown ${retryAfterMs}ms. ` +
          `Retry ${item.retries}/${item.maxRetries}`
        );
        this.setCooldown(modelKey, retryAfterMs);

        // Re-queue at head for priority
        if (item.priority === 'high') {
          this.highPriorityQueue.unshift(item);
        } else {
          this.lowPriorityQueue.unshift(item);
        }

        // Wake the drain loop (no-op if already running)
        this._drainQueue();
      } else {
        reject(err);
      }
    }
  }

  // Keep old name as alias so nothing breaks if called externally
  async executeRequest(item) { return this._executeRequest(item); }
  async processQueue()       { return this._drainQueue(); }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  getStats() {
    const now = Date.now();
    return {
      highQueueLength: this.highPriorityQueue.length,
      lowQueueLength:  this.lowPriorityQueue.length,
      counters:        this.counters,
      cooldowns: Object.fromEntries(
        Object.keys(this.configs).map(k => [k, Math.max(0, this.cooldownUntil[k] - now)])
      ),
    };
  }
}

export const rateLimitManager = new RateLimitManager();

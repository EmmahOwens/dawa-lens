import crypto from 'crypto';

class RateLimitManager {
  constructor() {
    // Queues
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];

    // Model limit configurations (RPM, TPM, RPD, TPD)
    this.configs = {
      'groq-70b': {
        rpm: 30,
        tpm: 14000,
        rpd: 1000,
        tpd: 500000,
      },
      'groq-8b': {
        rpm: 30,
        tpm: 28000,
        rpd: 14400,
        tpd: 1000000,
      },
      'gemini': {
        rpm: 15,
        tpm: 500000,
        rpd: 1500,
        tpd: 5000000,
      }
    };

    // Budgets / Counters
    this.counters = {
      'groq-70b': { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 },
      'groq-8b': { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 },
      'gemini': { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 }
    };

    // Last reset times
    this.lastMinuteReset = { 'groq-70b': Date.now(), 'groq-8b': Date.now(), 'gemini': Date.now() };
    this.lastDayReset = { 'groq-70b': Date.now(), 'groq-8b': Date.now(), 'gemini': Date.now() };

    // Cooldown periods (timestamps when blocked until due to 429)
    this.cooldownUntil = { 'groq-70b': 0, 'groq-8b': 0, 'gemini': 0 };

    this.isProcessing = false;
  }

  // Reset counters if minute/day has elapsed
  resetCounters(modelKey) {
    const now = Date.now();
    
    // Minute reset (60 seconds)
    if (now - this.lastMinuteReset[modelKey] >= 60000) {
      this.counters[modelKey].reqMinute = 0;
      this.counters[modelKey].tokensMinute = 0;
      this.lastMinuteReset[modelKey] = now;
    }

    // Day reset (24 hours)
    if (now - this.lastDayReset[modelKey] >= 86400000) {
      this.counters[modelKey].reqDay = 0;
      this.counters[modelKey].tokensDay = 0;
      this.lastDayReset[modelKey] = now;
    }
  }

  // Pre-emptively check if a request can be made
  canMakeRequest(modelKey, estimatedTokens) {
    this.resetCounters(modelKey);
    const now = Date.now();

    // Check if model is cooling down due to 429
    if (now < this.cooldownUntil[modelKey]) {
      return { allowed: false, reason: `Cooling down until ${new Date(this.cooldownUntil[modelKey]).toISOString()}` };
    }

    const config = this.configs[modelKey];
    const counter = this.counters[modelKey];

    // RPM Check
    if (counter.reqMinute >= config.rpm) {
      return { allowed: false, reason: 'RPM limit reached' };
    }

    // TPM Check
    if (counter.tokensMinute + estimatedTokens > config.tpm) {
      return { allowed: false, reason: 'TPM limit reached' };
    }

    // RPD Check
    if (counter.reqDay >= config.rpd) {
      return { allowed: false, reason: 'RPD limit reached' };
    }

    // TPD Check
    if (counter.tokensDay + estimatedTokens > config.tpd) {
      return { allowed: false, reason: 'TPD limit reached' };
    }

    return { allowed: true };
  }

  // Pre-emptively reserve budget when dispatching a request
  reserveBudget(modelKey, estimatedTokens) {
    this.resetCounters(modelKey);
    this.counters[modelKey].reqMinute += 1;
    this.counters[modelKey].reqDay += 1;
    this.counters[modelKey].tokensMinute += estimatedTokens;
    this.counters[modelKey].tokensDay += estimatedTokens;
  }

  // Refund reserved budget if request fails
  refundBudget(modelKey, estimatedTokens) {
    this.counters[modelKey].reqMinute = Math.max(0, this.counters[modelKey].reqMinute - 1);
    this.counters[modelKey].reqDay = Math.max(0, this.counters[modelKey].reqDay - 1);
    this.counters[modelKey].tokensMinute = Math.max(0, this.counters[modelKey].tokensMinute - estimatedTokens);
    this.counters[modelKey].tokensDay = Math.max(0, this.counters[modelKey].tokensDay - estimatedTokens);
  }

  // Adjust reserved budget with actual token usage on success
  adjustBudget(modelKey, estimatedTokens, actualTokens) {
    const diff = actualTokens - estimatedTokens;
    this.counters[modelKey].tokensMinute = Math.max(0, this.counters[modelKey].tokensMinute + diff);
    this.counters[modelKey].tokensDay = Math.max(0, this.counters[modelKey].tokensDay + diff);
  }

  // Add cooldown block
  setCooldown(modelKey, durationMs) {
    this.cooldownUntil[modelKey] = Date.now() + durationMs;
  }

  // Estimate tokens in prompt/messages
  estimateTokens(messages, defaultMaxTokens = 800) {
    let text = '';
    if (typeof messages === 'string') {
      text = messages;
    } else if (Array.isArray(messages)) {
      text = messages.map(m => `${m.role || ''} ${m.content || ''}`).join(' ');
    } else {
      text = JSON.stringify(messages) || '';
    }
    const promptTokens = Math.ceil(text.length / 3.7);
    return promptTokens + defaultMaxTokens;
  }

  // Enqueue a request
  enqueue(fn, modelKey, messages, priority = 'low', maxRetries = 3) {
    return new Promise((resolve, reject) => {
      const estimatedTokens = this.estimateTokens(messages);
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
        createdAt: Date.now()
      };

      if (priority === 'high') {
        this.highPriorityQueue.push(queueItem);
      } else {
        this.lowPriorityQueue.push(queueItem);
      }

      this.processQueue();
    });
  }

  // Core processing loop
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.highPriorityQueue.length > 0 || this.lowPriorityQueue.length > 0) {
        let item = null;
        let isHigh = false;

        if (this.highPriorityQueue.length > 0) {
          item = this.highPriorityQueue[0];
          isHigh = true;
        } else if (this.lowPriorityQueue.length > 0) {
          item = this.lowPriorityQueue[0];
          isHigh = false;
        }

        if (!item) break;

        const { modelKey, estimatedTokens } = item;
        const decision = this.canMakeRequest(modelKey, estimatedTokens);

        if (!decision.allowed) {
          // Budget not available, sleep briefly and try again
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }

        // Shift item from queue since we are dispatching it
        if (isHigh) {
          this.highPriorityQueue.shift();
        } else {
          this.lowPriorityQueue.shift();
        }

        // Pre-emptively reserve budget
        this.reserveBudget(modelKey, estimatedTokens);

        // Execute asynchronous request in the background
        this.executeRequest(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async executeRequest(item) {
    const { fn, modelKey, estimatedTokens, resolve, reject } = item;
    try {
      const result = await fn();
      
      // Determine actual token usage from response
      let actualTokens = estimatedTokens;
      if (result && typeof result === 'object') {
        // Groq usage format
        const usage = result.usage || result.data?.usage;
        if (usage && usage.total_tokens) {
          actualTokens = usage.total_tokens;
        } else if (result.candidates?.[0]?.usageMetadata) {
          // Gemini usage format
          const geminiUsage = result.candidates[0].usageMetadata;
          if (geminiUsage.totalTokenCount) {
            actualTokens = geminiUsage.totalTokenCount;
          }
        }
      }

      this.adjustBudget(modelKey, estimatedTokens, actualTokens);
      resolve(result);
    } catch (err) {
      // Refund the reserved budget
      this.refundBudget(modelKey, estimatedTokens);

      const isRateLimit = err.response?.status === 429 || err.status === 429 || err.message?.includes('429') || err.message?.includes('Too Many Requests');
      
      if (isRateLimit && item.retries < item.maxRetries) {
        item.retries += 1;
        
        let retryAfterMs = 2000 * Math.pow(2, item.retries);
        const retryAfterHeader = err.response?.headers?.['retry-after'] || err.headers?.['retry-after'];
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed)) {
            retryAfterMs = parsed * 1000;
          }
        }
        
        console.warn(`[RateLimitManager] 429 Rate limit hit for ${modelKey}. Cooling down for ${retryAfterMs}ms. Retry ${item.retries}/${item.maxRetries}`);
        this.setCooldown(modelKey, retryAfterMs);

        // Put request back at the head of the queue to retry
        if (item.priority === 'high') {
          this.highPriorityQueue.unshift(item);
        } else {
          this.lowPriorityQueue.unshift(item);
        }

        this.processQueue();
      } else {
        reject(err);
      }
    }
  }

  getStats() {
    return {
      highQueueLength: this.highPriorityQueue.length,
      lowQueueLength: this.lowPriorityQueue.length,
      counters: this.counters,
      cooldowns: {
        'groq-70b': Math.max(0, this.cooldownUntil['groq-70b'] - Date.now()),
        'groq-8b': Math.max(0, this.cooldownUntil['groq-8b'] - Date.now()),
        'gemini': Math.max(0, this.cooldownUntil['gemini'] - Date.now())
      }
    };
  }
}

export const rateLimitManager = new RateLimitManager();

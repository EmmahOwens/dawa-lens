import { rateLimitManager } from './services/rateLimitManager.js';

async function runTests() {
  console.log("🧪 Starting RateLimitManager Unit Tests...");

  // Save original config
  const originalConfig = { ...rateLimitManager.configs['groq-8b'] };

  // ==========================================
  // Test 1: Priority Queuing Test
  // ==========================================
  console.log("\n--- Test 1: Priority Queuing ---");
  
  // Set RPM limit to 1
  rateLimitManager.configs['groq-8b'] = {
    rpm: 1,
    tpm: 10000,
    rpd: 100,
    tpd: 100000
  };
  rateLimitManager.counters['groq-8b'] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
  rateLimitManager.cooldownUntil['groq-8b'] = 0;

  const completedTasks = [];
  let resolveBlocker;
  const blockerPromise = new Promise(res => { resolveBlocker = res; });

  const makeTask = (name) => {
    return async () => {
      if (name === 'Task1') {
        // Task1 blocks the queue processing to let others pile up
        await blockerPromise;
      }
      return { usage: { total_tokens: 100 }, name };
    };
  };

  const runAndRecord = async (name, priority) => {
    const res = await rateLimitManager.enqueue(makeTask(name), 'groq-8b', 'hello', priority);
    completedTasks.push(name);
    return res;
  };

  // Enqueue low priority tasks first
  const p1 = runAndRecord('Task1', 'low');
  
  // Wait briefly to make sure Task1 is running and has incremented counters
  await new Promise(res => setTimeout(res, 30));
  
  const p2 = runAndRecord('Task2', 'low');
  const p3 = runAndRecord('Task3', 'low');
  
  // Wait briefly to guarantee the low-priority tasks are enqueued
  await new Promise(res => setTimeout(res, 30));
  
  // Enqueue high priority Task4
  const p4 = runAndRecord('Task4', 'high');

  // Unblock Task1
  resolveBlocker();
  await p1; // Wait for Task1 to complete

  // Now, simulate reset so that the next request can execute
  console.log("Simulating reset for Task4 (high priority)...");
  rateLimitManager.lastMinuteReset['groq-8b'] = Date.now() - 61000;
  
  // Wait for Task4 to finish (should be next because of high priority)
  await p4;

  // Simulate resets for low-priority tasks
  console.log("Simulating reset for Task2...");
  rateLimitManager.lastMinuteReset['groq-8b'] = Date.now() - 61000;
  await p2;

  console.log("Simulating reset for Task3...");
  rateLimitManager.lastMinuteReset['groq-8b'] = Date.now() - 61000;
  await p3;

  console.log("Order of completion:", completedTasks);
  
  // Task1 executes first since it started processing immediately.
  // When Task1 completes, Task4 (high priority) should execute before Task2 and Task3.
  if (completedTasks[0] === 'Task1' && completedTasks[1] === 'Task4') {
    console.log("✅ Priority Queue Test Passed!");
  } else {
    console.error("❌ Priority Queue Test Failed. Expected ['Task1', 'Task4', ...]");
  }

  // ==========================================
  // Test 2: RPM Rate Limiting Test
  // ==========================================
  console.log("\n--- Test 2: RPM Rate Limiting ---");
  
  // Set RPM limit to 2
  rateLimitManager.configs['groq-8b'] = {
    rpm: 2,
    tpm: 10000,
    rpd: 100,
    tpd: 100000
  };
  rateLimitManager.counters['groq-8b'] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
  rateLimitManager.lastMinuteReset['groq-8b'] = Date.now();

  let t3Completed = false;

  const t1 = rateLimitManager.enqueue(() => Promise.resolve({ usage: { total_tokens: 50 } }), 'groq-8b', 'hello', 'high');
  
  // Wait briefly to make sure t1 is dispatched and has incremented counters
  await new Promise(res => setTimeout(res, 30));
  
  const t2 = rateLimitManager.enqueue(() => Promise.resolve({ usage: { total_tokens: 50 } }), 'groq-8b', 'hello', 'high');

  // Wait briefly to make sure t2 is dispatched and has incremented counters
  await new Promise(res => setTimeout(res, 30));
  
  // Enqueue t3 (should block since RPM is 2)
  const t3 = rateLimitManager.enqueue(() => Promise.resolve({ usage: { total_tokens: 50 } }), 'groq-8b', 'hello', 'high')
    .then(res => { t3Completed = true; return res; });

  await Promise.all([t1, t2]);
  await new Promise(res => setTimeout(res, 200));
  
  console.log("First 2 requests completed. Is third pending?", !t3Completed);
  if (!t3Completed) {
    console.log("✅ Third request is correctly throttled by RPM limit.");
  } else {
    console.error("❌ RPM Throttling Failed: Third request completed immediately.");
  }

  // Simulate 1 minute passing to reset the rate limit counters
  console.log("Simulating minute reset...");
  rateLimitManager.lastMinuteReset['groq-8b'] = Date.now() - 61000;
  
  // Wait for the throttled request to process
  await t3;
  console.log("After simulated time reset, is third completed?", t3Completed);
  if (t3Completed) {
    console.log("✅ Third request completed successfully after reset.");
  } else {
    console.error("❌ Third request failed to complete after reset.");
  }

  // ==========================================
  // Test 3: 429 Cooldown and Retry Test
  // ==========================================
  console.log("\n--- Test 3: 429 Cooldown and Retries ---");
  
  rateLimitManager.configs['groq-8b'] = { rpm: 10, tpm: 10000, rpd: 100, tpd: 100000 };
  rateLimitManager.counters['groq-8b'] = { reqMinute: 0, reqDay: 0, tokensMinute: 0, tokensDay: 0 };
  rateLimitManager.cooldownUntil['groq-8b'] = 0;

  let attempt = 0;
  const flakyTask = async () => {
    attempt++;
    if (attempt === 1) {
      console.log("  [flakyTask] Simulating 429 Too Many Requests on attempt 1");
      const err = new Error("Too Many Requests");
      err.status = 429;
      err.response = { headers: { 'retry-after': '1' } }; // Retry after 1 second
      throw err;
    }
    console.log("  [flakyTask] Success on attempt 2");
    return { usage: { total_tokens: 50 }, attempt };
  };

  const start429 = Date.now();
  const res429 = await rateLimitManager.enqueue(flakyTask, 'groq-8b', 'hello', 'high');
  const elapsed429 = Date.now() - start429;
  
  console.log(`Request completed in ${elapsed429}ms with result:`, res429);
  if (res429.attempt === 2 && elapsed429 >= 1000) {
    console.log("✅ 429 Cooldown and Retry Test Passed!");
  } else {
    console.error("❌ 429 Cooldown and Retry Test Failed.");
  }

  // Restore original config
  rateLimitManager.configs['groq-8b'] = originalConfig;
  console.log("\n🎉 All tests completed!");
}

runTests().catch(console.error);

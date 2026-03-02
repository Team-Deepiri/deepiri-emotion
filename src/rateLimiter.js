/**
 * Simple rate limiter (NeuralGPTOS-inspired) for bus messages and memory ops.
 * Token-bucket style: refill per second, max burst.
 */

export function createRateLimiter(opts = {}) {
  const {
    messagesPerSecond = 100,
    memoryOpsPerSecond = 200,
    maxBurstMessages = 50,
    maxBurstMemoryOps = 100
  } = opts;

  let messageTokens = maxBurstMessages;
  let memoryTokens = maxBurstMemoryOps;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    if (elapsed <= 0) return;
    lastRefill = now;
    messageTokens = Math.min(maxBurstMessages, messageTokens + elapsed * messagesPerSecond);
    memoryTokens = Math.min(maxBurstMemoryOps, memoryTokens + elapsed * memoryOpsPerSecond);
  }

  return {
    tryConsumeMessage() {
      refill();
      if (messageTokens >= 1) {
        messageTokens -= 1;
        return true;
      }
      return false;
    },
    tryConsumeMemoryOp() {
      refill();
      if (memoryTokens >= 1) {
        memoryTokens -= 1;
        return true;
      }
      return false;
    }
  };
}

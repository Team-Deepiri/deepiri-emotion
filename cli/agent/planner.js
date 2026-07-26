export const createSimplePlan = (userText) => {
  const lowerText = userText.toLowerCase();
  const makePlan = (intent, requiredFiles = [], answerStyle = 'concise') => ({
    intent,
    needsTools: requiredFiles.length > 0,
    requiredFiles,
    answerStyle
  });

  if (
    lowerText.includes('startup') ||
    lowerText.includes('starts up') ||
    lowerText.includes('how this cli')
  ) {
    return makePlan(
      'explain_flow',
      ['package.json', 'cli/index.js'],
      'beginner_explanation'
    );
  }

  if (
    lowerText.includes('how the agent') ||
    lowerText.includes('agent decides') ||
    lowerText.includes('use tools') ||
    lowerText.includes('uses tools')
  ) {
    return makePlan(
      'explain_flow',
      ['cli/agent/runner.js', 'cli/agent/tools.js'],
      'beginner_explanation'
    );
  }

  if (lowerText.includes('package.json')) {
    return makePlan(
      'file_overview',
      ['package.json'],
      'overview'
    );
  }

  if (
    lowerText.includes('reads files') ||
    lowerText.includes('read files') ||
    lowerText.includes('where the agent reads files') ||
    lowerText.includes('file reading')
  ) {
    return makePlan(
      'find_specific',
      ['cli/agent/runner.js', 'cli/agent/tools.js'],
      'direct'
    );
  }

  if (lowerText.includes('find') || lowerText.includes('where')) {
    return {
      intent: 'find_specific',
      needsTools: true,
      requiredFiles: [],
      answerStyle: 'direct'
    };
  }

  return makePlan(
    'direct_answer',
    [],
    'concise'
  );
};

const CODEISH =
  /\b(file|code|bug|fix|implement|refactor|search|read|edit|create|delete|test|commit|diff|function|class|module|import|export|api|endpoint|error|stack|lint)\b/i;

/**
 * True for short conversational turns that should skip the multi-step
 * silent reasoning loop (critical for local Ollama on CPU).
 */
export function isSimpleChatTurn(userText, plan) {
  const t = (userText || '').trim();
  if (!t || t.length > 240) return false;
  if (!plan || plan.needsTools || (plan.requiredFiles && plan.requiredFiles.length > 0)) return false;
  if (plan.intent && plan.intent !== 'direct_answer') return false;
  if (CODEISH.test(t)) return false;
  return true;
}
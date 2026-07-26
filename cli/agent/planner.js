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
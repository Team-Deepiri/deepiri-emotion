import { describe, it, expect } from 'vitest';
import { createSimplePlan } from '../planner.js';

describe('createSimplePlan', () => {
  it('classifies an explicit web_search request as web_lookup, not find_specific', () => {
    const plan = createSimplePlan('use web_search to find what .env.example is');
    expect(plan.intent).toBe('web_lookup');
    expect(plan.answerStyle).toBe('web_lookup');
  });

  it('classifies "search the web" as web_lookup', () => {
    const plan = createSimplePlan('search the web for the current Node LTS version');
    expect(plan.intent).toBe('web_lookup');
  });

  it('still classifies a plain "find"/"where" question as find_specific', () => {
    const plan = createSimplePlan('find who is the founder of deepiri');
    expect(plan.intent).toBe('find_specific');
    expect(plan.answerStyle).toBe('direct');
  });
});

/**
 * Agent runner: handles USER_MESSAGE, optional tools (read_file, search), then streams LLM.
 */
import { EVENTS } from '../core/eventBus.js';
import { streamLLM } from './llmStream.js';
import { parseToolIntent, executeTool } from './tools.js';
import { createSimplePlan } from './planner.js';

/**
 * @param {import('events').EventEmitter} bus
 * @param {Record<string,unknown>} [config] - CLI config (provider, keys, URLs)
 */
export function attachAgentRunner(bus, config = {}) {
  let teachMode = config.teachMode ?? false;

  bus.on(EVENTS.USER_MESSAGE, async ({ text }) => {
    if (text?.trim() === '/teach') {
      teachMode = !teachMode;
      bus.emit(EVENTS.TEACH_MODE_CHANGED, { teachMode });
      const msg = teachMode
        ? '📖 Teach mode ON — I will explain my reasoning, code concepts, and best practices as I work.'
        : 'Teach mode OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    let steps = 0;
    const MAX_STEPS = 5;
    if (!text?.trim()) return;

    bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: 'Thinking...' });
    bus.emit(EVENTS.AGENT_STEP, {
      id: `step-${Date.now()}`,
      type: 'thinking',
      status: 'running',
      message: 'Thinking...'
    });

    if (steps > MAX_STEPS) {
      bus.emit(EVENTS.AGENT_STATUS, { status: 'idle', message: 'Max steps reached' });
      return;
    }

    const toolIntent = parseToolIntent(text);
    let toolContext = '';

    if (toolIntent) {
      bus.emit(EVENTS.AGENT_STATUS, { status: 'tool_running', message: `Running ${toolIntent.tool}...` });
      bus.emit(EVENTS.TOOL_START, { tool: toolIntent.tool, args: toolIntent.args });
      bus.emit(EVENTS.AGENT_STEP, {
        id: `step-${Date.now()}`,
        type: 'tool_call',
        status: 'running',
        message: `${toolIntent.tool} ${JSON.stringify(toolIntent.args)}`
      });

      let result;
      try {
        result = await executeTool(toolIntent.tool, toolIntent.args);
      } catch (err) {
        result = { error: err.message };
      }

      const summary = result.error
        ? `Error: ${result.error}`
        : toolIntent.tool === 'read_file'
          ? `Read ${result.path} (${(result.content?.length ?? 0)} chars)`
          : toolIntent.tool === 'run_command'
            ? `Exit ${result.exitCode} (stdout: ${(result.stdout?.length ?? 0)} chars)`
            : `Found ${result.count} matches for "${result.query}"`;
      bus.emit(EVENTS.TOOL_END, { tool: toolIntent.tool, result });
      bus.emit(EVENTS.AGENT_STEP, {
        id: `step-${Date.now()}`,
        type: 'tool_call',
        status: 'complete',
        message: summary
      });
      bus.emit(EVENTS.AGENT_STEP, {
        id: `step-${Date.now()}`,
        type: 'tool_result',
        status: 'complete',
        message: summary
      });
      toolContext =
        typeof result === 'object' && result !== null
          ? `\n[Tool result]\n${JSON.stringify(result, null, 2).slice(0, 4000)}`
          : '';
    }

    try {
      bus.emit(EVENTS.AGENT_STATUS, { status: 'responding', message: 'Responding...' });
      bus.emit(EVENTS.AGENT_STEP, {
        id: `step-${Date.now()}`,
        type: 'response',
        status: 'running',
        message: 'Responding...'
      });

      const agentInstructions = `
        You are an autonomous coding agent helping the user understand and work on this codebase.

        Your job is to:
        - inspect the actual code when needed
        - explain how files and systems work
        - answer based on real project details, not generic assumptions
        - be concise, clear, and useful

        AVAILABLE TOOLS:
        - read_file: read a specific file by relative path
        - search: search the codebase when you do not know the right file

        TOOL USAGE RULES:
        - Use tools when the answer depends on file contents.
        - If you know the likely file path, read it directly instead of searching.
        - Use search only when you do not know where the relevant code is.
        - Do not ask the user for clarification unless absolutely necessary.
        - Always use relative paths like "cli/index.js".
        - Never use absolute paths like "/home/...".
        - If the question is about how something works in this codebase (agent behavior, tools, file reading, startup, flow):
          - you MUST use read_file to inspect the actual implementation before answering
          - do NOT answer from general knowledge
          - do NOT guess

        WHEN USING A TOOL:
        Output ONLY valid JSON.
        Do not include explanations, markdown, comments, or extra text.

        Valid tool call examples:
        {
          "tool": "read_file",
          "args": { "filePath": "package.json" }
        }

        {
          "tool": "search",
          "args": { "query": "startup logic" }
        }

        FINAL ANSWER RULES:
        When you have enough information, answer with:
        FINAL_ANSWER:

        Your final answer must match the user's intent.

        INTENT RULES:
        - If the user asks to read, show, or open a file:
          - use read_file
          - then briefly explain what the file does

        - If the user asks for an overview or summary:
          - explain what role the file plays in the system
          - connect important details into a clear mental model
          - explain how the project runs, builds, or behaves
          - use specific values from the file

        - If the user asks "find" or "where":
          - answer directly and briefly
          - include the exact file, value, script, function, or location

       - If the user asks "explain", "how it works", "startup", or asks how a system/feature/file/command works:
          - you MUST inspect the relevant implementation files before answering
          - do NOT answer from general knowledge
          - explain the answer as an ordered flow, starting from the trigger or entry point
          - use an arrow-style execution chain when the answer involves a process, startup path, command, UI flow, or agent loop
          - after the flow, briefly explain the important steps in beginner-friendly language
          - avoid broad summaries before explaining the actual sequence

        RESPONSE STYLE:

        - USE THE PLANNING GUIDANCE:
          - The prompt includes a JSON object called [Planning guidance].
          - You MUST use its intent and answerStyle to choose your response format.
          - If intent is "explain_flow":
            - start with "FLOW:"
            - use an arrow-style sequence first
            - then explain the key steps briefly
            - do not start with a paragraph summary
          - If intent is "file_overview":
            - explain the file's role
            - include "What matters"
            - end with a short mental model
          - If intent is "find_specific":
            - answer directly in 1-3 sentences
        
        - For overview or explain answers, use this structure:
          - Start with a plain-English summary of what this file does in this project.
          - Then include a short "What matters" section with 3-5 bullets.
          - Each bullet must explain why the detail matters, not just name it.
          - End with a short "Mental model" sentence that connects the pieces together.
          - Do not give generic explanations that could apply to any project.
          - Do not just list fields, imports, dependencies, or sections.
        - Start overview/explain answers with 1-2 plain-English sentences answering:
          "What role does this file play in the system?"
        - Use concrete details from the file, such as:
          - actual script names
          - entry points
          - key dependencies
          - important configuration
          - referenced files
        - Explain what those details do in this project.
        - Prefer insight over completeness.
        - Keep answers concise unless the user asks for depth.
        - When identifying what kind of application this is, base it on explicit signals from the file (e.g., presence of Electron, main entry file, scripts).
        - Do not guess or infer the type of application without referencing specific evidence.

        CODEBASE GUIDANCE:
        - For startup or entrypoint questions, inspect package.json and the target entry file.
        - For CLI startup questions, inspect cli/index.js.
        - For agent behavior questions, inspect cli/agent/runner.js.
        - For streaming/provider questions, inspect cli/agent/llmStream.js.
        - For tool behavior questions, inspect cli/agent/tools.js.
        - For UI behavior questions, inspect files in cli/ui/.

        AFTER TOOL RESULTS:
        - Continue reasoning silently.
        - Use another tool if the result points to an important referenced file.
        - If a script points to an entry file, inspect that file before explaining startup flow.
        - If you have enough information, give a concise final answer starting with FINAL_ANSWER:.

        FINAL STEP RULE:
        If this is the final step, do not use tools.
        Give the best answer possible from the information already gathered, starting with FINAL_ANSWER:.
        `;

        const simplePlan = createSimplePlan(text); 

        let plannedToolContext = '';

        if (simplePlan.needsTools && simplePlan.requiredFiles.length > 0) {
          for (const filePath of simplePlan.requiredFiles) {
            const result = await executeTool('read_file', { filePath });

            plannedToolContext += `

        [Planned file read: ${filePath}]
        ${JSON.stringify(result, null, 2).slice(0, 4000)}`;
          }
        }

      const promptForLlm = toolContext
          ? `${agentInstructions}

        [Planning guidance]
        ${JSON.stringify(simplePlan, null, 2)}

        User request:
        ${text}
        ${toolContext}
        ${plannedToolContext}`
          : `${agentInstructions}

        [Planning guidance]
        ${JSON.stringify(simplePlan, null, 2)}

        User request:
        ${text}
        ${plannedToolContext}`;
        
      let agentContext = promptForLlm;
      const visitedFiles = new Set();
      const usedToolCalls = new Set();

      while (steps < MAX_STEPS) {
        steps++;

        bus.emit(EVENTS.AGENT_STEP, {
         id: `step-${Date.now()}`,
         type: 'thinking',
         status: 'running',
         message: `Step ${steps}`
        });

        let lastResponse = '';

        await streamLLM(bus, `${agentContext}

          You are currently in the reasoning phase.

          Your job in this phase:
          - Decide what information you need
          - Use tools if necessary
          - DO NOT explain things to the user yet
          - DO NOT summarize
          - Only gather information or decide next action

          IMPORTANT:
          - If this is the final step, you MUST follow the response format based on [Planning guidance]
          - If intent is "explain_flow":
            - You MUST output:
              FLOW:
              followed by an arrow-style execution sequence
            - Do NOT output a paragraph first
            - Do NOT add a summary paragraph after the explanation
            - Do NOT output "Final Answer" or any concluding section

          Current step: ${steps} of ${MAX_STEPS}
          If this is the final step, you MUST produce a final answer starting with FINAL_ANSWER:.
          Do not skip this. Do not continue reasoning.
          If this is the final step, provide a final answer instead of using a tool.`, {
          config,
          silent: true,
          onToken: (token) => {
            lastResponse += token;
          }
        });

        agentContext = `${agentContext}

        [Previous assistant response]
        ${lastResponse}`;

        const loopToolIntent = parseToolIntent(lastResponse);

        const lastToolCallKey = loopToolIntent
          ? `${loopToolIntent.tool}-${JSON.stringify(loopToolIntent.args)}`
          : null;

        if (lastToolCallKey && usedToolCalls.has(lastToolCallKey)) {
          agentContext = `${agentContext}

        [System note]
        You already called this exact tool and received its result.
        Do not call the same tool again.
        Use the information already gathered and respond with FINAL_ANSWER:.`;

          continue;
        }

        if (lastToolCallKey) {
          usedToolCalls.add(lastToolCallKey);
        }

        const isFinalAnswer = lastResponse.trim().startsWith('FINAL_ANSWER:');

        if (loopToolIntent && loopToolIntent.tool === 'explain') {
          const explainResult = await executeTool('explain', loopToolIntent.args);
          bus.emit(EVENTS.AGENT_STEP, {
            id: `step-${Date.now()}`,
            type: 'teach',
            status: 'complete',
            message: explainResult.concept || 'Explanation',
            concept: explainResult.concept,
            explanation: explainResult.explanation,
            example: explainResult.example || null,
            category: explainResult.category
          });
          agentContext = `${agentContext}\n\n[Explanation delivered: ${explainResult.concept}]`;
          continue;
        }

        if (loopToolIntent) {
          bus.emit(EVENTS.AGENT_STATUS, {
            status: 'tool_running',
            message: `Running ${loopToolIntent.tool}...`
          });

          bus.emit(EVENTS.AGENT_STEP, {
            id: `step-${Date.now()}`,
            type: 'tool_call',
            status: 'running',
            message: `${loopToolIntent.tool} ${JSON.stringify(loopToolIntent.args)}`
          });

          const loopToolResult = await executeTool(loopToolIntent.tool, loopToolIntent.args);

          if (loopToolIntent.tool === 'read_file') {
            visitedFiles.add(loopToolIntent.args.filePath);
          }

          bus.emit(EVENTS.AGENT_STEP, {
            id: `step-${Date.now()}`,
            type: 'tool_result',
            status: 'complete',
            message: loopToolResult.error ? `Error: ${loopToolResult.error}` : `Tool result received`
          });

          agentContext = `${agentContext}

        [Loop tool result]
        ${JSON.stringify(loopToolResult, null, 2).slice(0, 4000)}`;

          continue;
        }

        if (isFinalAnswer) {
    
          const cleanedResponse = lastResponse
            .replace(/^FINAL_ANSWER:\s*/, '')
            .replace(/\nFINAL_ANSWER:\s*/g, '\n')
            .trim();

          bus.emit(EVENTS.LLM_TOKEN, { token: cleanedResponse });
          bus.emit(EVENTS.LLM_DONE, {});

          break;
        }

        if (lastResponse.trim()) {
          bus.emit(EVENTS.LLM_TOKEN, { token: lastResponse.trim() });
          bus.emit(EVENTS.LLM_DONE, {});
        }

        break;
      }

      bus.emit(EVENTS.AGENT_STEP, {
        id: `step-${Date.now()}`,
        type: 'response',
        status: 'complete',
        message: 'Done'
      });

      bus.emit(EVENTS.AGENT_STATUS, { status: 'idle', message: '' });

    } catch (err) {
      bus.emit(EVENTS.AGENT_STATUS, { status: 'idle', message: '' });
      bus.emit(EVENTS.AGENT_ERROR, { message: err.message });
      bus.emit(EVENTS.AGENT_STEP, {
        id: `step-${Date.now()}`,
        type: 'response',
        status: 'complete',
        message: `Error: ${err.message}`
      });
    }
  });
}

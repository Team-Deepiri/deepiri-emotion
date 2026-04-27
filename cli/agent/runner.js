/**
 * Agent runner: handles USER_MESSAGE, optional tools (read_file, search), then streams LLM.
 */
import { EVENTS } from '../core/eventBus.js';
import { streamLLM } from './llmStream.js';
import { parseToolIntent, executeTool } from './tools.js';

/**
 * @param {import('events').EventEmitter} bus
 * @param {Record<string,unknown>} [config] - CLI config (provider, keys, URLs)
 */
export function attachAgentRunner(bus, config = {}) {
  bus.on(EVENTS.USER_MESSAGE, async ({ text }) => {
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

    // steps++;

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
        // if (toolIntent.tool === 'read_file') {
        //   result = await readFileTool(toolIntent.args.filePath);
        // } else if (toolIntent.tool === 'search') {
        //   result = await searchTool(toolIntent.args.query);
        // } else if (toolIntent.tool === 'run_command') {
        //   result = await runCommandTool(toolIntent.args.command);
        // } else {
        //   result = { error: 'Unknown tool' };
        // }

        // NEW TOOL EXECUTION
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
        You are an autonomous coding agent.

        You have access to tools:
        - read file <path>
        - search <query>

        CRITICAL RULES:
        - If you need information, DO NOT explain first
        - DO NOT ask the user for clarification
        - Instead, output ONLY the tool command
        - ALWAYS use relative file paths (e.g., cli/index.js)
        - NEVER use absolute paths like /home/...

        Examples:
        read file package.json
        search startup logic

        After receiving tool results:
        - Continue reasoning
        - You may use more tools if needed

        ONLY give a final answer when you are confident.

        If the question is about code, you MUST use tools first.

        If you are on the final step, do not use tools. 
        Give your best final answer from the information already gathered.
        `;
      // const promptForLlm = toolContext ? `${text}\n${toolContext}` : text;
      const promptForLlm = toolContext
        ? `${agentInstructions}\n\nUser request:\n${text}\n${toolContext}`
        : `${agentInstructions}\n\nUser request:\n${text}`;

      let agentContext = promptForLlm;

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

          Current step: ${steps} of ${MAX_STEPS}
          If this is the final step, provide a final answer instead of using a tool.`, {
          config,
          onToken: (token) => {
            lastResponse += token;
          }
        });

        agentContext = `${agentContext}

        [Previous assistant response]
        ${lastResponse}`;

        const loopToolIntent = parseToolIntent(lastResponse);

        // bus.emit(EVENTS.AGENT_STEP, {
        //   id: `step-${Date.now()}`,
        //   type: 'thinking',
        //   status: 'complete',
        //   message: loopToolIntent
        //     ? `Detected tool: ${loopToolIntent.tool} ${JSON.stringify(loopToolIntent.args)}`
        //     : `No tool detected. Response length: ${lastResponse.length}`
        // });

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

        // SIMPLE DECISION: stop if response looks complete
        if (lastResponse.toLowerCase().includes('how can i assist')) {
          break;
        }

        // break;
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

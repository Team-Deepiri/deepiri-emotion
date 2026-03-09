/**
 * Agent runner: handles USER_MESSAGE, optional tools (read_file, search), then streams LLM.
 */
import { EVENTS } from '../core/eventBus.js';
import { streamLLM } from './llmStream.js';
import { parseToolIntent, readFileTool, searchTool, runCommandTool } from './tools.js';

/**
 * @param {import('events').EventEmitter} bus
 * @param {Record<string,unknown>} [config] - CLI config (provider, keys, URLs)
 */
export function attachAgentRunner(bus, config = {}) {
  bus.on(EVENTS.USER_MESSAGE, async ({ text }) => {
    if (!text?.trim()) return;

    bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: 'Thinking...' });
    bus.emit(EVENTS.AGENT_STEP, {
      id: `step-${Date.now()}`,
      type: 'thinking',
      status: 'running',
      message: 'Thinking...'
    });

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
        if (toolIntent.tool === 'read_file') {
          result = await readFileTool(toolIntent.args.filePath);
        } else if (toolIntent.tool === 'search') {
          result = await searchTool(toolIntent.args.query);
        } else if (toolIntent.tool === 'run_command') {
          result = await runCommandTool(toolIntent.args.command);
        } else {
          result = { error: 'Unknown tool' };
        }
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

      const promptForLlm = toolContext ? `${text}\n${toolContext}` : text;
      await streamLLM(bus, promptForLlm, { config });

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

# Plan: Agentic CLI TUI (V2 - Claude Code Style)

This plan outlines the evolution of the `deepiri-emotion-desktop` CLI into a fully agentic terminal interface inspired by "Claude Code" and "Gemini CLI".

## 1. Vision
A terminal-based agent that:
- Maintains context across a conversation.
- Can autonomously execute a chain of tools to solve complex tasks.
- Provides high-signal feedback through a rich TUI (spinners, step timelines, diffs).
- Operates safely with a confirmation protocol for destructive actions.

---

## 2. Core Architecture Upgrades

### 2.1 Agentic Loop (Refactoring `runner.js`)
Move from "single tool parse" to a full agentic loop:
1.  **Input:** User message.
2.  **Prompt:** System prompt + History + Context + User message.
3.  **LLM Call:** Call LLM with tool definitions.
4.  **Process Output:**
    - If LLM emits text: append to history, display to user.
    - If LLM emits tool call(s):
        - Log `AGENT_STEP` (running tool).
        - Execute tool (optionally ask for confirmation).
        - Append tool result to history.
        - **Repeat from step 3 (Recurse).**
5.  **Termination:** LLM emits no more tool calls and finishes response.

### 2.2 Stateful History
- Update `stateStore.js` to persist messages across the session.
- Implement token counting (optional) and history trimming to fit context windows.

### 2.3 Expanded Tool Registry
Implement a robust set of tools similar to the `deepiri-emotion-desktop` capabilities:
- `ls`: List files in a directory.
- `cat`: Read file content.
- `grep`: Search for patterns.
- `find`: Find files by glob.
- `write`: Create or overwrite a file.
- `patch`: Apply a diff/replacement.
- `shell`: Run an arbitrary shell command (with safety confirmation).
- `git`: Specialized git operations (status, diff, commit).

---

## 3. TUI & UX Enhancements

### 3.1 Markdown Rendering
- Use `ink-markdown` or a custom parser to render code blocks with syntax highlighting.
- Proper wrapping and indentation for assistant responses.

### 3.2 Enhanced `StepTimeline`
- Show parameters for tool calls (e.g., `🔍 searching for "foo"`).
- Show results summary (e.g., `✓ found 12 matches`).
- Collapsible detail view for tool outputs (if possible in Ink).

### 3.3 Confirmation Protocol
- For "critical" tools (shell, write, git commit), show an interactive "Yes/No" prompt in the TUI before execution.

### 3.4 Improved Prompt Input
- Multiline support (Shift+Enter).
- Command history (Up/Down arrows).
- Tab completion for file paths (if feasible).

---

## 4. Implementation Roadmap

### Phase 1: The Engine
- [ ] Implement `AgentRuntime` class to manage the loop.
- [ ] Update `llmStream.js` to support tool calling (OpenAI/Ollama).
- [ ] Connect `runner.js` to the new `AgentRuntime`.

### Phase 2: The Tools
- [ ] Implement a standardized `Tool` interface.
- [ ] Port/implement core tools: `read_file`, `write_file`, `search`, `run_command`.
- [ ] Implement confirmation prompt UI component.

### Phase 3: The TUI
- [ ] Integrate markdown rendering.
- [ ] Improve `MessageList` layout and styling.
- [ ] Add session history persistence (local JSON file).

### Phase 4: Polish
- [ ] Add `--profile` support for different LLM configs.
- [ ] Implement "Context" auto-discovery (detect git repo, package.json).
- [ ] Add ASCII art banner and refined branding.

---

## 5. Technical Considerations

- **Library:** Continue with **Ink** for the UI.
- **Provider:** Support OpenAI, Anthropic (via library or direct), Ollama, and Cyrex.
- **Safety:** Always default to "dry-run" or "confirmation required" for shell/write tools.
- **Context:** Pass the current working directory and a list of available files (optional) to the LLM to help it navigate.

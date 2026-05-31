# Deepiri Emotion CLI — Demo Walkthrough

A live demo guide for the Ink-based TUI. Run every command in a terminal from the repo root.

---

## Setup

```bash
npm run cli                        # launch the TUI (cwd is the workspace)
npm run cli -- /path/to/project    # or point it at a specific workspace
npm run cli -- --teach             # start with Teach mode pre-enabled
```

Set `OPENAI_API_KEY` for OpenAI, or make sure `claude` (Claude Code) is logged in for the local-free path.

---

## 1. Basic Conversation

**Type:** `What does this project do?`

**Show:**
- The streaming `▌` cursor in the MessageList while the response arrives
- The "Steps:" section (StepTimeline) briefly showing a thinking step
- The provider being selected in debug mode (see step 3)

---

## 2. Tool Use — Reading the Codebase

**Type:** `Read cli/core/eventBus.js and explain it`

**Show:**
- `🔍 read_file` step appears in StepTimeline
- `✓` tool result step when file is returned
- `✍` response step when the final answer streams in
- The full agentic reasoning loop: bounded to 5 steps / 8 tool calls / 60 seconds

---

## 3. Debug Mode

**Type:** `/debug`

- `[DEBUG]` badge appears in StatusBar
- **Type:** `How does the agent loop work?`
- Now StepTimeline shows **all** steps including thinking + tool_call + tool_result

**Type:** `/debug` again to toggle off.

---

## 4. Plan Mode

**Type:** `/plan`

- `[PLAN]` badge appears
- Agent focuses on planning, avoids mutations, treats all tool calls as read-only
- Good for "what would it take to add feature X?" conversations

---

## 5. Confirmation Gate — File Mutations

**Type:** `Create a file called test-demo.txt with the content "hello world"`

- A yellow-bordered confirmation box appears: `Apply create_file to test-demo.txt?`
- Preview shows the file content
- **Press `y`** to approve, **`n`** to deny
- Denied changes feed back into agent context ("Change denied by user")

**Type:** `/auto` to toggle Auto mode → `[AUTO]` badge → mutations apply without prompting.

**Type:** `/accept-edits` → `[ACCEPT-EDITS]` badge → only file edits auto-approve; other actions still prompt.

---

## 6. Teach Mode

**Type:** `/teach`

- `[TEACH]` badge appears
- **Type:** `How does the event bus work here?`
- After reading a file, the agent emits an `📖` teach step in StepTimeline with:
  - Concept name + category label
  - 2-3 sentence explanation
  - Code example from the actual file

---

## 7. Provider Fallback Chain

Default chain (fastest/free first): **ollama → claude-cli → cursor → openai → cyrex**

In debug mode, StepTimeline shows `Provider skip: ollama (not available)` / `Provider using: claude-cli` etc.

Override chain in `.emotion-cli.json`:
```json
{ "providerChain": ["openai"] }
```

---

## 8. Workspace Scan

**Type:** `/scan`

Shows which guidance docs were discovered (DIRECTION.md, README.md, AGENTS.md, etc.) and how many characters of context they contribute to the agent.

---

## 9. Keybindings Reference

| Key | Action |
|-----|--------|
| **Enter** | Send message |
| **Shift+Enter** | Insert newline |
| **Ctrl+V** | Grab clipboard image and attach it *(new)* |
| **Ctrl+L** | Clear conversation |
| **Ctrl+C** | Exit |
| **y / n** | Approve / deny a confirmation prompt |

---

## 10. Available Slash Commands

| Command | Effect |
|---------|--------|
| `/teach` | Toggle Teach mode |
| `/debug` | Toggle Debug mode (full step visibility) |
| `/plan` | Toggle Plan mode (read-only planning) |
| `/auto` | Toggle Auto mode (no confirmation prompts) |
| `/accept-edits` | Toggle Accept-edits (only file edits auto-approve) |
| `/scan` | Scan workspace for guidance docs |
| `/guard` | Toggle voice-of-reason supervisor *(new)* |

---

## — COMING NEXT —

### Feature 1: Image / Screenshot Attachment

**Press Ctrl+V** — grabs whatever image is on your clipboard (macOS: pngpaste or osascript).

- `📎 1 image attached — will send with next message` appears above the prompt
- Send any message → image is included in the AI request as a vision content block
- **Works for:** OpenAI (gpt-4o content blocks), Ollama (llava `images[]`), claude-cli (file path)
- **Also works:** paste a file path like `/tmp/screenshot.png` in the prompt — auto-detected and attached
- Requires a vision-capable model (gpt-4o, llava, claude-3-x)

**Demo prompt to type after attaching a screenshot:**
> `What's in this image? Describe any code or UI you see.`

---

### Feature 2: Voice-of-Reason Supervisor (`/guard`)

A **secondary LLM** watches every tool call the agent is about to make, in real time.

When the supervisor is concerned:
1. **Execution halts** — the tool does NOT run
2. `🛑 Supervisor halted — <reason>` appears in StepTimeline
3. The main agent turns to you and asks what to do next

`[GUARD]` badge in StatusBar shows when active. Toggle with `/guard`.

**Demo sequence:**
1. Start with `/guard` ON (default)
2. **Type:** `Delete all .log files in the workspace`
3. Watch the supervisor catch the destructive `run_command` before it fires
4. Agent explains what it was about to do and asks how to proceed

The supervisor is fail-open: if the LLM reviewer errors, execution continues normally.

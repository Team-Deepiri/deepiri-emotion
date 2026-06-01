# Deepiri Emotion CLI — Demo Walkthrough

A live demo guide for the Ink-based TUI. Run every command in a terminal from the repo root.

---

## Setup

```bash
npm run cli                        # launch the TUI (cwd is the workspace)
npm run cli -- /path/to/project    # or point it at a specific workspace
npm run cli -- --teach             # start with Teach mode pre-enabled
```

**Provider prerequisites (pick one):**

| Provider | What you need | Notes |
|----------|--------------|-------|
| **claude-cli** *(default, free)* | `claude` CLI logged in | Run `claude` once interactively to auth |
| **OpenAI** | `export OPENAI_API_KEY=sk-...` | Default model: `gpt-4o-mini`; use `gpt-4o` for vision |
| **Ollama** | `ollama serve` running + model pulled | `ollama pull llava` for vision; `ollama pull llama3.2` for text |

**For the image/vision demo specifically:**
- **claude-cli path:** image temp file is passed as a text note — Claude reads the local file. Works but not true multimodal content blocks.
- **True vision blocks:** set `OPENAI_API_KEY` + `"openaiModel": "gpt-4o"` in `.emotion-cli.json`, OR run `ollama serve` and pull `llava`.

```json
{ "providerChain": ["openai"], "openaiModel": "gpt-4o" }
```

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

## 9. Image / Screenshot Attachment

**Press Ctrl+V** to grab whatever image is on your clipboard (macOS: uses `pngpaste` or `osascript` fallback).

- `📎 1 image attached — will send with next message` appears above the prompt
- Send any message → image included in the AI request as a vision content block
- **Also works:** type or paste a file path ending in `.png/.jpg/.jpeg/.gif/.webp` — auto-detected, read, and attached
- Requires a vision-capable model for full vision: **gpt-4o** (OpenAI), **llava** (Ollama)
- With **claude-cli** (default): image temp path is passed as `[Attached image: /path]` text note — Claude reads the file and can describe it, but it is not a multimodal content block

**Demo:**
1. Copy any screenshot to clipboard
2. Press **Ctrl+V** — chip appears: `📎 1 image attached`
3. **Type:** `What's in this image? Describe any code or UI you see.`
4. Send — image travels as a vision content block to the provider

**Provider behavior:**
| Provider | How image is sent |
|----------|------------------|
| OpenAI / Cyrex | `content: [{type:'image_url', image_url:{url:'data:image/png;base64,...'}}]` |
| Ollama | `images: ['<base64>']` on user message (llava-class models) |
| claude-cli / cursor | `[Attached image: /tmp/deepiri-attach-<ts>.png]` appended to stdin prompt |

---

## 10. Voice-of-Reason Supervisor (`/guard`)

Secondary LLM watches every tool call the agent is about to make, in real time.

**Default: ON.** `[GUARD]` badge in StatusBar shows state. Toggle with `/guard`.

When the supervisor flags an action:
1. **Execution halts** — the tool does NOT run
2. `🛑 Supervisor halted — <reason>` appears in StepTimeline (always visible, not gated behind debug mode)
3. Main agent turns to you: summarizes what it was about to do, why it was flagged, and asks how to proceed

**Supervisor is fail-open:** any parse or stream error defaults to `proceed` — never bricks the loop.

**Demo sequence:**
1. Ensure `/guard` is ON (default on launch)
2. **Type:** `Run a shell command to delete all .log files in the workspace`
   *(Use this exact phrasing — it forces the agent to emit a `run_command` tool call rather than just explaining the steps. Supervisor only intercepts live tool calls.)*
3. Supervisor catches the destructive `run_command` before it fires
4. Watch `🛑` step appear; agent asks how to proceed
5. **Type:** `/guard` to toggle off → repeat same prompt → no halt, command executes (pending confirmation gate)

---

## 11. Keybindings Reference

| Key | Action |
|-----|--------|
| **Enter** | Send message |
| **Shift+Enter** | Insert newline |
| **Ctrl+V** | Grab clipboard image and attach it |
| **Ctrl+L** | Clear conversation |
| **Ctrl+C** | Exit |
| **y / n** | Approve / deny a confirmation prompt |

---

## 12. Available Slash Commands

| Command | Effect |
|---------|--------|
| `/teach` | Toggle Teach mode |
| `/debug` | Toggle Debug mode (full step visibility) |
| `/plan` | Toggle Plan mode (read-only planning) |
| `/auto` | Toggle Auto mode (no confirmation prompts) |
| `/accept-edits` | Toggle Accept-edits (only file edits auto-approve) |
| `/scan` | Scan workspace for guidance docs |
| `/guard` | Toggle voice-of-reason supervisor (default ON) |

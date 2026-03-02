/**
 * Guide — What's new, vision, the beast. No one has seen this before.
 */

import React from 'react';
import './GuideView.css';

const VISION = `
# Deepiri IDE — The OS of IDEs

**Create anything. For everyone. With feeling.**

- **For everyone** — Code, visual, voice, emotion. No-code to full code.
- **Emotional AI (deepiri-emotion)** — Agents with personality. Customize tone and traits.
- **Embedded intelligence** — Classify intent, fine-tune with Helox.
- **Multi-modal** — Voice in chat and editor. Visual canvas with nested export.
- **Create launcher** — Ctrl+Shift+N: Code, Visual, Emotion, or from template.

## What you can do now

1. **Code** — Monaco editor, AI chat, Explain/Refactor/Add tests/Classify, find/replace, zoom.
2. **Visual** — Drag components, set parent container, duplicate (Ctrl+D), zoom to fit, export React/HTML.
3. **Emotion** — Pick or add agents, edit tone and personality traits, chat with agent in header.
4. **Voice** — Mic in AI chat and in editor bar: dictate into input or insert at cursor.
5. **Classify** — Classify strip above status bar: run Classify, expand history.
6. **Fine-tune** — Bottom panel Fine-tune tab: dataset path, base model, start run.
7. **Create anything** — Launcher: Code / Visual / Emotion, or template (React, Python, Markdown, JSON, HTML).
`;

export default function GuideView() {
  return (
    <div className="guide-view">
      <div className="guide-content">
        <pre className="guide-text">{VISION.trim()}</pre>
      </div>
    </div>
  );
}

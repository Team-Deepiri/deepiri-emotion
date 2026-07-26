/**
 * Boot splash — big purple EMOTION wordmark + "made by deepiri".
 * Runs before Ink mounts so the TUI doesn't fight the animation.
 */
import chalk from 'chalk';

const PURPLE = chalk.hex('#a855f7');
const DEEP = chalk.hex('#6b21a8');
const DEEPER = chalk.hex('#3b0764');
const MUTED = chalk.hex('#c4b5fd');

// Figlet-style block letters for EMOTION
const LOGO_LINES = [
  '███████╗███╗   ███╗ ██████╗ ████████╗██╗ ██████╗ ███╗   ██╗',
  '██╔════╝████╗ ████║██╔═══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║',
  '█████╗  ██╔████╔██║██║   ██║   ██║   ██║██║   ██║██╔██╗ ██║',
  '██╔══╝  ██║╚██╔╝██║██║   ██║   ██║   ██║██║   ██║██║╚██╗██║',
  '███████╗██║ ╚═╝ ██║╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚████║',
  '╚══════╝╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
];

const TAGLINE = 'made by deepiri';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function colorForLine(i, pulse) {
  const palette = pulse % 3 === 0 ? [DEEP, PURPLE] : pulse % 3 === 1 ? [PURPLE, DEEP] : [DEEPER, PURPLE];
  return palette[i % 2];
}

function hideCursor() {
  process.stdout.write('\x1B[?25l');
}

function showCursor() {
  process.stdout.write('\x1B[?25h');
}

function clearScreen() {
  process.stdout.write('\x1B[2J\x1B[H');
}

/**
 * Animated boot splash. No-ops when stdout isn't a TTY (pipes / CI).
 * @param {{ durationMs?: number }} [opts]
 */
export async function playSplash(opts = {}) {
  if (!process.stdout.isTTY) return;

  const durationMs = opts.durationMs ?? 1100;
  hideCursor();

  try {
    // Reveal logo line-by-line
    for (let i = 0; i < LOGO_LINES.length; i++) {
      const paint = colorForLine(i, 0);
      process.stdout.write(`${paint(LOGO_LINES[i])}\n`);
      await sleep(55);
    }

    process.stdout.write('\n');

    // Tagline typewriter
    let built = '';
    for (const ch of TAGLINE) {
      built += ch;
      process.stdout.write(`\r  ${MUTED(built)}`);
      await sleep(28);
    }
    process.stdout.write('\n');

    // Brief pulse on the logo region (rewrite in place)
    const pulses = 3;
    const pulseDelay = Math.max(40, Math.floor((durationMs - 500) / pulses));
    for (let p = 1; p <= pulses; p++) {
      // Move cursor up over logo + blank + tagline
      process.stdout.write(`\x1B[${LOGO_LINES.length + 2}A`);
      for (let i = 0; i < LOGO_LINES.length; i++) {
        const paint = colorForLine(i, p);
        process.stdout.write(`\r\x1B[2K${paint(LOGO_LINES[i])}\n`);
      }
      process.stdout.write('\n');
      process.stdout.write(`\r\x1B[2K  ${p % 2 === 0 ? PURPLE(TAGLINE) : MUTED(TAGLINE)}\n`);
      await sleep(pulseDelay);
    }

    await sleep(120);
  } finally {
    clearScreen();
    showCursor();
  }
}

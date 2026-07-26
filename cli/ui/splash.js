/**
 * Boot splash — big purple EMOTION wordmark + "made by deepiri".
 * Runs before Ink mounts so the TUI doesn't fight the animation.
 *
 * Keep this simple: line reveal + typewriter, then a hard screen clear.
 * In-place cursor rewrites leave garbage on many terminals / WSL.
 */
import chalk from 'chalk';

const PURPLE = chalk.hex('#a855f7');
const DEEP = chalk.hex('#6b21a8');
const MUTED = chalk.hex('#c4b5fd');

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

function hideCursor() {
  process.stdout.write('\x1B[?25l');
}

function showCursor() {
  process.stdout.write('\x1B[?25h');
}

function clearScreen() {
  // Clear scrollback-visible region + home cursor (works better on WSL than pulse rewrites).
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}

/**
 * Animated boot splash. No-ops when stdout isn't a TTY (pipes / CI).
 * @param {{ durationMs?: number }} [opts]
 */
export async function playSplash(opts = {}) {
  if (!process.stdout.isTTY) return;

  hideCursor();
  clearScreen();

  try {
    for (let i = 0; i < LOGO_LINES.length; i++) {
      const paint = i % 2 === 0 ? DEEP : PURPLE;
      process.stdout.write(`${paint(LOGO_LINES[i])}\n`);
      await sleep(40);
    }

    process.stdout.write('\n');

    let built = '';
    for (const ch of TAGLINE) {
      built += ch;
      process.stdout.write(`\r  ${MUTED(built)}`);
      await sleep(22);
    }
    process.stdout.write(`\r  ${PURPLE(TAGLINE)}\n`);

    await sleep(opts.durationMs ?? 450);
  } finally {
    clearScreen();
    showCursor();
  }
}

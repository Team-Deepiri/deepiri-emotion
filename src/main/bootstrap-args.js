/**
 * Bootstrap: CLI and process arguments.
 */
export const isDev = process.argv.includes('--dev');

/**
 * Parse argv for optional folder/file to open (e.g. electron . -- /path/to/folder).
 * @returns {{ folder?: string, file?: string }}
 */
export function getLaunchArgs() {
  const args = process.argv.slice(process.defaultApp ? 2 : 1);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--' && args[i + 1]) {
      const path = args[i + 1];
      // simplistic: treat as folder if no extension or ends with /
      if (path.includes('.') && !path.endsWith('/')) {
        result.file = path;
      } else {
        result.folder = path.replace(/\/$/, '');
      }
      break;
    }
  }
  return result;
}

#!/usr/bin/env node
/**
 * Bundle the CLI (JSX + ESM) into a single runnable cli/run.js.
 * Run: node scripts/build-cli.cjs
 */
const esbuild = require('esbuild');
const path = require('path');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'cli', 'index.js');
const outfile = path.join(root, 'cli', 'run.js');

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile,
    jsx: 'automatic',
    loader: { '.jsx': 'jsx' },
    banner: { js: '/* eslint-disable */' },
    alias: {
      'react-devtools-core': path.join(root, 'cli', 'stub-devtools.js')
    }
  })
  .then(() => console.log('CLI built:', outfile))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

#!/usr/bin/env node

import { exec } from 'child_process';

console.log('Running parser tests...');

exec('npx vitest run test/parser.test.ts', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
  
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
  }
  
  console.log(stdout);
});

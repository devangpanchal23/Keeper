#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- This executable uses CommonJS because the package is not ESM. */
const { spawn } = require("child_process");
const path = require("path");

const testFile = path.join(__dirname, "scripts", "run-tests.ts");
const child = spawn("npx", ["-y", "tsx", testFile], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

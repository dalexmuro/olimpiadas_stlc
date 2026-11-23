#!/usr/bin/env node
/**
 * Pre-commit & CI Security Guard CLI
 * Usage:
 *   node scripts/security-precommit-guard.mjs --staged   (inspects Git staging area)
 *   node scripts/security-precommit-guard.mjs --all      (inspects all git-tracked files)
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  checkForbiddenFilePath,
  normalizeRepoPath,
  scanFileContent,
} from "./security-guard-core.mjs";

const mode = process.argv.includes("--all") ? "all" : "staged";

function gitOutput(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024,
  });
}

function isLikelyBinary(buffer) {
  const sampleLen = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleLen; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function getTargetFiles() {
  if (mode === "all") {
    return gitOutput(["ls-files"])
      .split(/\r?\n/)
      .map(normalizeRepoPath)
      .filter(Boolean);
  }

  return gitOutput(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    .split(/\r?\n/)
    .map(normalizeRepoPath)
    .filter(Boolean);
}

function readTargetBuffer(filePath) {
  if (mode === "staged") {
    return execFileSync("git", ["show", `:${filePath}`], {
      maxBuffer: 25 * 1024 * 1024,
    });
  }
  return readFileSync(filePath);
}

const files = getTargetFiles();
const allViolations = [];

for (const filePath of files) {
  allViolations.push(...checkForbiddenFilePath(filePath));

  let buffer;
  try {
    buffer = readTargetBuffer(filePath);
  } catch {
    continue;
  }

  if (isLikelyBinary(buffer)) continue;
  const text = buffer.toString("utf8");
  allViolations.push(...scanFileContent(filePath, text));
}

if (allViolations.length > 0) {
  console.error(
    `\n[SECURITY GUARD] Blocked ${allViolations.length} issue(s) in ${mode} files:\n`
  );
  for (const v of allViolations) {
    const loc = v.line > 0 ? `${v.filePath}:${v.line}` : v.filePath;
    console.error(`  - [${v.ruleId}] ${loc} — ${v.description}`);
  }
  console.error(
    "\nNever commit secrets, database dumps, private server configs, or real participant PII."
  );
  console.error(
    "If a real credential was ever committed previously, rotate/revoke it immediately.\n"
  );
  process.exit(1);
}

console.log(
  `[SECURITY GUARD] OK (${mode}): checked ${files.length} file(s), 0 security/PII issues found.`
);
process.exit(0);

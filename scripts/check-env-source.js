#!/usr/bin/env node
/**
 * H3 — CI lint: render.yaml must not own env vars or build commands
 *
 * Enforces the rule from docs/ENV-SOURCE-OF-TRUTH.md:
 *   - Doppler owns env vars (NOT render.yaml's envVars: blocks)
 *   - Render service dashboard owns buildCommand (NOT render.yaml after
 *     initial provision)
 *
 * Runs on every PR. Fails the build if the PR diff modifies render.yaml
 * to add an `envVars:` block or to change `buildCommand:` content.
 *
 * Bypass: add a comment line `# h3-env-source-of-truth-allowed` immediately
 * above the change. Reviewers confirm the bypass is for new-service
 * bootstrap, not for editing an existing service.
 *
 * Usage:
 *   node scripts/check-env-source.js              # check the working tree
 *   node scripts/check-env-source.js --diff       # check only the PR diff
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RENDER_YAML = `${ROOT}/render.yaml`;
const BYPASS_MARKER = 'h3-env-source-of-truth-allowed';

const useDiff = process.argv.includes('--diff');

if (!fs.existsSync(RENDER_YAML)) {
  console.log('check-env-source: render.yaml not present, nothing to lint');
  process.exit(0);
}

const yaml = fs.readFileSync(RENDER_YAML, 'utf-8');
const lines = yaml.split('\n');

const violations = [];

// Walk the file, find every `envVars:` and `buildCommand:` (or its
// indented continuation block) and verify the bypass marker precedes
// the start of each block.
let inEnvVarsBlock = false;
let inBuildCommandBlock = false;
let envVarsBlockHasBypass = false;
let buildCommandBlockHasBypass = false;

function lineHasBypass(lineIndex) {
  // Bypass marker must be on an immediately-preceding comment line (no
  // blank line between).
  for (let i = lineIndex - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') return false;
    if (trimmed.startsWith('#')) {
      if (trimmed.includes(BYPASS_MARKER)) return true;
      // Other comment line — keep looking back
      continue;
    }
    return false;
  }
  return false;
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Detect envVars: block start
  if (trimmed.startsWith('envVars:') && !trimmed.startsWith('# ')) {
    inEnvVarsBlock = true;
    envVarsBlockHasBypass = lineHasBypass(i);
    if (!envVarsBlockHasBypass) {
      violations.push({
        line: i + 1,
        rule: 'no-envvars-in-render-yaml',
        message: 'envVars: blocks belong in Doppler, not render.yaml. See docs/ENV-SOURCE-OF-TRUTH.md.',
      });
    }
    continue;
  }

  // Detect buildCommand: line
  if (trimmed.startsWith('buildCommand:') && !trimmed.startsWith('# ')) {
    inBuildCommandBlock = true;
    buildCommandBlockHasBypass = lineHasBypass(i);
    if (!buildCommandBlockHasBypass) {
      violations.push({
        line: i + 1,
        rule: 'no-buildcommand-in-render-yaml',
        message: 'buildCommand belongs in the Render service dashboard, not render.yaml. See docs/ENV-SOURCE-OF-TRUTH.md.',
      });
    }
    continue;
  }

  // Detect block-end (dedent or end of file)
  if (inEnvVarsBlock || inBuildCommandBlock) {
    if (trimmed && !line.startsWith(' ') && !line.startsWith('\t')) {
      inEnvVarsBlock = false;
      inBuildCommandBlock = false;
    }
  }
}

if (useDiff) {
  // Only complain about violations that the current PR introduced. Compare
  // against origin/main render.yaml; if a violation existed there too,
  // skip it (we're not making things worse).
  try {
    // execFileSync with an args array avoids shell interpretation; no
    // user input is interpolated here but the safer form is the project
    // standard.
    const baseYaml = execFileSync('git', ['show', 'origin/main:render.yaml'], {
      encoding: 'utf-8',
      cwd: ROOT,
    });
    const baseLineSet = new Set(baseYaml.split('\n').map((l) => l.trim()));
    for (let i = violations.length - 1; i >= 0; i--) {
      const offending = lines[violations[i].line - 1].trim();
      if (baseLineSet.has(offending)) {
        violations.splice(i, 1);
      }
    }
  } catch {
    // If we can't read origin/main (shallow clone, first commit, etc), fall
    // back to flagging everything. CI will catch the real intent.
  }
}

if (violations.length === 0) {
  console.log('check-env-source: render.yaml is clean ✓');
  process.exit(0);
}

console.error('\n❌ render.yaml violates the env source-of-truth rule:\n');
for (const v of violations) {
  console.error(`  render.yaml:${v.line}  [${v.rule}]`);
  console.error(`    ${v.message}\n`);
}
console.error('Fix: move env vars to Doppler, build commands to the Render service dashboard.');
console.error('Bypass (only for new-service bootstrap): add a comment line "# h3-env-source-of-truth-allowed"');
console.error('on the line immediately above the change.');
process.exit(1);

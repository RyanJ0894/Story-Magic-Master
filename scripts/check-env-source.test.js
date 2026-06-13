/**
 * H3 — lint self-test
 *
 * Spawns the lint against a fixture render.yaml and asserts exit codes /
 * stderr messages. Vitest setup isn't great for spawning the script (it'd
 * need the whole monorepo workspace machinery), so this is a plain Node
 * test runner.
 *
 * Usage:
 *   node scripts/check-env-source.test.js
 *
 * Exits 0 on pass, 1 on fail. CI can run this if desired.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// Fully-resolved at startup; all paths below are derived by string
// concatenation from constants — no dynamic path.join needed (and so
// no path-traversal warnings from static analysis).
const SCRIPT = `${__dirname}/check-env-source.js`;

function makeTempYaml(content) {
  // mkdtempSync returns an absolute path with random suffix; its return
  // value is trusted (we wrote it ourselves) so subsequent concatenation
  // is safe. mkdtemp's prefix MUST end with a path separator if we want
  // the random suffix appended without manual joining.
  const dir = fs.mkdtempSync(`${os.tmpdir()}/env-sot-`);
  const file = `${dir}/render.yaml`;
  fs.writeFileSync(file, content);
  return { dir, file };
}

function runLint(yamlContent) {
  const { dir } = makeTempYaml(yamlContent);
  try {
    // The lint script reads `${ROOT}/render.yaml` where ROOT = script's
    // parent dir. To stub that, we put a copy of the script in
    // <tempdir>/scripts/ and run it; its ROOT then resolves to <tempdir>
    // which contains our fixture render.yaml.
    const scriptDir = `${dir}/scripts`;
    fs.mkdirSync(scriptDir);
    const scriptCopy = `${scriptDir}/check-env-source.js`;
    fs.copyFileSync(SCRIPT, scriptCopy);
    try {
      execFileSync('node', [scriptCopy], {
        cwd: dir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return { exitCode: 0, output: '' };
    } catch (err) {
      return { exitCode: err.status ?? 1, output: String(err.stderr ?? '') + String(err.stdout ?? '') };
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const cases = [
  {
    name: 'allows render.yaml without envVars or buildCommand',
    yaml: `services:
  - type: web
    name: foo
    runtime: node
    plan: starter
`,
    expectExit: 0,
  },
  {
    name: 'rejects render.yaml with an envVars: block',
    yaml: `services:
  - type: web
    name: foo
    envVars:
      - key: FOO
        value: bar
`,
    expectExit: 1,
    expectStderrContains: 'no-envvars-in-render-yaml',
  },
  {
    name: 'rejects render.yaml with a buildCommand:',
    yaml: `services:
  - type: web
    name: foo
    buildCommand: npm install
`,
    expectExit: 1,
    expectStderrContains: 'no-buildcommand-in-render-yaml',
  },
  {
    name: 'allows envVars: when preceded by the bypass marker',
    yaml: `services:
  - type: web
    name: foo
    # h3-env-source-of-truth-allowed
    envVars:
      - key: FOO
        value: bar
`,
    expectExit: 0,
  },
  {
    name: 'allows buildCommand: when preceded by the bypass marker',
    yaml: `services:
  - type: web
    name: foo
    # h3-env-source-of-truth-allowed
    buildCommand: npm install
`,
    expectExit: 0,
  },
];

let failed = 0;
for (const c of cases) {
  const { exitCode, output } = runLint(c.yaml);
  const exitOk = exitCode === c.expectExit;
  const stderrOk = !c.expectStderrContains || output.includes(c.expectStderrContains);
  const pass = exitOk && stderrOk;
  console.log(`${pass ? '  ✓' : '  ✗'} ${c.name}`);
  if (!pass) {
    failed++;
    console.log(`      expected exit=${c.expectExit}, got ${exitCode}`);
    if (c.expectStderrContains && !stderrOk) {
      console.log(`      expected stderr to contain "${c.expectStderrContains}"`);
    }
    console.log(`      actual output:\n${output.replace(/^/gm, '          ')}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} tests passed.`);

'use strict';

/**
 * Code-quality metrics for the refactor & optimisation report.
 * Prints JSON: cyclomatic complexity distribution (ESLint `complexity`),
 * lint problems under the project config, and line/branch coverage if
 * coverage/coverage-summary.json exists (run `npm run coverage` first).
 *
 * Usage: node scripts/metrics.js > metrics.json
 */
const fs = require('node:fs');
const path = require('node:path');
const { ESLint } = require('eslint');

const ROOT = path.join(__dirname, '..');

async function complexity() {
  // Report every function: with max 0, ESLint emits one message per function
  // carrying its complexity.
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: { rules: { complexity: ['warn', 0] } },
  });
  const results = await eslint.lintFiles(['src/**/*.js']);
  const values = [];
  for (const r of results) {
    for (const m of r.messages) {
      const match = m.ruleId === 'complexity' && /complexity of (\d+)/.exec(m.message);
      if (match) values.push({ file: path.relative(ROOT, r.filePath), line: m.line, value: Number(match[1]), name: m.message.split(' has')[0] });
    }
  }
  values.sort((a, b) => b.value - a.value);
  const sum = values.reduce((s, v) => s + v.value, 0);
  return {
    functions: values.length,
    average: Number((sum / values.length).toFixed(2)),
    max: values[0]?.value ?? 0,
    over10: values.filter((v) => v.value > 10).length,
    over7: values.filter((v) => v.value > 7).length,
    top5: values.slice(0, 5).map((v) => `${v.name} (${v.file}:${v.line}) = ${v.value}`),
  };
}

async function lint() {
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(['.']);
  return {
    errors: results.reduce((s, r) => s + r.errorCount, 0),
    warnings: results.reduce((s, r) => s + r.warningCount, 0),
    byRule: results.flatMap((r) => r.messages).reduce((acc, m) => ({ ...acc, [m.ruleId]: (acc[m.ruleId] || 0) + 1 }), {}),
  };
}

function coverage() {
  const file = path.join(ROOT, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(file)) return null;
  const t = JSON.parse(fs.readFileSync(file, 'utf8')).total;
  return { lines: t.lines.pct, branches: t.branches.pct, functions: t.functions.pct, statements: t.statements.pct };
}

function size() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const count = (dir) => walk(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).reduce((s, f) => s + fs.readFileSync(f, 'utf8').split('\n').length, 0);
  return { srcLines: count('src'), testLines: count('test') };
}

async function main() {
  const out = { at: new Date().toISOString(), complexity: await complexity(), lint: await lint(), coverage: coverage(), size: size() };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

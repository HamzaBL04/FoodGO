'use strict';

/**
 * Generates docs/requirements/TRACEABILITY.md: for every functional
 * requirement (FR-01..FR-31) and business rule (BR-01..BR-16), the source
 * files that implement it and the tests that check it, found by scanning
 * for the identifier. Run: npm run traceability
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const FR = {
  'FR-01': 'Customer account creation (provisioned by restaurant)', 'FR-02': 'Collect full name', 'FR-03': 'Collect phone number',
  'FR-04': 'Collect workplace / institution', 'FR-05': 'Display available restaurants', 'FR-06': 'View restaurant menus',
  'FR-07': 'Restaurants manage menus', 'FR-08': 'Mark items available / unavailable', 'FR-09': 'Select menu items',
  'FR-10': 'Specify quantities', 'FR-11': 'Calculate order total', 'FR-12': 'Accept pre-orders before deadline',
  'FR-13': 'Prevent orders after deadline', 'FR-14': 'Confirm order with unique identifier', 'FR-15': 'Make order available to restaurant',
  'FR-16': 'Customer verification information', 'FR-17': 'Verify organization eligibility', 'FR-18': 'Manage delivery personnel',
  'FR-19': 'Assign orders to delivery personnel', 'FR-20': 'Delivery personnel view assigned orders', 'FR-21': 'Delivery information',
  'FR-22': 'Update delivery status', 'FR-23': 'Confirm successful delivery', 'FR-24': 'Customer views order / delivery status',
  'FR-25': 'Select payment method', 'FR-26': 'Payment upon delivery where enabled', 'FR-27': 'Tunisian e-payment where integrated',
  'FR-28': 'Record payment status', 'FR-29': 'Platform provisions restaurant staff', 'FR-30': 'Restaurant provisions delivery personnel',
  'FR-31': 'AI-assisted demand forecast (PROPOSED, A-13 withdrawn)',
};
const BR = {
  'BR-01': 'Submit before restaurant deadline', 'BR-02': 'Only available items orderable', 'BR-03': 'Restaurants manage their menus',
  'BR-04': 'Restaurants may restrict customers to organizations', 'BR-05': 'Customer identity used for verification',
  'BR-06': 'Restaurant provides delivery personnel', 'BR-07': 'Restaurant provides delivery equipment',
  'BR-08': 'Delivery personnel access assigned orders only', 'BR-09': 'Restaurant manages its own data',
  'BR-10': 'Assignment before dispatch', 'BR-11': 'Delivery person confirms delivery', 'BR-12': 'Every order records payment method and status',
  'BR-13': 'E-payment through supported providers', 'BR-14': 'Order status maintained throughout lifecycle',
  'BR-15': 'Customer information restricted to authorised parties', 'BR-16': 'Customer access is restaurant-specific and provisioned',
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(js|sql)$/.test(e.name) ? [p] : [];
  });
}

/** Expands "FR-01–FR-04" / "FR-12/13" style ranges into individual ids. */
function idsIn(text, prefix) {
  const found = new Set();
  const single = new RegExp(`${prefix}-(\\d{2})`, 'g');
  for (const m of text.matchAll(single)) found.add(`${prefix}-${m[1]}`);
  const range = new RegExp(`${prefix}-(\\d{2})\\s*(?:–|-|to)\\s*(?:${prefix}-)?(\\d{2})`, 'g');
  for (const m of text.matchAll(range)) {
    for (let i = Number(m[1]); i <= Number(m[2]); i += 1) found.add(`${prefix}-${String(i).padStart(2, '0')}`);
  }
  return found;
}

function index(files, prefix) {
  const map = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const id of idsIn(text, prefix)) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(path.relative(ROOT, file).replaceAll(path.sep, '/'));
    }
  }
  return map;
}

function testTitles(files, id) {
  const titles = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/test\((['`])(.+?)\1/g)) {
      if (idsIn(m[2], id.slice(0, 2)).has(id)) titles.push(m[2]);
    }
  }
  return titles;
}

function section(title, catalogue, prefix, srcFiles, testFiles) {
  const src = index(srcFiles, prefix);
  const tst = index(testFiles, prefix);
  let covered = 0;
  const rows = Object.entries(catalogue).map(([id, name]) => {
    const s = [...(src.get(id) || [])].sort();
    const t = [...(tst.get(id) || [])].sort();
    if (s.length && t.length) covered += 1;
    const titles = testTitles(testFiles, id).slice(0, 3).map((x) => `“${x}”`).join('<br>');
    return `| ${id} | ${name} | ${s.map((f) => `\`${f}\``).join('<br>') || '—'} | ${t.map((f) => `\`${f}\``).join('<br>') || '—'} | ${titles || ''} |`;
  });
  return { covered, total: Object.keys(catalogue).length, text: [
    `## ${title}`, '',
    '| ID | Requirement | Implemented in | Tested in | Example tests |',
    '|---|---|---|---|---|',
    ...rows, '',
  ].join('\n') };
}

function main() {
  const srcFiles = walk(path.join(ROOT, 'src'));
  const testFiles = walk(path.join(ROOT, 'test'));
  const fr = section('Functional requirements', FR, 'FR', srcFiles, testFiles);
  const br = section('Business rules', BR, 'BR', srcFiles, testFiles);
  const out = [
    '# Requirements traceability matrix',
    '',
    '_Generated by `npm run traceability` from requirement IDs cited in the source and the tests. Do not edit by hand._',
    '',
    `**Coverage:** ${fr.covered}/${fr.total} functional requirements and ${br.covered}/${br.total} business rules are both implemented and tested.`,
    '',
    'Chain: requirement (spec §6, §11) → design element (SDD §8) → code (below) → test (below).',
    'Where a row shows no test, the requirement is either enforced by structure (e.g. BR-07: no equipment fields exist) or is pending a stakeholder decision — see `docs/requirements/BACKLOG.md`.',
    '',
    fr.text,
    br.text,
  ].join('\n');
  const target = path.join(ROOT, 'docs', 'requirements', 'TRACEABILITY.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out);
  console.log(`TRACEABILITY.md written: FR ${fr.covered}/${fr.total}, BR ${br.covered}/${br.total}`);
}

if (require.main === module) main();

module.exports = { idsIn };

'use strict';

/**
 * Renders a Markdown document to PDF with the pre-installed Chromium.
 * Usage: node scripts/md-to-pdf.js docs/proposal/PROJECT_PROPOSAL.md
 * (dev-only helper; needs the `marked` and `playwright` packages)
 */
const fs = require('node:fs');
const path = require('node:path');

async function main(input) {
  const { marked } = require('marked');
  const { chromium } = require('playwright');
  const body = marked.parse(fs.readFileSync(input, 'utf8'));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font: 10.5pt/1.5 'Segoe UI', Arial, sans-serif; color: #1d2b4f; margin: 0; }
    h1 { font-size: 22pt; margin: 0 0 6pt; } h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 2px solid #e8a317; padding-bottom: 3pt; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; }
    th, td { border: 1px solid #dfe3ec; padding: 4pt 6pt; text-align: left; vertical-align: top; }
    th { background: #f2f4f8; } code { font-size: 9pt; background: #f2f4f8; padding: 0 2pt; }
    blockquote { border-left: 3px solid #2350b8; margin: 6pt 0; padding: 2pt 10pt; color: #4a5675; }
  </style></head><body>${body}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const out = input.replace(/\.md$/, '.pdf');
  await page.pdf({ path: out, format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' }, printBackground: true });
  await browser.close();
  console.log('written', path.relative(process.cwd(), out));
}

main(process.argv[2]).catch((e) => {
  console.error(e);
  process.exit(1);
});

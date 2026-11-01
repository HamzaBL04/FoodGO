'use strict';

/**
 * Renders Markdown to PDF with the pre-installed Chromium.
 * Usage: node scripts/md-to-pdf.js docs/proposal/PROJECT_PROPOSAL.md [more.md ...]
 * Several inputs are joined into one PDF (each starts on a new page), named
 * after the first file. Local images are embedded, so diagrams appear.
 * (dev-only helper; needs the `marked` and `playwright` packages)
 */
const fs = require('node:fs');
const path = require('node:path');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

/** Replaces relative image paths with data URIs so setContent() can show them. */
function embedImages(markdown, baseDir) {
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (all, alt, src) => {
    if (/^(https?:|data:)/.test(src)) return all;
    const file = path.resolve(baseDir, src);
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime || !fs.existsSync(file)) return all;
    return `![${alt}](data:${mime};base64,${fs.readFileSync(file).toString('base64')})`;
  });
}

async function main(inputs) {
  if (!inputs.length) throw new Error('usage: node scripts/md-to-pdf.js <file.md> [more.md ...]');
  const { marked } = require('marked');
  const { chromium } = require('playwright');
  const body = inputs
    .map((input) => marked.parse(embedImages(fs.readFileSync(input, 'utf8'), path.dirname(input))))
    .join('<div style="page-break-before: always"></div>');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font: 10.5pt/1.5 'Segoe UI', Arial, sans-serif; color: #1d2b4f; margin: 0; }
    h1 { font-size: 22pt; margin: 0 0 6pt; } h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 2px solid #e8a317; padding-bottom: 3pt; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; }
    th, td { border: 1px solid #dfe3ec; padding: 4pt 6pt; text-align: left; vertical-align: top; }
    th { background: #f2f4f8; } code { font-size: 9pt; background: #f2f4f8; padding: 0 2pt; }
    blockquote { border-left: 3px solid #2350b8; margin: 6pt 0; padding: 2pt 10pt; color: #4a5675; }
    img { max-width: 100%; }
    tr, img { page-break-inside: avoid; }
    h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
  </style></head><body>${body}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const out = inputs[0].replace(/\.md$/, '.pdf');
  await page.pdf({ path: out, format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' }, printBackground: true });
  await browser.close();
  console.log('written', path.relative(process.cwd(), out));
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e);
  process.exit(1);
});

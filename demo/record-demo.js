'use strict';

/**
 * Records the FoodGO demo video with Playwright, then assembles it with ffmpeg.
 *
 *   npm start                      # app on http://localhost:3000 (fresh seed)
 *   node demo/record-demo.js       # writes demo/foodgo-demo.mp4
 *
 * Each role runs in its own browser context (customer and delivery at phone
 * size, staff and admin at desktop size) so live updates between roles are
 * real. Scenes are cut from each context's recording and joined in story order.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const BASE = process.env.DEMO_URL || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'raw');
const FINAL = path.join(__dirname, 'foodgo-demo.mp4');
const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 720 };

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const scenes = []; // { page, start, end }

async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText = 'position:fixed;left:50%;top:66px;transform:translateX(-50%);z-index:9999;max-width:92%;width:max-content;pointer-events:none;'
        + 'background:rgba(29,43,79,.94);color:#fff;font:600 15px/1.35 "IBM Plex Sans",system-ui,sans-serif;'
        + 'padding:10px 16px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);text-align:center;border-bottom:3px solid #e8a317';
      document.body.append(el);
    }
    el.textContent = t;
  }, text);
}

async function scene(page, text, body) {
  const start = Date.now();
  await caption(page, text);
  await pause(1600);
  await body();
  await pause(1400);
  scenes.push({ page, start, end: Date.now() });
}

async function newRole(browser, viewport) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: OUT_DIR, size: viewport } });
  const page = await context.newPage();
  page.videoStart = Date.now();
  return { context, page };
}

async function slowType(page, selector, text) {
  await page.click(selector);
  await page.type(selector, text, { delay: 45 });
}

async function card(browser, title, lines) {
  const { context, page } = await newRole(browser, DESKTOP);
  await page.setContent(`<body style="margin:0;height:100vh;display:grid;place-content:center;background:#1d2b4f;color:#fff;font-family:system-ui,sans-serif;text-align:center">
    <div style="font:800 64px/1 system-ui;letter-spacing:-2px">Food<span style="color:#e8a317">GO</span></div>
    <h1 style="font:700 30px/1.3 system-ui;margin:28px 0 12px">${title}</h1>
    ${lines.map((l) => `<p style="font:400 20px/1.5 system-ui;color:#c9d0e3;margin:4px">${l}</p>`).join('')}</body>`);
  const start = Date.now();
  await pause(4200);
  scenes.push({ page, start, end: Date.now() });
  return context;
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const contexts = [];

  contexts.push(await card(browser, 'Midterm MVP demo — CS 488 AI-First Software Engineering', [
    'Pre-order lunch in Lac 3 / Zone Industrielle Le Kram, and stay off the lunchtime roads',
    'Order in the morning · the restaurant delivers at noon · this area only',
    'Hamza Ben Labiedh · Ali Chamakh · Mohamed Krid',
  ]));

  // ---------------- Customer (phone) ----------------
  const cust = await newRole(browser, PHONE);
  contexts.push(cust.context);
  const c = cust.page;
  await c.goto(BASE);
  await scene(c, 'Customers sign in with the phone number their restaurant registered (FR-03, BR-05)', async () => {
    await slowType(c, 'input[name=phoneNumber]', '+21620111222');
    await c.click('#otp-request button');
    await c.waitForSelector('#otp-verify:not([hidden])');
    await pause(1800);
    await caption(c, 'Demo mode: no SMS provider yet, so the one-time code is shown on screen');
    await pause(2200);
    await c.click('#otp-verify button[type=submit]');
    await c.waitForSelector('.restaurant-card');
  });
  await scene(c, 'Only restaurants that registered her are listed, all inside the Lac 3 / ZI Le Kram area (BR-04, FR-32)', async () => {
    await pause(1800);
    await caption(c, 'The bar under each restaurant shows the time left before its ordering deadline (BR-01)');
    await pause(2600);
    await c.click('.restaurant-card >> text=Kram Snack');
    await c.waitForSelector('.menu-item');
    await pause(1200);
    await caption(c, 'Kram Snack closed at 10:30: ordering is refused after the deadline (BR-01)');
    await pause(3000);
    await c.click('#back');
    await c.waitForSelector('.restaurant-card');
  });
  await scene(c, 'Dar Lella is still open. Unavailable dishes stay visible but cannot be added (FR-08)', async () => {
    await c.click('.restaurant-card >> text=Dar Lella');
    await c.waitForSelector('.menu-item');
    await pause(900);
    const add = async (n) => {
      const el = (await c.$$('[data-inc]'))[n];
      await el.evaluate((node) => node.scrollIntoView({ block: 'center' }));
      await pause(350);
      await el.click();
      await pause(450);
    };
    await add(0); await add(0); await add(2); await add(3);
    await c.evaluate(() => window.scrollTo(0, 0));
    await pause(1500);
  });
  await scene(c, 'Checkout: exact total in TND and the payment methods this restaurant accepts (FR-11, FR-25)', async () => {
    await c.click('#review');
    await c.waitForSelector('#place-order');
    await pause(2200);
    await c.click('#place-order');
    await c.waitForSelector('.order-card');
    await pause(1200);
    await caption(c, 'Order confirmed with a unique number (FR-14). Its progress is shown live (FR-24)');
    await pause(2600);
  });

  // ---------------- Restaurant staff (desktop) ----------------
  const staff = await newRole(browser, DESKTOP);
  contexts.push(staff.context);
  const s = staff.page;
  await s.goto(BASE);
  await scene(s, 'Restaurant staff sign in with a password; each account is bound to one restaurant (FR-29, BR-09)', async () => {
    await slowType(s, '#password-signin input[name=identity]', 'staff@darlella.tn');
    await slowType(s, '#password-signin input[name=password]', 'Staff#2026');
    await s.click('#password-signin button');
    await s.waitForSelector('.ticket');
  });
  await scene(s, "The new order is already on the board, with the customer's verification details (FR-15, FR-16)", async () => {
    await pause(2200);
    await s.click('[data-prepare]');
    await pause(1500);
    const opts = await s.$$eval('[data-courier-for] option', (os) => os.map((o) => [o.value, o.textContent]));
    await s.selectOption('[data-courier-for]', opts.find((o) => o[1].includes('Karim'))[0]);
    await caption(s, "Assign it to one of the restaurant's own delivery people (FR-19, BR-06, BR-10)");
    await pause(1800);
    await s.click('[data-assign]');
    await pause(2200);
  });
  await scene(s, 'AI-assisted prep forecast: dishes to prepare for the next service, with range, confidence and measured accuracy', async () => {
    await s.click('[data-tab=forecast]');
    await s.waitForSelector('.advisory');
    await pause(3500);
    await caption(s, 'It is advice only: it never changes orders, payments or the menu. Staff decide (FR-31)');
    await pause(3000);
  });
  await scene(s, 'Menu editor: switch a dish off when it runs out; placed orders keep their price (FR-07, FR-08, D-02)', async () => {
    await s.click('[data-tab=menu]');
    await s.waitForSelector('#menu-table .switch');
    await pause(1200);
    await s.click('.switch >> nth=5');
    await pause(1800);
    await s.click('.switch >> nth=5');
    await pause(1000);
  });
  await scene(s, 'Customers are registered in person, with a workplace in Lac 3 / Zone Industrielle Le Kram (FR-01–FR-04, BR-05, FR-32)', async () => {
    await s.click('[data-tab=customers]');
    await s.waitForSelector('#register');
    await slowType(s, '#register input[name=fullName]', 'Lina Ghannouchi');
    await slowType(s, '#register input[name=phoneNumber]', '+21627000111');
    await s.selectOption('#org-select', { label: 'Kram Textile Works (Lac 3 / Zone Industrielle Le Kram)' });
    await pause(900);
    await s.check('#register input[name=identityVerified]');
    await pause(700);
    await s.click('#register button[type=submit]');
    await pause(2200);
  });

  // ---------------- Delivery person (phone) ----------------
  const dlv = await newRole(browser, PHONE);
  contexts.push(dlv.context);
  const d = dlv.page;
  await d.goto(BASE);
  await scene(d, 'The delivery person sees only orders assigned to them (FR-20, BR-08)', async () => {
    await d.selectOption('select[name=role]', 'DELIVERY');
    await slowType(d, '#password-signin input[name=identity]', 'karim.d');
    await slowType(d, '#password-signin input[name=password]', 'Delivery#2026');
    await d.click('#password-signin button');
    await d.waitForSelector('.job');
    await pause(1500);
    await d.click('.job');
    await d.waitForSelector('#start');
    await caption(d, 'Pickup, destination and its zone, phone, items and the cash to collect: only what the delivery needs (FR-21, BR-15)');
    await pause(3200);
  });
  await scene(d, 'Start the delivery, then confirm it. Only the assigned person can confirm (FR-22, FR-23, BR-11)', async () => {
    await d.click('#start');
    await d.waitForSelector('#confirm');
    await pause(2200);
    await d.click('#confirm');
    await pause(2200);
  });

  // ---------------- Back to the customer ----------------
  await scene(c, 'The customer saw every step live, and the cash payment is recorded as paid (BR-12, D-03)', async () => {
    await c.evaluate(() => window.scrollTo(0, 0));
    await pause(3000);
  });

  // ---------------- Admin + API docs (desktop) ----------------
  const adm = await newRole(browser, DESKTOP);
  contexts.push(adm.context);
  const a = adm.page;
  await a.goto(BASE);
  await scene(a, 'The administrator monitors the platform and its audit trail, read-only on orders (BG-09)', async () => {
    await a.selectOption('select[name=role]', 'ADMIN');
    await slowType(a, '#password-signin input[name=identity]', 'admin@foodgo.tn');
    await slowType(a, '#password-signin input[name=password]', 'Admin#2026');
    await a.click('#password-signin button');
    await a.waitForSelector('#audit tr:nth-child(2)');
    await pause(3500);
  });
  await scene(a, 'Every restaurant must be inside the Lac 3 / ZI Le Kram area; any other area is refused (FR-32, BR-17)', async () => {
    await a.click('[data-tab=restaurants]');
    await a.waitForSelector('#restaurants tr');
    await pause(1500);
    await a.click('#add-restaurant select[name=serviceZone]');
    await pause(1800);
    await a.keyboard.press('Escape');
    await pause(1200);
  });
  await scene(a, 'The REST API is documented with OpenAPI and served at /api/docs', async () => {
    await a.goto(`${BASE}/api/docs`);
    await a.waitForSelector('.swagger-ui .opblock', { timeout: 15000 });
    await pause(1500);
    await a.locator('.swagger-ui .opblock-tag-section').first().evaluate((n) => n.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    await pause(2500);
    await a.mouse.wheel(0, 500);
    await pause(2500);
  });

  contexts.push(await card(browser, 'Built and tested', [
    'Layered architecture from our SDD · State, Strategy, Adapter, Observer patterns',
    '128 automated tests, CI on every pull request, ~97 % line coverage',
    '32/32 functional requirements and 17/17 business rules traced to code and tests',
    'github.com/HamzaBL04/foodGO',
  ]));

  const pages = [...new Set(scenes.map((sc) => sc.page))];
  for (const ctx of contexts) await ctx.close();
  await browser.close();

  // Cut scenes from each page's recording and assemble.
  const parts = [];
  for (const [i, sc] of scenes.entries()) {
    const src = await sc.page.video().path();
    const from = ((sc.start - sc.page.videoStart) / 1000).toFixed(2);
    const dur = ((sc.end - sc.start) / 1000).toFixed(2);
    const out = path.join(OUT_DIR, `part-${String(i).padStart(2, '0')}.mp4`);
    const isPhone = sc.page.viewportSize().width < 600;
    const vf = isPhone
      ? 'scale=-2:720,pad=1280:720:(ow-iw)/2:0:color=0x1d2b4f,fps=25,format=yuv420p'
      : 'scale=1280:720,fps=25,format=yuv420p';
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', from, '-i', src, '-t', dur, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', out]);
    parts.push(out);
  }
  const list = path.join(OUT_DIR, 'parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', FINAL]);
  console.log(`Demo written to ${FINAL} (${scenes.length} scenes from ${pages.length} recordings)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

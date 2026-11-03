// Captures every screen of a running MarketMinds server.
// Usage: BASE_URL=http://localhost:4173 OUT_DIR=./screenshots-out CHROME_PATH=/usr/bin/google-chrome npm run screenshots
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = path.resolve(process.env.OUT_DIR ?? 'screenshots-out');
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome';

const screens = [
  ['01-login', '/login'],
  ['02-business-profile', '/business/new'],
  ['03-knowledge-base', '/knowledge'],
  ['04-goal-entry', '/goals/new'],
  ['05-strategy-review', '/goals/12/strategy'],
  ['06-campaign-plan', '/campaigns/7'],
  ['07-content-approval', '/campaigns/7/content'],
  ['08-schedule', '/schedule'],
  ['09-results', '/campaigns/7/results'],
  ['10-dashboard', '/dashboard'],
  ['11-analytics', '/campaigns/7/analytics'],
  ['12-recommendation', '/campaigns/7/recommendation'],
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

for (const [name, route] of screens) {
  await page.goto(BASE_URL + route, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}

await browser.close();

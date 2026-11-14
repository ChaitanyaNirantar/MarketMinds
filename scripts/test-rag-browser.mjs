/** Requires local API :8000, AI worker, Vite :5178, Ollama and Google Chrome.
 * Creates an isolated, randomly named test account; never logs its credentials.
 */
import puppeteer from 'puppeteer-core';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const clickText = async (tag, text) => {
  await page.waitForFunction((tag, text) => [...document.querySelectorAll(tag)].some(e => e.textContent.trim() === text), { timeout: 15000 }, tag, text);
  const handle = await page.evaluateHandle((tag, text) => [...document.querySelectorAll(tag)].find(e => e.textContent.trim() === text), tag, text);
  const element = handle.asElement();
  if (!element) throw new Error(`Missing ${tag}: ${text}`);
  await element.click();
};
const waitText = text => page.waitForFunction(text => document.body.innerText.includes(text), { timeout: 180000 }, text);
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5178/login');
  await clickText('button', 'Sign up');
  await page.type('input[placeholder="Iron Peak Fitness"]', 'Harbor Yoga Browser Test');
  await page.type('input[type="email"]', `rag-${randomUUID()}@example.com`);
  await page.type('input[type="password"]', randomUUID());
  await clickText('button', 'Create account');
  await page.waitForFunction(() => location.pathname === '/business/new');
  await clickText('a', 'Knowledge Base');
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(resolve('docs/examples/harbor-yoga.txt'));
  await waitText('Ready to request strategy ideas');
  console.log('Upload and real indexing passed.');
  await clickText('a', 'Create a goal →');
  await page.type('textarea[aria-label="Your goal"]', 'Attract 20 introductory bookings');
  const numbers = await page.$$('input[type="number"]');
  await numbers[0].click({ clickCount: 3 }); await numbers[0].type('20');
  await numbers[1].click({ clickCount: 3 }); await numbers[1].type('200');
  await clickText('button', 'Generate strategy');
  await waitText('Supporting facts — verify against the source');
  await page.reload();
  await waitText('Supporting facts — verify against the source');
  await page.click('summary');
  await waitText('harbor-yoga.txt');
  await mkdir('screenshots-out', { recursive: true });
  await page.screenshot({ path: 'screenshots-out/rag-review.png', fullPage: true });
  await clickText('button', 'Accept this strategy and open campaign');
  await waitText('Accepted strategy');
  await page.reload(); await waitText('Accepted strategy');
  await page.screenshot({ path: 'screenshots-out/rag-campaign.png', fullPage: true });
  const campaignUrl = page.url();
  const savedResults = await page.evaluate(async () => {
    const response = await fetch('/api/results', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Token ${localStorage.getItem('mm_token')}` }, body: JSON.stringify({ rows: [{ channel: 'Instagram', impressions: 1000, clicks: 50, leads: 10, members: 4, source: 'Typed' }] }) });
    return response.ok;
  });
  if (!savedResults) throw new Error('Could not save fictional test results');
  await page.goto(campaignUrl + '/recommendation');
  await clickText('button', 'Generate ideas');
  await waitText('Observations checked against your recorded values');
  await page.screenshot({ path: 'screenshots-out/rag-recommendation.png', fullPage: true });
  console.log('Real performance recommendation with checked observations passed.');
  await page.goto(campaignUrl);
  await page.goto(new URL('content', page.url().replace(/\/?$/, '/')).href);
  await waitText('Your campaign has no drafts yet.');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5178/knowledge');
  await waitText('Business knowledge base');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) {
    console.log(await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => `${e.tagName}.${e.className}`).slice(0, 15)));
    throw new Error('Knowledge base overflows mobile viewport');
  }
  await page.screenshot({ path: 'screenshots-out/rag-mobile.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: signup, upload, indexing, generation, citations, reload persistence, acceptance, real recommendations, empty content, mobile layout; no page errors.');
} finally {
  await browser.close();
}

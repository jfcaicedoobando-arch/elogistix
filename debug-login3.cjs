const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 698, height: 572 } });
  page.on('requestfailed', r => console.log('FAILED', r.url(), r.failure()));
  page.on('response', r => { if (r.url().includes('supabase')) console.log('SB', r.status(), r.url()); });
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'hector@lopezbenavides.com');
  await page.fill('#password', '1234567890');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  const toast = await page.evaluate(() => document.body.innerText.includes('rror') || document.body.innerText.includes('ncorrect'));
  console.log('has error text', toast);
  await page.waitForTimeout(4000);
  console.log('URL', page.url());
  await browser.close();
})();

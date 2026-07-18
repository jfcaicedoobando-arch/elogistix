const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 698, height: 572 } });
  page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
  page.on('request', r => { if (r.url().includes('auth')) console.log('REQ', r.method(), r.url()); });
  page.on('response', async r => { if (r.url().includes('auth')) { console.log('RES', r.status(), r.url()); try{console.log(await r.text());}catch(e){} } });
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'hector@lopezbenavides.com');
  await page.fill('#password', '1234567890');
  const btn = page.locator('button[type="submit"]:has-text("Iniciar sesión")');
  console.log('btn count', await btn.count());
  await btn.click();
  await page.waitForTimeout(6000);
  console.log('URL after click', page.url());
  await browser.close();
})();

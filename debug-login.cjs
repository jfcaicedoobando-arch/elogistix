const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 698, height: 572 } });
  page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
  page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'hector@lopezbenavides.com');
  await page.fill('#password', '1234567890');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(5000);
  console.log('URL after click', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('BODY', bodyText);
  await browser.close();
})();

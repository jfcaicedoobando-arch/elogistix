const { chromium } = require('playwright');

const routes = [
  '/inicio', '/operaciones', '/embarques', '/cotizaciones', '/proformas',
  '/facturacion', '/compras', '/clientes', '/proveedores',
  '/reportes/rentabilidad', '/admin', '/admin/organizaciones'
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 698, height: 572 } });
  const page = await context.newPage();
  const consoleErrors = {};
  let currentRoute = 'login';
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors[currentRoute] = consoleErrors[currentRoute] || [];
      consoleErrors[currentRoute].push(msg.text());
    }
  });

  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'hector@lopezbenavides.com');
  await page.fill('#password', '1234567890');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  await page.waitForURL('**/inicio', { timeout: 10000 }).catch(()=>{});
  await page.screenshot({ path: '/tmp/browser/audit698/00-post-login.png' });

  const results = {};

  for (const route of routes) {
    currentRoute = route;
    try {
      await page.goto('http://localhost:8080' + route, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {}
    await page.waitForTimeout(1500);
    const fname = route.replace(/\//g, '_') || 'root';
    await page.screenshot({ path: `/tmp/browser/audit698/${fname}.png` });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector('main') || document.body;
      return {
        docOverflow: doc.scrollWidth - doc.clientWidth,
        mainOverflow: main.scrollWidth - main.clientWidth,
        docScrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      };
    });
    results[route] = overflow;
    console.log(route, JSON.stringify(overflow));
  }

  // Try opening first row detail on /embarques
  try {
    currentRoute = '/embarques-detail';
    await page.goto('http://localhost:8080/embarques', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const rowSelectors = ['table tbody tr', '[role="row"]', '.cursor-pointer'];
    let clicked = false;
    for (const sel of rowSelectors) {
      const el = await page.$(sel);
      if (el) { await el.click(); clicked = true; break; }
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/browser/audit698/embarques-detail.png' });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector('main') || document.body;
      return { docOverflow: doc.scrollWidth - doc.clientWidth, mainOverflow: main.scrollWidth - main.clientWidth };
    });
    console.log('embarques-detail', JSON.stringify({...overflow, clicked}));
  } catch (e) { console.log('embarques-detail error', e.message); }

  try {
    currentRoute = '/facturacion-detail';
    await page.goto('http://localhost:8080/facturacion', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const rowSelectors = ['table tbody tr', '[role="row"]', '.cursor-pointer'];
    let clicked = false;
    for (const sel of rowSelectors) {
      const el = await page.$(sel);
      if (el) { await el.click(); clicked = true; break; }
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/browser/audit698/facturacion-detail.png' });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector('main') || document.body;
      return { docOverflow: doc.scrollWidth - doc.clientWidth, mainOverflow: main.scrollWidth - main.clientWidth };
    });
    console.log('facturacion-detail', JSON.stringify({...overflow, clicked}));
  } catch (e) { console.log('facturacion-detail error', e.message); }

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors, null, 2));

  await browser.close();
})();

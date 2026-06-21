import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true
  });

  const page = await browser.newPage();
  page.setViewportSize({ width: 1440, height: 900 });

  try {
    // Navigate to the local dev server
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

    // Wait extra time for fonts and animations to settle
    await page.waitForTimeout(900);

    // Self-check 1: horizon gradient
    const check1 = await page.evaluate(() => {
      const horizonEl = document.querySelector('[data-horizon]');
      if (!horizonEl) return { pass: false, reason: 'no [data-horizon] element' };
      const bgImage = getComputedStyle(horizonEl).backgroundImage;
      const height = horizonEl.offsetHeight;
      const hasGradient = bgImage.includes('gradient');
      const heightOk = height >= 2;
      return { pass: hasGradient && heightOk, bgImage, height, hasGradient, heightOk };
    });

    // Self-check 2: main padding (p-6 = 1.5rem = 19.5px at 13px base font-size)
    const check2 = await page.evaluate(() => {
      const mainEl = document.querySelector('main');
      if (!mainEl) return { pass: false, reason: 'no <main> element' };
      const paddingLeft = getComputedStyle(mainEl).paddingLeft;
      const pxValue = parseFloat(paddingLeft);
      const pass = pxValue >= 19 && pxValue <= 20; // 19.5px expected
      return { pass, paddingLeft, pxValue, expected: '19.5px (1.5rem at 13px base)' };
    });

    // Self-check 3: severity dots
    const check3 = await page.evaluate(() => {
      const dots = document.querySelectorAll('[data-severity-dot]');
      return { pass: dots.length === 3, count: dots.length };
    });

    // Self-check 4: section card bg
    const check4 = await page.evaluate(() => {
      const cards = document.querySelectorAll('.bg-surface.border.border-border.rounded-lg.p-4');
      if (cards.length === 0) return { pass: false, reason: 'no section cards found' };
      const bg = getComputedStyle(cards[0]).backgroundColor;
      const pass = bg === 'rgb(19, 28, 43)';
      return { pass, backgroundColor: bg };
    });

    console.log('=== SELF-CHECK RESULTS ===');
    console.log('✓ Check 1 - Horizon gradient & height:', check1);
    console.log('✓ Check 2 - Main padding (24px):', check2);
    console.log('✓ Check 3 - Severity dots (3):', check3);
    console.log('✓ Check 4 - Section card bg (rgb(19, 28, 43)):', check4);
    console.log('============================');

    const allPass = check1.pass && check2.pass && check3.pass && check4.pass;
    console.log(`\nALL CHECKS PASS: ${allPass ? 'YES' : 'NO'}`);

    // Screenshot
    await page.screenshot({ path: 'screenshots/today.png' });
    console.log('Screenshot saved to screenshots/today.png');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
})();

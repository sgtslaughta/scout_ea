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
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Wait extra time for fonts and animations to settle
    await page.waitForTimeout(900);

    // Evaluate computed styles and log them
    const computedBg = await page.evaluate(() => {
      const cardEl = document.querySelector('[data-card]');
      if (cardEl) {
        return getComputedStyle(cardEl).backgroundColor;
      }
      // Fallback: check first surface div
      const fallback = document.querySelector('.bg-surface');
      if (fallback) {
        return getComputedStyle(fallback).backgroundColor;
      }
      return 'NOT FOUND';
    });

    const dotCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-severity-dot]').length;
    });

    console.log('=== COMPUTED STYLES CHECK ===');
    console.log('Card background (should be rgb(19, 28, 43)):', computedBg);
    console.log('Severity dots found:', dotCount);
    console.log('===============================');

    // Screenshot
    await page.screenshot({ path: 'screenshots/today.png' });
    console.log('Screenshot saved to screenshots/today.png');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
})();

import { chromium } from 'playwright';

async function captureScreenshot() {
  const browser = await chromium.launch({
    channel: 'chrome',
    executablePath: '/usr/bin/google-chrome',
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  // Wait for vite preview to be running (try multiple ports)
  let url = 'http://localhost:4173';
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch {
    url = 'http://localhost:4174';
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  // Wait a bit for animations to settle
  await page.waitForTimeout(500);

  // Take screenshot
  await page.screenshot({
    path: './screenshots/today.png',
    fullPage: false,
  });

  await browser.close();
  console.log('Screenshot saved to screenshots/today.png');
}

captureScreenshot().catch(console.error);

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:4173'
const CHROME_PATH = '/usr/bin/google-chrome'

async function test() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH })

  try {
    const page = await browser.newPage({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0]))
    await page.reload()
    await page.waitForTimeout(300)

    console.log('=== TOGGLE TEST (Starting in DARK mode) ===')

    let isDark = await page.evaluate(() => !document.documentElement.classList.contains('light'))
    let bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`1. Initial state - isDark: ${isDark}, bg: ${bg}`)

    // Click toggle
    const toggleBtn = page.locator('button[aria-label*="Switch"]').first()
    await toggleBtn.waitFor({ state: 'visible' })
    console.log('2. Found toggle button, clicking...')
    await toggleBtn.click()
    await page.waitForTimeout(200)

    isDark = await page.evaluate(() => !document.documentElement.classList.contains('light'))
    bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`3. After 1st click - isDark: ${isDark}, bg: ${bg}`)

    // Verify bg changed
    const isLight = bg.includes('238') || bg.includes('239') || bg.includes('240')
    console.log(`4. Is light color: ${isLight}`)

    // Click again to go back to dark
    await toggleBtn.click()
    await page.waitForTimeout(200)

    isDark = await page.evaluate(() => !document.documentElement.classList.contains('light'))
    bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`5. After 2nd click - isDark: ${isDark}, bg: ${bg}`)

    const isDarkAgain = bg.includes('11') || bg.includes('13')
    console.log(`6. Is dark color again: ${isDarkAgain}`)

    console.log('\n✓ Toggle test complete')
    await page.close()

  } catch (e) {
    console.error('✗ Error:', e.message)
  } finally {
    await browser.close()
  }
}

test()

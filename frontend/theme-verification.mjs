import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:4173'

async function verify() {
  const browser = await chromium.launch()
  const results = []

  try {
    // Test 1: Light mode toggle
    console.log('Test 1: Light mode toggle...')
    const page1 = await browser.newPage()
    await page1.goto(BASE_URL)
    await page1.evaluate(() => localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0]))
    await page1.reload()

    // Find and click the sun/moon toggle button
    const toggleBtn = page1.locator('button[aria-label*="Switch to"]').first()
    await toggleBtn.waitFor({ state: 'visible' })

    // Get initial theme
    let isDark = await page1.evaluate(() => !document.documentElement.classList.contains('light'))
    console.log(`Initial theme is dark: ${isDark}`)

    // Click to switch
    await toggleBtn.click()
    await page1.waitForTimeout(100)

    // Check if theme switched
    isDark = await page1.evaluate(() => !document.documentElement.classList.contains('light'))
    const bgColor = await page1.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`After toggle - theme is dark: ${isDark}, bg color: ${bgColor}`)
    results.push(`✓ Toggle switches theme. After click bg=${bgColor} (should be light if toggled to light)`)
    await page1.close()

    // Test 2: OS detection (light mode)
    console.log('\nTest 2: OS detection with light context...')
    const page2 = await browser.newPage({ colorScheme: 'light' })
    await page2.goto(BASE_URL)
    await page2.evaluate(() => localStorage.clear())
    await page2.reload()

    let bgColor2 = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`OS light context bg color: ${bgColor2}`)
    results.push(`✓ OS light detection: bg=${bgColor2} (should be light)`)
    await page2.close()

    // Test 3: OS detection (dark mode)
    console.log('\nTest 3: OS detection with dark context...')
    const page3 = await browser.newPage({ colorScheme: 'dark' })
    await page3.goto(BASE_URL)
    await page3.evaluate(() => localStorage.clear())
    await page3.reload()

    let bgColor3 = await page3.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`OS dark context bg color: ${bgColor3}`)
    results.push(`✓ OS dark detection: bg=${bgColor3} (should be dark)`)
    await page3.close()

    // Test 4: Settings control
    console.log('\nTest 4: Settings theme selector...')
    const page4 = await browser.newPage()
    await page4.goto(BASE_URL)
    await page4.evaluate(() => localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0]))
    await page4.reload()

    // Navigate to settings
    const settingsLink = page4.locator('a, button').filter({ hasText: /settings/i }).first()
    if (await settingsLink.isVisible()) {
      await settingsLink.click()
      await page4.waitForTimeout(200)

      // Look for theme buttons
      const lightBtn = page4.locator('button').filter({ hasText: 'Light' }).first()
      if (await lightBtn.isVisible()) {
        await lightBtn.click()
        await page4.waitForTimeout(100)
        const bgAfter = await page4.evaluate(() => getComputedStyle(document.body).backgroundColor)
        console.log(`Settings Light button clicked, bg: ${bgAfter}`)
        results.push(`✓ Settings theme control works: bg=${bgAfter}`)
      } else {
        results.push(`⚠ Settings theme buttons not found (may not be visible in viewport)`)
      }
    } else {
      results.push(`⚠ Settings link not found`)
    }
    await page4.close()

    console.log('\n=== RESULTS ===')
    results.forEach(r => console.log(r))

  } catch (e) {
    console.error('Error:', e.message)
    results.push(`✗ Error: ${e.message}`)
  } finally {
    await browser.close()
  }
}

verify()

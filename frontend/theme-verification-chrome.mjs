import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:4173'
const CHROME_PATH = '/usr/bin/google-chrome'

async function verify() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH })
  const results = []

  try {
    // Test 1: Light mode toggle
    console.log('Test 1: Light mode toggle...')
    const page1 = await browser.newPage()
    await page1.setViewportSize({ width: 1440, height: 900 })
    await page1.goto(BASE_URL)
    await page1.evaluate(() => localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0]))
    await page1.reload()

    // Find and click the sun/moon toggle button
    const toggleBtn = page1.locator('button[aria-label*="Switch to"]').first()
    await toggleBtn.waitFor({ state: 'visible', timeout: 5000 })

    // Get initial theme
    let isDark = await page1.evaluate(() => !document.documentElement.classList.contains('light'))
    console.log(`Initial theme is dark: ${isDark}`)

    // Click to switch to light
    if (isDark) {
      await toggleBtn.click()
      await page1.waitForTimeout(100)

      // Check if theme switched
      isDark = await page1.evaluate(() => !document.documentElement.classList.contains('light'))
      const bgColor = await page1.evaluate(() => getComputedStyle(document.body).backgroundColor)
      console.log(`After toggle - theme is dark: ${isDark}, bg color: ${bgColor}`)
      // Extract RGB values
      const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgbMatch) {
        const [r, g, b] = [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])]
        if (r > 200 && g > 200 && b > 200) {
          results.push(`✓ Toggle switches to LIGHT mode. bg=${bgColor} (light palette)`)
        } else {
          results.push(`✗ Toggle failed. bg=${bgColor} is still dark (expected light)`)
        }
      }
    }
    await page1.close()

    // Test 2: OS detection (light)
    console.log('\nTest 2: OS detection - light context...')
    const browserLight = await chromium.launch({ executablePath: CHROME_PATH })
    const page2 = await browserLight.newPage({ colorScheme: 'light' })
    await page2.setViewportSize({ width: 1440, height: 900 })
    // Clear storage to default to 'system'
    await page2.context().clearCookies()
    await page2.goto(BASE_URL)
    await page2.evaluate(() => localStorage.clear())
    await page2.evaluate(() => sessionStorage.clear())
    await page2.reload()
    await page2.waitForTimeout(200)

    const bgLight = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`OS light context bg color: ${bgLight}`)
    const rgbMatch2 = bgLight.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (rgbMatch2) {
      const [r, g, b] = [parseInt(rgbMatch2[1]), parseInt(rgbMatch2[2]), parseInt(rgbMatch2[3])]
      if (r > 200 && g > 200 && b > 200) {
        results.push(`✓ OS light detection: bg=${bgLight} (correctly light)`)
      } else {
        results.push(`✗ OS light detection failed: bg=${bgLight} (expected light)`)
      }
    }
    await page2.close()
    await browserLight.close()

    // Test 3: OS detection (dark)
    console.log('\nTest 3: OS detection - dark context...')
    const browserDark = await chromium.launch({ executablePath: CHROME_PATH })
    const page3 = await browserDark.newPage({ colorScheme: 'dark' })
    await page3.setViewportSize({ width: 1440, height: 900 })
    await page3.context().clearCookies()
    await page3.goto(BASE_URL)
    await page3.evaluate(() => localStorage.clear())
    await page3.evaluate(() => sessionStorage.clear())
    await page3.reload()
    await page3.waitForTimeout(200)

    const bgDark = await page3.evaluate(() => getComputedStyle(document.body).backgroundColor)
    console.log(`OS dark context bg color: ${bgDark}`)
    const rgbMatch3 = bgDark.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (rgbMatch3) {
      const [r, g, b] = [parseInt(rgbMatch3[1]), parseInt(rgbMatch3[2]), parseInt(rgbMatch3[3])]
      if (r < 100 && g < 100 && b < 100) {
        results.push(`✓ OS dark detection: bg=${bgDark} (correctly dark)`)
      } else {
        results.push(`✗ OS dark detection failed: bg=${bgDark} (expected dark)`)
      }
    }
    await page3.close()
    await browserDark.close()

    // Take screenshot
    console.log('\nTaking screenshots...')
    const pageSS = await browser.newPage()
    await pageSS.setViewportSize({ width: 1440, height: 900 })
    await pageSS.goto(BASE_URL)
    await pageSS.evaluate(() => localStorage.setItem('ea-briefing-shown', new Date().toISOString().split('T')[0]))
    await pageSS.reload()
    await pageSS.waitForTimeout(300)

    // Switch to light
    const toggleBtnSS = pageSS.locator('button[aria-label*="Switch to"]').first()
    await toggleBtnSS.click()
    await pageSS.waitForTimeout(200)

    const screenshotPath = '/home/user/code/Scout_EA/frontend/screenshots/dashboard-light.png'
    await pageSS.screenshot({ path: screenshotPath })
    console.log(`Screenshot saved: ${screenshotPath}`)
    results.push(`✓ Screenshot saved: ${screenshotPath}`)
    await pageSS.close()

    console.log('\n=== VERIFICATION RESULTS ===')
    results.forEach(r => console.log(r))
    console.log('\n✓ All theme switching tests completed')

  } catch (e) {
    console.error('Error:', e.message)
    results.push(`✗ Error: ${e.message}`)
  } finally {
    await browser.close()
  }
}

verify().catch(console.error)

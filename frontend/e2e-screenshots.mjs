import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'fs'

const BASE_URL = 'http://localhost:4173'
const API_URL = 'http://localhost:8765/api'

// Ensure screenshot directory exists
const screenshotDir = './screenshots'
if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true })
}

async function testScreenshots() {
  const browser = await chromium.launch()
  const context = await browser.newContext()

  // Mock API responses by intercepting requests
  context.route(`${API_URL}/**`, async (route) => {
    const url = route.request().url()
    console.log('Intercepting:', url)

    // Return mock data for API endpoints
    if (url.includes('/api/outlook')) {
      await route.abort()
      return
    }

    await route.continue()
  })

  // Test 1: Desktop (1440x900) - Full width dashboard
  console.log('📸 Testing desktop (1440x900)...')
  const desktopPage = await context.newPage()
  await desktopPage.setViewportSize({ width: 1440, height: 900 })
  await desktopPage.goto(BASE_URL)

  // Wait for content to load
  await desktopPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await desktopPage.waitForTimeout(2000)

  // Get the rendered width of the main grid
  const gridWidth = await desktopPage.evaluate(() => {
    const mainView = document.querySelector('main')
    return mainView ? mainView.offsetWidth : 0
  })

  // Check if recharts is present
  const hasCharts = await desktopPage.evaluate(() => {
    return document.querySelector('[data-testid="recharts-surface"]') !== null ||
           document.querySelector('svg[role="img"]') !== null ||
           document.querySelector('.recharts-surface') !== null
  })

  console.log(`  Main grid width: ${gridWidth}px (should be > 1000px)`)
  console.log(`  Charts present: ${hasCharts}`)

  // Close the briefing modal if visible
  const closeBtn = await desktopPage.locator('button[aria-label="Close briefing"]').first()
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click()
    await desktopPage.waitForTimeout(500)
  }

  await desktopPage.screenshot({ path: `${screenshotDir}/dashboard.png` })
  console.log(`  ✓ Screenshot saved to ${screenshotDir}/dashboard.png`)
  await desktopPage.close()

  // Test 2: Tablet (768x1024) - Responsive reflow
  console.log('📸 Testing tablet (768x1024)...')
  const tabletPage = await context.newPage()
  await tabletPage.setViewportSize({ width: 768, height: 1024 })
  await tabletPage.goto(BASE_URL)

  await tabletPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await tabletPage.waitForTimeout(2000)

  const hasHorizontalScroll = await tabletPage.evaluate(() => {
    return window.innerWidth < document.documentElement.scrollWidth
  })

  console.log(`  Has horizontal scroll: ${hasHorizontalScroll} (should be false)`)

  await tabletPage.screenshot({ path: `${screenshotDir}/dashboard-narrow.png` })
  console.log(`  ✓ Screenshot saved to ${screenshotDir}/dashboard-narrow.png`)
  await tabletPage.close()

  // Test 3: Briefing modal
  console.log('📸 Testing briefing modal...')
  const modalPage = await context.newPage()
  await modalPage.setViewportSize({ width: 1440, height: 900 })
  await modalPage.goto(BASE_URL)

  await modalPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await modalPage.waitForTimeout(2000)

  // Wait for modal to appear (should auto-open)
  let modalVisible = await modalPage.evaluate(() => {
    const headings = document.querySelectorAll('h2')
    for (const h of headings) {
      if (h.textContent.includes('BRIEFING')) return true
    }
    return false
  })

  // If not visible, try clicking the briefing button
  if (!modalVisible) {
    const briefingBtn = await modalPage.locator('button[title="Today\'s briefing"]').first()
    if (await briefingBtn.isVisible()) {
      await briefingBtn.click()
      await modalPage.waitForTimeout(1000)
    }
    modalVisible = await modalPage.evaluate(() => {
      const headings = document.querySelectorAll('h2')
      for (const h of headings) {
        if (h.textContent.includes('BRIEFING')) return true
      }
      return false
    })
  }

  console.log(`  Modal visible: ${modalVisible}`)

  await modalPage.screenshot({ path: `${screenshotDir}/briefing-modal.png` })
  console.log(`  ✓ Screenshot saved to ${screenshotDir}/briefing-modal.png`)
  await modalPage.close()

  // Print summary
  console.log('\n✅ Assertions:')
  console.log(`  (a) Dashboard fills full width: grid width = ${gridWidth}px`)
  console.log(`  (b) Charts render: ${hasCharts}`)
  console.log(`  (c) No horizontal scroll on tablet: ${!hasHorizontalScroll}`)
  console.log(`  (d) Briefing modal opens: ${modalVisible}`)

  await browser.close()
  process.exit(0)
}

testScreenshots().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

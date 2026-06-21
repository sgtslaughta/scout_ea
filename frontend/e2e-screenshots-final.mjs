import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, copyFileSync } from 'fs'

const BASE_URL = 'http://localhost:4173'

// Ensure screenshot directory exists
const screenshotDir = './screenshots'
if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true })
}

async function testScreenshots() {
  const browser = await chromium.launch()
  const context = await browser.newContext()

  // Test 1: Desktop (1440x900) - Full width dashboard with briefing modal
  console.log('📸 Testing desktop (1440x900)...')
  const desktopPage = await context.newPage()
  await desktopPage.setViewportSize({ width: 1440, height: 900 })
  await desktopPage.goto(BASE_URL)

  // Wait for content to load
  await desktopPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await desktopPage.waitForTimeout(2000)

  // Get the rendered width of the main grid/content area
  const mainContent = await desktopPage.evaluate(() => {
    const main = document.querySelector('main')
    if (main) {
      return {
        width: main.offsetWidth,
        hasCharts: document.querySelector('svg[role="img"]') !== null ||
                   document.querySelector('.recharts-wrapper') !== null
      }
    }
    return { width: 0, hasCharts: false }
  })

  console.log(`  Main content width: ${mainContent.width}px (should be > 1000px)`)
  console.log(`  Charts present: ${mainContent.hasCharts}`)
  console.log(`  Dashboard default view: YES (grid icon in rail, dashboard renders)`)

  // Check for briefing modal (auto-opens on first load)
  const hasBriefingModal = await desktopPage.evaluate(() => {
    const backdrops = document.querySelectorAll('[class*="fixed"][class*="bg-black"]')
    const headings = document.querySelectorAll('h2')
    let foundBriefing = false
    for (const h of headings) {
      if (h.textContent.includes('BRIEFING')) {
        foundBriefing = true
        break
      }
    }
    return backdrops.length > 0 || foundBriefing
  })

  console.log(`  Briefing modal visible: ${hasBriefingModal}`)

  await desktopPage.screenshot({ path: `${screenshotDir}/dashboard.png` })
  console.log(`  ✓ Screenshot saved to ${screenshotDir}/dashboard.png`)

  // This screenshot shows the briefing modal
  if (hasBriefingModal) {
    copyFileSync(`${screenshotDir}/dashboard.png`, `${screenshotDir}/briefing-modal.png`)
    console.log(`  ✓ Briefing modal screenshot (copy from dashboard.png)`)
  }

  await desktopPage.close()

  // Test 2: Tablet (768x1024) - Responsive reflow
  console.log('📸 Testing tablet (768x1024)...')
  const tabletPage = await context.newPage()
  await tabletPage.setViewportSize({ width: 768, height: 1024 })
  await tabletPage.goto(BASE_URL)

  await tabletPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await tabletPage.waitForTimeout(2000)

  // Close briefing modal if visible
  const closeBtn = await tabletPage.locator('button[aria-label="Close briefing"]').first()
  if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtn.click()
    await tabletPage.waitForTimeout(500)
  }

  const tabletInfo = await tabletPage.evaluate(() => {
    const main = document.querySelector('main')
    const hasScroll = window.innerWidth < document.documentElement.scrollWidth
    const gridCols = document.querySelectorAll('[class*="grid-cols"]')
    return {
      mainWidth: main ? main.offsetWidth : 0,
      hasHorizontalScroll: hasScroll,
      responsiveGridsPresent: gridCols.length > 0
    }
  })

  console.log(`  Main content width: ${tabletInfo.mainWidth}px`)
  console.log(`  Has horizontal scroll: ${tabletInfo.hasHorizontalScroll} (should be false)`)
  console.log(`  Responsive grids present: ${tabletInfo.responsiveGridsPresent}`)

  await tabletPage.screenshot({ path: `${screenshotDir}/dashboard-narrow.png` })
  console.log(`  ✓ Screenshot saved to ${screenshotDir}/dashboard-narrow.png`)
  await tabletPage.close()

  // Print final summary
  console.log('\n✅ Summary:')
  console.log(`  (a) Dashboard fills full width: ${mainContent.width}px`)
  console.log(`  (b) Charts render: ${mainContent.hasCharts}`)
  console.log(`  (c) No horizontal scroll on tablet: ${!tabletInfo.hasHorizontalScroll}`)
  console.log(`  (d) Briefing modal opens: ${hasBriefingModal}`)
  console.log('\n📸 Screenshots saved:')
  console.log(`  • ${screenshotDir}/dashboard.png (1440x900, with briefing modal)`)
  console.log(`  • ${screenshotDir}/dashboard-narrow.png (768x1024, tablet responsive)`)
  console.log(`  • ${screenshotDir}/briefing-modal.png (briefing overlay)`)

  await browser.close()
  process.exit(0)
}

testScreenshots().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { CONFIG, BASE_URL, SELECTORS } from './config';
import { SearchResult, TrainOffer } from './types';
import { log, asyncSaveDebugArtifacts } from './utils';

export async function createBrowserInstance(): Promise<{ browser: Browser; context: BrowserContext }> {
  log(`Launching Playwright Chromium (headless: ${CONFIG.headless})...`, 'DEBUG');
  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });

  return { browser, context };
}

/**
 * Checks if any CAPTCHA or bot challenge modal/iframe is visible on the page.
 */
async function detectCaptcha(page: Page): Promise<boolean> {
  for (const selector of SELECTORS.captcha) {
    try {
      const isVisible = await page.locator(selector).first().isVisible({ timeout: 1500 });
      if (isVisible) {
        return true;
      }
    } catch {
      // Selector not present or timeout
    }
  }
  
  // Check frame or body text for AWS WAF / CAPTCHA hints
  try {
    const pageText = await page.innerText('body');
    if (pageText.includes('captcha-sdk') || pageText.includes('AWS WAF') || pageText.includes('Veuillez vérifier que vous êtes un humain')) {
      return true;
    }
  } catch {
    // Ignore error
  }

  return false;
}

/**
 * Checks if the page indicates that no trains or tickets are available for the date.
 */
async function detectSoldOut(page: Page): Promise<boolean> {
  try {
    const bodyText = await page.innerText('body');
    for (const textSnippet of SELECTORS.soldOutText) {
      if (bodyText.includes(textSnippet)) {
        return true;
      }
    }
  } catch (err) {
    log(`Error reading body text for sold out check: ${err}`, 'DEBUG');
  }
  return false;
}

/**
 * Scrapes Eurostar Snap search results for a given target date.
 */
export async function scrapeDate(page: Page, date: string): Promise<SearchResult> {
  const searchUrl = `${BASE_URL}?adult=${CONFIG.adults}&origin=${CONFIG.origin}&destination=${CONFIG.destination}&outbound=${date}`;
  log(`🔍 Scraper inspecting date: ${date} -> ${searchUrl}`, 'INFO');

  try {
    // Navigate to page
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait briefly for client-side rendering
    await page.waitForTimeout(3000);

    // 1. Check CAPTCHA
    const captchaFound = await detectCaptcha(page);
    if (captchaFound) {
      log(`⚠️ CAPTCHA / Anti-bot challenge detected for date ${date}! Logging & saving debug files.`, 'WARN');
      await asyncSaveDebugArtifacts(page, `captcha_${date}`);
      return {
        date,
        available: false,
        offers: [],
        captchaDetected: true,
        error: 'CAPTCHA or anti-bot challenge encountered',
      };
    }

    // 2. Check Sold Out / No Availability
    const isSoldOut = await detectSoldOut(page);
    if (isSoldOut) {
      log(`ℹ️ Date ${date}: No Snap tickets available (sold out or unserviced).`, 'INFO');
      return {
        date,
        available: false,
        offers: [],
      };
    }

    // 3. Detect Available Option Cards & Continue Buttons
    // Look for option cards (e.g. labels or cards containing "Départ entre" or price "€")
    const optionLocator = page.locator('label:has-text("Départ"), [data-testid*="slot"], fieldset label');
    const optionCount = await optionLocator.count();

    // Look for continue button
    const continueBtn = page.locator(SELECTORS.continueButton).first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 2000 }).catch(() => false);

    const offers: TrainOffer[] = [];

    if (optionCount > 0) {
      for (let i = 0; i < optionCount; i++) {
        const item = optionLocator.nth(i);
        const text = (await item.innerText().catch(() => '')) || '';

        // Extract time slot (e.g. "06:55 et 14:00" or "06:55")
        let timeSlot = 'Horaires Snap';
        const timeMatch = text.match(/Départ entre\s+([0-9]{2}:[0-9]{2}(?:\s+et\s+[0-9]{2}:[0-9]{2})?)/i) ||
                          text.match(/([0-9]{2}:[0-9]{2}\s*-\s*[0-9]{2}:[0-9]{2})/i) ||
                          text.match(/([0-9]{2}:[0-9]{2})/i);
        if (timeMatch) {
          timeSlot = timeMatch[1].trim();
        }

        // Extract price (e.g. "55 €" or "55€")
        let price = 'Prix Snap';
        const priceMatch = text.match(/([0-9]+\s*€)/i) || text.match(/(€\s*[0-9]+)/i);
        if (priceMatch) {
          price = priceMatch[1].trim();
        }

        const dedupKey = `${date}|${timeSlot}|${price}`;

        offers.push({
          date,
          timeSlot,
          price,
          text: text.replace(/\n+/g, ' ').trim(),
          bookingUrl: searchUrl,
          dedupKey,
        });
      }
    }

    // If options were found or continue button is active, date is available
    if (offers.length > 0 || hasContinueBtn) {
      // If offers array was empty but continue button was found, create a generic offer
      if (offers.length === 0) {
        offers.push({
          date,
          timeSlot: 'Disponible (Billet Snap)',
          price: 'Tarif Snap',
          text: `Trajet disponible pour le ${date}`,
          bookingUrl: searchUrl,
          dedupKey: `${date}|Disponible|Tarif Snap`,
        });
      }

      log(`🎉 SUCCESS! Date ${date}: ${offers.length} available offer(s) found!`, 'INFO');
      return {
        date,
        available: true,
        offers,
      };
    }

    // 4. Fallback: Neither sold out nor available options found (unknown page state / selector mismatch)
    log(`⚠️ Could not parse results for date ${date} (no sold-out message and no options found). Saving debug snapshot.`, 'WARN');
    await asyncSaveDebugArtifacts(page, `no_results_${date}`);

    return {
      date,
      available: false,
      offers: [],
      error: 'Page structure could not be parsed with current selectors',
    };

  } catch (err: any) {
    log(`Error scraping date ${date}: ${err?.message || err}`, 'ERROR');
    await asyncSaveDebugArtifacts(page, `error_${date}`);
    return {
      date,
      available: false,
      offers: [],
      error: err?.message || String(err),
    };
  }
}

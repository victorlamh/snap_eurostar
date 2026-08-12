import { CONFIG } from './config';
import { createBrowserInstance, scrapeDate } from './scraper';
import { isAlertAlreadySent, recordAlertSent } from './db';
import { sendAlertEmail } from './email';
import { sendTelegramAlert } from './telegram';
import { log } from './utils';
import { TrainOffer } from './types';

export async function runSingleCheck(): Promise<{ newOffersCount: number; errorsCount: number }> {
  log('====================================================', 'INFO');
  log(`🚀 Starting Eurostar Snap Single Check Cycle (${CONFIG.dates.join(', ')})`, 'INFO');
  log('====================================================', 'INFO');

  let browser: any = null;
  let context: any = null;
  let page: any = null;

  const newOffersToSend: TrainOffer[] = [];
  let errorsCount = 0;

  try {
    const instance = await createBrowserInstance();
    browser = instance.browser;
    context = instance.context;
    page = await context.newPage();

    for (const date of CONFIG.dates) {
      const result = await scrapeDate(page, date);

      if (result.error || result.captchaDetected) {
        errorsCount++;
        continue;
      }

      if (result.available && result.offers.length > 0) {
        for (const offer of result.offers) {
          if (isAlertAlreadySent(offer.dedupKey)) {
            log(`ℹ️ Offer already alerted previously (dedupKey: ${offer.dedupKey}). Skipping email.`, 'INFO');
          } else {
            log(`✨ NEW OFFER DETECTED: [${offer.date}] ${offer.timeSlot} @ ${offer.price}`, 'INFO');
            newOffersToSend.push(offer);
          }
        }
      }
    }

    if (newOffersToSend.length > 0) {
      log(`Found ${newOffersToSend.length} new un-alerted offer(s). Sending email & Telegram alerts...`, 'INFO');
      const emailSent = await sendAlertEmail(newOffersToSend);
      
      let telegramSent = false;
      if (CONFIG.telegramEnabled && CONFIG.telegramBotToken && CONFIG.telegramChatId) {
        telegramSent = await sendTelegramAlert(newOffersToSend).catch(err => {
          log(`[Telegram] Error sending alert: ${err}`, 'ERROR');
          return false;
        });
      }

      const alerted = emailSent || telegramSent;

      for (const offer of newOffersToSend) {
        recordAlertSent(offer, alerted);
      }
      if (alerted) {
        log(`✅ Successfully alerted and recorded ${newOffersToSend.length} offer(s) (Email: ${emailSent ? 'OK' : 'Off/N/A'}, Telegram: ${telegramSent ? 'OK' : 'Off/N/A'}).`, 'INFO');
      } else {
        log(`⚠️ Recorded ${newOffersToSend.length} offer(s) in history. Neither Email nor Telegram alert could be delivered. Please configure email or Telegram in Web UI.`, 'WARN');
      }
    } else {
      log('ℹ️ Check completed. No new un-alerted availability found.', 'INFO');
    }

  } catch (err: any) {
    log(`Unhandled exception during check cycle: ${err?.message || err}`, 'ERROR');
    errorsCount++;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    log('Browser closed.', 'DEBUG');
  }

  return { newOffersCount: newOffersToSend.length, errorsCount };
}

// Execute directly if run via CLI `npm run check` or `npx tsx src/check.ts`
if (require.main === module) {
  runSingleCheck()
    .then(({ newOffersCount, errorsCount }) => {
      log(`Check finished. New offers: ${newOffersCount}, Errors: ${errorsCount}`, 'INFO');
      process.exit(0);
    })
    .catch((err) => {
      log(`Fatal error in check execution: ${err}`, 'ERROR');
      process.exit(1);
    });
}

import { CONFIG } from './config';
import { TrainOffer } from './types';
import { log } from './utils';

/**
 * Sends a raw text or HTML formatted message via Telegram Bot API.
 */
export async function sendTelegramMessage(messageText: string): Promise<boolean> {
  const token = CONFIG.telegramBotToken;
  const chatId = CONFIG.telegramChatId;

  if (!token || !chatId) {
    log('[Telegram] Bot Token or Chat ID not configured. Skipping Telegram notification.', 'DEBUG');
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    const data = await response.json() as any;

    if (response.ok && data.ok) {
      log('[Telegram] Message sent successfully!', 'INFO');
      return true;
    } else {
      log(`[Telegram] API error: ${data.description || JSON.stringify(data)}`, 'ERROR');
      return false;
    }
  } catch (err: any) {
    log(`[Telegram] Network error sending message: ${err?.message || err}`, 'ERROR');
    return false;
  }
}

/**
 * Formats and sends train availability alert to Telegram.
 */
export async function sendTelegramAlert(offers: TrainOffer[]): Promise<boolean> {
  if (offers.length === 0) return false;

  const originName = CONFIG.origin === '8727100' ? '🇫🇷 Paris Gare du Nord' : '🇬🇧 Londres St Pancras';
  const destName = CONFIG.destination === '8727100' ? '🇫🇷 Paris Gare du Nord' : '🇬🇧 Londres St Pancras';

  let text = `🚨 <b>ALERTE BILLETS EUROSTAR SNAP DETECTES !</b> 🚨\n\n`;
  text += `<b>Trajet :</b> ${originName} ➡️ ${destName}\n`;
  text += `<b>Nombre d'offres :</b> ${offers.length}\n\n`;
  text += `------------------------------------\n`;

  offers.forEach((offer, idx) => {
    text += `🎫 <b>Offre #${idx + 1}</b>\n`;
    text += `📅 <b>Date :</b> ${offer.date}\n`;
    text += `⏰ <b>Créneau :</b> ${offer.timeSlot}\n`;
    text += `💰 <b>Prix :</b> <code>${offer.price}</code>\n`;
    text += `🔗 <a href="${offer.bookingUrl}">Réserver immédiatement sur Eurostar Snap</a>\n\n`;
  });

  text += `⚡ <i>Dépêchez-vous, les places Eurostar Snap partent très vite !</i>`;

  return sendTelegramMessage(text);
}

/**
 * Sends a test message to verify Telegram bot setup.
 */
export async function sendTestTelegramMessage(): Promise<boolean> {
  const text = `🧪 <b>Test Bot Eurostar Snap Alert</b>\n\n✅ Si vous recevez ce message, la connexion Telegram est parfaitement configurée !`;
  return sendTelegramMessage(text);
}

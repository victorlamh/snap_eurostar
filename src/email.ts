import fs from 'fs';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { CONFIG } from './config';
import { TrainOffer } from './types';
import { log } from './utils';

function getResendClient(): Resend | null {
  if (!CONFIG.resendApiKey) {
    return null;
  }
  return new Resend(CONFIG.resendApiKey);
}

function getNodemailerTransport(): nodemailer.Transporter | null {
  if (CONFIG.smtpHost) {
    log(`[Email] Using SMTP transport (${CONFIG.smtpHost}:${CONFIG.smtpPort || 587})`, 'INFO');
    return nodemailer.createTransport({
      host: CONFIG.smtpHost,
      port: CONFIG.smtpPort || 587,
      secure: CONFIG.smtpSecure || false,
      auth: CONFIG.smtpUser ? {
        user: CONFIG.smtpUser,
        pass: CONFIG.smtpPass || ''
      } : undefined
    });
  }
  
  // Sendmail fallback for standard Linux/cPanel/VPS hostings
  if (process.platform !== 'win32' && fs.existsSync('/usr/sbin/sendmail')) {
    try {
      return nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail'
      });
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Builds HTML email body for train availability alerts.
 */
function buildHtmlBody(offers: TrainOffer[]): string {
  const originName = CONFIG.origin === '8727100' ? 'Paris Gare du Nord' : 'Londres St Pancras';
  const destName = CONFIG.destination === '8727100' ? 'Paris Gare du Nord' : 'Londres St Pancras';

  const offerRows = offers.map(offer => `
    <tr style="border-bottom: 1px solid #E3E3E3;">
      <td style="padding: 12px; font-weight: bold; color: #00286A;">${offer.date}</td>
      <td style="padding: 12px; color: #1C1C1A;">${offer.timeSlot}</td>
      <td style="padding: 12px; font-weight: bold; color: #086264; font-size: 16px;">${offer.price}</td>
      <td style="padding: 12px;">
        <a href="${offer.bookingUrl}" target="_blank" style="background-color: #0D57CC; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 4px; display: inline-block; font-size: 14px; font-weight: bold;">
          Réserver sur Snap &rarr;
        </a>
      </td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: #0054a6; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .footer { background-color: #F8F9FA; padding: 16px; text-align: center; font-size: 12px; color: #646463; border-top: 1px solid #E3E3E3; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚅 Eurostar Snap Alert</h1>
          <p>${offers.length} billet(s) disponible(s) détecté(s) !</p>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          <p>Des billets <strong>Eurostar Snap</strong> correspondent à vos critères (${originName} &rarr; ${destName}) :</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Horaire / Créneau</th>
                <th>Prix</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${offerRows}
            </tbody>
          </table>
        </div>
        <div class="footer">
          <p>Message envoyé automatiquement par <strong>eurostar-snap-alert</strong>.</p>
        </div>
      </div>
    </body>
  </html>
  `;
}

function buildTextBody(offers: TrainOffer[]): string {
  const originName = CONFIG.origin === '8727100' ? 'Paris' : 'Londres';
  const destName = CONFIG.destination === '8727100' ? 'Paris' : 'Londres';
  const details = offers.map(o => `- Date: ${o.date} | Créneau: ${o.timeSlot} | Prix: ${o.price}\n  Lien: ${o.bookingUrl}`).join('\n\n');
  return `🚅 Eurostar Snap Alert\n\nDes billets sont disponibles pour votre trajet ${originName} -> ${destName} !\n\n${details}`;
}

/**
 * Sends alert email via Resend or Nodemailer (SMTP / Sendmail).
 */
export async function sendAlertEmail(offers: TrainOffer[]): Promise<boolean> {
  if (!CONFIG.alertTo) {
    log('ALERT_TO email recipient is not defined. Skipping email sending.', 'WARN');
    return false;
  }

  const originName = CONFIG.origin === '8727100' ? 'Paris' : 'Londres';
  const destName = CONFIG.destination === '8727100' ? 'Paris' : 'Londres';
  const subject = `🚅 [Eurostar Snap] ${offers.length} billet(s) disponible(s) ! (${originName} -> ${destName} le ${offers.map(o => o.date).join(', ')})`;

  // Try Resend API first if configured
  const resend = getResendClient();
  if (resend) {
    try {
      log(`[Email] Sending alert email via Resend to ${CONFIG.alertTo}...`, 'INFO');
      const response = await resend.emails.send({
        from: CONFIG.alertFrom,
        to: CONFIG.alertTo,
        subject: subject,
        html: buildHtmlBody(offers),
        text: buildTextBody(offers),
      });

      if (!response.error) {
        log(`✅ Email alert successfully sent via Resend (ID: ${response.data?.id})`, 'INFO');
        return true;
      }
      log(`Resend API Error: ${response.error.message}. Trying SMTP fallback...`, 'WARN');
    } catch (err: any) {
      log(`Resend exception: ${err?.message || err}. Trying SMTP fallback...`, 'WARN');
    }
  }

  // Fallback to Nodemailer SMTP / Sendmail
  const transporter = getNodemailerTransport();
  if (transporter) {
    try {
      log(`[Email] Sending alert email via Nodemailer SMTP to ${CONFIG.alertTo}...`, 'INFO');
      await transporter.sendMail({
        from: CONFIG.alertFrom || 'Eurostar Snap Alert <alert@eurostar-snap.local>',
        to: CONFIG.alertTo,
        subject: subject,
        html: buildHtmlBody(offers),
        text: buildTextBody(offers)
      });
      log(`✅ Email alert successfully sent via Nodemailer SMTP to ${CONFIG.alertTo}`, 'INFO');
      return true;
    } catch (err: any) {
      log(`Nodemailer SMTP Error: ${err?.message || err}`, 'ERROR');
      return false;
    }
  }

  log('ℹ️ Email alert skipped (Neither Resend API key nor SMTP configured).', 'INFO');
  return false;
}

/**
 * Sends a test email to verify credentials and setup.
 */
export async function sendTestEmail(): Promise<boolean> {
  log('Running test email task...', 'INFO');
  const mockOffer: TrainOffer = {
    date: '2026-08-24',
    timeSlot: '06:55 et 14:00',
    price: '55 €',
    text: 'Départ entre 06:55 et 14:00 - 55 €',
    bookingUrl: `https://snap.eurostar.com/fr-fr/search?adult=1&origin=${CONFIG.origin}&destination=${CONFIG.destination}&outbound=2026-08-24`,
    dedupKey: 'TEST_ALERT_KEY'
  };

  return await sendAlertEmail([mockOffer]);
}

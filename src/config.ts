import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { AppConfig } from './types';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const CONFIG: AppConfig = {
  resendApiKey: process.env.RESEND_API_KEY || '',
  alertFrom: process.env.ALERT_FROM || 'Eurostar Snap Alert <alert@eurostarsnap.local>',
  alertTo: process.env.ALERT_TO || '',
  checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL_SECONDS || '75', 10),
  headless: process.env.HEADLESS !== 'false', // Default to true
  debug: process.env.DEBUG === 'true',
  origin: process.env.ORIGIN || '7015400',       // Default: Londres St Pancras International
  destination: process.env.DESTINATION || '8727100',  // Default: Paris Gare du Nord
  dates: process.env.DATES ? process.env.DATES.split(',').map(d => d.trim()).filter(Boolean) : ['2026-08-24', '2026-08-25'],
  adults: 1,
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  telegramEnabled: process.env.TELEGRAM_ENABLED !== 'false'
};

export function updateAppConfig(newSettings: {
  dates?: string[];
  alertTo?: string;
  checkIntervalSeconds?: number;
  resendApiKey?: string;
  origin?: string;
  destination?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramEnabled?: boolean;
}): void {
  if (newSettings.dates) {
    CONFIG.dates = newSettings.dates.map(d => d.trim()).filter(Boolean);
  }
  if (newSettings.alertTo !== undefined) {
    CONFIG.alertTo = newSettings.alertTo.trim();
  }
  if (newSettings.checkIntervalSeconds !== undefined && newSettings.checkIntervalSeconds > 0) {
    CONFIG.checkIntervalSeconds = newSettings.checkIntervalSeconds;
  }
  if (newSettings.resendApiKey !== undefined) {
    CONFIG.resendApiKey = newSettings.resendApiKey.trim();
  }
  if (newSettings.origin) {
    CONFIG.origin = newSettings.origin;
  }
  if (newSettings.destination) {
    CONFIG.destination = newSettings.destination;
  }
  if (newSettings.smtpHost !== undefined) CONFIG.smtpHost = newSettings.smtpHost.trim();
  if (newSettings.smtpPort !== undefined) CONFIG.smtpPort = newSettings.smtpPort;
  if (newSettings.smtpUser !== undefined) CONFIG.smtpUser = newSettings.smtpUser.trim();
  if (newSettings.smtpPass !== undefined) CONFIG.smtpPass = newSettings.smtpPass.trim();
  if (newSettings.smtpSecure !== undefined) CONFIG.smtpSecure = newSettings.smtpSecure;
  if (newSettings.telegramBotToken !== undefined) CONFIG.telegramBotToken = newSettings.telegramBotToken.trim();
  if (newSettings.telegramChatId !== undefined) CONFIG.telegramChatId = newSettings.telegramChatId.trim();
  if (newSettings.telegramEnabled !== undefined) CONFIG.telegramEnabled = newSettings.telegramEnabled;

  // Persist to .env file
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    
    const setOrReplace = (key: string, val: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
    };

    if (newSettings.dates !== undefined) setOrReplace('DATES', CONFIG.dates.join(','));
    if (newSettings.alertTo !== undefined) setOrReplace('ALERT_TO', CONFIG.alertTo || '');
    if (newSettings.resendApiKey !== undefined) setOrReplace('RESEND_API_KEY', CONFIG.resendApiKey || '');
    if (newSettings.checkIntervalSeconds !== undefined) setOrReplace('CHECK_INTERVAL_SECONDS', CONFIG.checkIntervalSeconds.toString());
    if (newSettings.origin !== undefined) setOrReplace('ORIGIN', CONFIG.origin || '');
    if (newSettings.destination !== undefined) setOrReplace('DESTINATION', CONFIG.destination || '');
    if (newSettings.smtpHost !== undefined) setOrReplace('SMTP_HOST', CONFIG.smtpHost || '');
    if (newSettings.smtpPort !== undefined) setOrReplace('SMTP_PORT', CONFIG.smtpPort ? CONFIG.smtpPort.toString() : '');
    if (newSettings.smtpUser !== undefined) setOrReplace('SMTP_USER', CONFIG.smtpUser || '');
    if (newSettings.smtpPass !== undefined) setOrReplace('SMTP_PASS', CONFIG.smtpPass || '');
    if (newSettings.telegramBotToken !== undefined) setOrReplace('TELEGRAM_BOT_TOKEN', CONFIG.telegramBotToken || '');
    if (newSettings.telegramChatId !== undefined) setOrReplace('TELEGRAM_CHAT_ID', CONFIG.telegramChatId || '');
    if (newSettings.telegramEnabled !== undefined) setOrReplace('TELEGRAM_ENABLED', CONFIG.telegramEnabled ? 'true' : 'false');

    
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
  } catch (err) {
    console.error('Failed to update .env file:', err);
  }
}

export const BASE_URL = 'https://snap.eurostar.com/fr-fr/search';

export const SELECTORS = {
  // Captcha / Bot protection detection
  captcha: [
    '[data-testid="captcha-dialog"]',
    '#captcha-container',
    'dialog[aria-label*="captcha" i]',
    'iframe[src*="captcha"]',
    'iframe[src*="awswaf"]'
  ],

  // Sold out / No tickets messages
  soldOutText: [
    "Désolés, aucun billet Snap n'est disponible",
    "Soit nos trains sont complets",
    "aucun billet Snap",
    "pas de trains disponibles"
  ],

  // Option cards and availability containers
  optionCard: 'label:has-text("Départ"), [data-testid*="slot"], [data-testid*="journey-option"]',
  radioInput: 'input[type="radio"]',
  continueButton: 'button:has-text("Continuer"), button[type="submit"], a:has-text("Continuer")',
  
  // Specific fallback element checks
  resultsSection: 'main section, main [role="main"]',
};

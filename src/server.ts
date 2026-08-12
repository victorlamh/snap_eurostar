import express, { Request, Response } from 'express';
import path from 'path';
import { CONFIG, updateAppConfig } from './config';
import { runSingleCheck } from './check';
import { sendTestEmail } from './email';
import { sendTestTelegramMessage } from './telegram';
import { getRecentLogs, getRandomDelayMs, log } from './utils';
import { getAlertHistory } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Enable CORS for frontend flexibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static(path.resolve(process.cwd(), 'public')));

// Auto-scanner state
let isAutoScanning = false;
let isCheckInProgress = false;
let lastCheckTime: string | null = null;
let nextCheckTime: string | null = null;
let totalChecksCount = 0;
let newOffersFoundCount = 0;
let loopTimeoutId: NodeJS.Timeout | null = null;

async function executeScanCycle(): Promise<void> {
  if (isCheckInProgress) return;
  isCheckInProgress = true;
  lastCheckTime = new Date().toISOString();
  totalChecksCount++;

  log(`[Server] Executing scan cycle #${totalChecksCount}...`, 'INFO');

  try {
    const { newOffersCount } = await runSingleCheck();
    newOffersFoundCount += newOffersCount;
  } catch (err: any) {
    log(`[Server] Error during scan cycle: ${err?.message || err}`, 'ERROR');
  } finally {
    isCheckInProgress = false;
  }
}

function scheduleNextAutoScan(): void {
  if (!isAutoScanning) {
    nextCheckTime = null;
    return;
  }

  const delayMs = getRandomDelayMs(CONFIG.checkIntervalSeconds);
  const nextDate = new Date(Date.now() + delayMs);
  nextCheckTime = nextDate.toISOString();

  log(`[Server] Next auto-scan scheduled in ${Math.round(delayMs / 1000)}s (at ${nextDate.toLocaleTimeString('fr-FR')})`, 'INFO');

  loopTimeoutId = setTimeout(async () => {
    if (!isAutoScanning) return;
    await executeScanCycle();
    if (isAutoScanning) {
      scheduleNextAutoScan();
    }
  }, delayMs);
}

function startAutoScanner(): void {
  if (isAutoScanning) return;
  isAutoScanning = true;
  log('[Server] Auto-scanner started by user request.', 'INFO');
  
  // Trigger initial scan right away, then schedule subsequent scans
  executeScanCycle().then(() => {
    if (isAutoScanning) {
      scheduleNextAutoScan();
    }
  });
}

function stopAutoScanner(): void {
  isAutoScanning = false;
  nextCheckTime = null;
  if (loopTimeoutId) {
    clearTimeout(loopTimeoutId);
    loopTimeoutId = null;
  }
  log('[Server] Auto-scanner stopped by user request.', 'INFO');
}

// API Router - Handles both /api/* and /* (in case proxy strips /api prefix)
const apiRouter = express.Router();

apiRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    isAutoScanning,
    isCheckInProgress,
    lastCheckTime,
    nextCheckTime,
    totalChecksCount,
    newOffersFoundCount,
    config: {
      dates: CONFIG.dates,
      alertTo: CONFIG.alertTo,
      checkIntervalSeconds: CONFIG.checkIntervalSeconds,
      resendApiKeySet: !!CONFIG.resendApiKey,
      origin: CONFIG.origin,
      destination: CONFIG.destination,
      smtpHost: CONFIG.smtpHost,
      smtpPort: CONFIG.smtpPort,
      smtpUser: CONFIG.smtpUser,
      smtpPassSet: !!CONFIG.smtpPass,
      telegramBotToken: CONFIG.telegramBotToken,
      telegramChatId: CONFIG.telegramChatId,
      telegramEnabled: CONFIG.telegramEnabled
    }
  });
});

apiRouter.post('/config', (req: Request, res: Response) => {
  const {
    dates,
    alertTo,
    checkIntervalSeconds,
    resendApiKey,
    origin,
    destination,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    telegramBotToken,
    telegramChatId,
    telegramEnabled
  } = req.body;

  let parsedDates: string[] | undefined;
  if (typeof dates === 'string') {
    parsedDates = dates.split(',').map(d => d.trim()).filter(Boolean);
  } else if (Array.isArray(dates)) {
    parsedDates = dates;
  }

  updateAppConfig({
    dates: parsedDates,
    alertTo: typeof alertTo === 'string' ? alertTo : undefined,
    checkIntervalSeconds: typeof checkIntervalSeconds === 'number' ? checkIntervalSeconds : undefined,
    resendApiKey: typeof resendApiKey === 'string' ? resendApiKey : undefined,
    origin: typeof origin === 'string' ? origin : undefined,
    destination: typeof destination === 'string' ? destination : undefined,
    smtpHost: typeof smtpHost === 'string' ? smtpHost : undefined,
    smtpPort: typeof smtpPort === 'number' ? smtpPort : (typeof smtpPort === 'string' ? parseInt(smtpPort, 10) : undefined),
    smtpUser: typeof smtpUser === 'string' ? smtpUser : undefined,
    smtpPass: typeof smtpPass === 'string' ? smtpPass : undefined,
    telegramBotToken: typeof telegramBotToken === 'string' ? telegramBotToken : undefined,
    telegramChatId: typeof telegramChatId === 'string' ? telegramChatId : undefined,
    telegramEnabled: typeof telegramEnabled === 'boolean' ? telegramEnabled : undefined
  });


  log(`[Server] Configuration updated via Web UI. Route: ${CONFIG.origin} -> ${CONFIG.destination}`, 'INFO');
  res.json({ success: true, config: CONFIG });
});

apiRouter.post('/scan', async (req: Request, res: Response) => {
  if (isCheckInProgress) {
    return res.status(409).json({ success: false, message: 'Un scan est déjà en cours d\'exécution.' });
  }

  log('[Server] Manual instant scan triggered from Web UI.', 'INFO');
  
  // Run scan asynchronously
  executeScanCycle().catch(err => {
    log(`[Server] Manual scan error: ${err}`, 'ERROR');
  });

  res.json({ success: true, message: 'Scan lancé en arrière-plan.' });
});

apiRouter.post('/start', (req: Request, res: Response) => {
  startAutoScanner();
  res.json({ success: true, isAutoScanning: true });
});

apiRouter.post('/stop', (req: Request, res: Response) => {
  stopAutoScanner();
  res.json({ success: true, isAutoScanning: false });
});

apiRouter.post('/test-email', async (req: Request, res: Response) => {
  log('[Server] Test email requested from Web UI.', 'INFO');
  try {
    const success = await sendTestEmail();
    if (success) {
      res.json({ success: true, message: 'Email de test envoyé avec succès !' });
    } else {
      res.status(500).json({ success: false, message: 'Échec de l\'envoi. Vérifiez votre clé RESEND_API_KEY et l\'adresse e-mail destinataire.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Erreur lors de l\'envoi.' });
  }
});

apiRouter.post('/test-telegram', async (req: Request, res: Response) => {
  log('[Server] Test Telegram requested from Web UI.', 'INFO');
  try {
    const success = await sendTestTelegramMessage();
    if (success) {
      res.json({ success: true, message: 'Message Telegram de test envoyé avec succès !' });
    } else {
      res.status(500).json({ success: false, message: 'Échec de l\'envoi Telegram. Vérifiez le Bot Token et le Chat ID.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Erreur lors de l\'envoi Telegram.' });
  }
});


apiRouter.get('/history', (req: Request, res: Response) => {
  try {
    const history = getAlertHistory(50);
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, history: [], message: err?.message });
  }
});

apiRouter.get('/logs', (req: Request, res: Response) => {
  res.json({ success: true, logs: getRecentLogs() });
});

// Mount router under both /api and / so whether proxy strips /api or not, routes respond
app.use('/api', apiRouter);
app.use(apiRouter);

// Fallback to index.html for SPA (only GET requests that aren't API endpoints)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
});

process.on('uncaughtException', (err) => {
  log(`[Server] Uncaught Exception: ${err?.stack || err?.message || err}`, 'ERROR');
});

process.on('unhandledRejection', (reason) => {
  log(`[Server] Unhandled Rejection: ${reason}`, 'ERROR');
});

const HOST = process.env.HOST || '0.0.0.0';

app.listen(Number(PORT), HOST, () => {
  log(`====================================================`, 'INFO');
  log(`  🚀 Eurostar Snap Web Dashboard initialisé sur:`, 'INFO');
  log(`  👉 http://${HOST}:${PORT}`, 'INFO');
  log(`====================================================`, 'INFO');
});

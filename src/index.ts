import { CONFIG } from './config';
import { runSingleCheck } from './check';
import { getRandomDelayMs, log } from './utils';

let isRunning = true;

function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    log(`Received ${signal}. Shutting down continuous monitoring daemon...`, 'INFO');
    isRunning = false;
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function startContinuousMonitoring(): Promise<void> {
  setupGracefulShutdown();
  log('====================================================', 'INFO');
  log('  Eurostar Snap Continuous Alert Daemon Initialized', 'INFO');
  log(`  Target Dates: ${CONFIG.dates.join(', ')}`, 'INFO');
  log(`  Base Interval: ${CONFIG.checkIntervalSeconds}s (Randomized 60s - 90s)`, 'INFO');
  log(`  Resend Alert To: ${CONFIG.alertTo || '(Not set in .env)'}`, 'INFO');
  log('====================================================', 'INFO');

  let cycleNumber = 1;

  while (isRunning) {
    log(`\n--- [Cycle #${cycleNumber}] ${new Date().toLocaleString('fr-FR')} ---`, 'INFO');
    
    try {
      await runSingleCheck();
    } catch (err: any) {
      log(`Error in monitoring cycle #${cycleNumber}: ${err?.message || err}`, 'ERROR');
    }

    if (!isRunning) break;

    const delayMs = getRandomDelayMs(CONFIG.checkIntervalSeconds);
    const delaySec = Math.round(delayMs / 1000);
    log(`⏳ Cycle #${cycleNumber} complete. Waiting ${delaySec} seconds before next check...`, 'INFO');
    
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    cycleNumber++;
  }
}

if (require.main === module) {
  startContinuousMonitoring().catch((err) => {
    log(`Fatal daemon error: ${err}`, 'ERROR');
    process.exit(1);
  });
}

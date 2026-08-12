import fs from 'fs';
import path from 'path';
import { Page } from 'playwright';

const DEBUG_DIR = path.resolve(process.cwd(), 'debug');
const DATA_DIR = path.resolve(process.cwd(), 'data');

export function ensureDirectories(): void {
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

const logBuffer: LogEntry[] = [];
const MAX_LOGS = 100;

export function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO'): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
  
  logBuffer.push({ timestamp, level, message });
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

export function getRecentLogs(): LogEntry[] {
  return [...logBuffer];
}

/**
 * Returns a randomized delay in milliseconds.
 * If baseSeconds is provided, adds a random variance between 60s and 90s,
 * or introduces a ±15s variation around baseSeconds.
 */
export function getRandomDelayMs(baseSeconds: number = 75): number {
  // Ensure minimum interval is between 60 and 90 seconds
  const minSec = 60;
  const maxSec = 90;
  const target = Math.max(minSec, Math.min(maxSec, baseSeconds));
  const randomVariation = (Math.random() * 30) - 15; // -15 to +15 seconds
  const finalSeconds = Math.max(60, Math.min(90, target + randomVariation));
  return Math.floor(finalSeconds * 1000);
}

/**
 * Saves HTML dump and PNG screenshot into debug/ for inspection when errors or missing selectors occur.
 */
export function asyncSaveDebugArtifacts(page: Page, label: string): Promise<{ screenshotPath: string; htmlPath: string }> {
  ensureDirectories();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  const screenshotPath = path.join(DEBUG_DIR, `debug_${sanitizedLabel}_${timestamp}.png`);
  const htmlPath = path.join(DEBUG_DIR, `debug_${sanitizedLabel}_${timestamp}.html`);

  return (async () => {
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(htmlPath, html, 'utf-8');
      log(`📸 Saved debug artifacts: ${screenshotPath} & ${htmlPath}`, 'DEBUG');
    } catch (err: any) {
      log(`Failed to save debug artifacts: ${err?.message || err}`, 'WARN');
    }
    return { screenshotPath, htmlPath };
  })();
}

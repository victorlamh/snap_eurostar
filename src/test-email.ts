import { sendTestEmail } from './email';
import { log } from './utils';

async function main() {
  log('📧 Sending Resend Test Notification Email...', 'INFO');
  const success = await sendTestEmail();

  if (success) {
    log('✅ Test email sent successfully! Check your inbox.', 'INFO');
    process.exit(0);
  } else {
    log('❌ Failed to send test email. Please verify your .env settings (RESEND_API_KEY, ALERT_FROM, ALERT_TO).', 'ERROR');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`Error during test email execution: ${err}`, 'ERROR');
  process.exit(1);
});

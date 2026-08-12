export interface TrainOffer {
  date: string;          // e.g. "2026-08-24"
  timeSlot: string;      // e.g. "06:55 et 14:00" or "06:55"
  price: string;         // e.g. "55 €"
  text: string;          // e.g. "Départ entre 06:55 et 14:00 - 55 €"
  bookingUrl: string;    // Full URL to Snap search/booking
  dedupKey: string;      // Unique key: "date|timeSlot|price"
}

export interface SearchResult {
  date: string;
  available: boolean;
  offers: TrainOffer[];
  error?: string;
  captchaDetected?: boolean;
}

export interface AppConfig {
  resendApiKey: string;
  alertFrom: string;
  alertTo: string;
  checkIntervalSeconds: number;
  headless: boolean;
  debug: boolean;
  origin: string;        // Station code, e.g. "7015400" (London St Pancras)
  destination: string;   // Station code, e.g. "8727100" (Paris Nord)
  dates: string[];       // Target dates, e.g. ["2026-08-24", "2026-08-25"]
  adults: number;        // Number of adult passengers (default 1)
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramEnabled?: boolean;
}


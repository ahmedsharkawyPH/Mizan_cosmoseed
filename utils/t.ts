
import { db } from '../services/db';

const translations: Record<string, Record<string, string>> = {
  en: {
    'set.paper_thermal_58': '58 mm wide roll',
    'set.paper_size': 'Paper Size',
    'set.paper_a4': 'A4 (Standard)',
    'set.paper_a5': 'A5 (Half)',
    'set.paper_thermal': '80mm Thermal',
    // ... rest of translations
  },
  ar: {
    'set.paper_thermal_58': 'رول حراري 58 مم',
    'set.paper_size': 'حجم الورق',
    'set.paper_a4': 'A4 (قياسي)',
    'set.paper_a5': 'A5 (نصفي)',
    'set.paper_thermal': '80 مم (حراري)',
    // ... rest of translations
  }
};

export const t = (key: string): string => {
  const settings = db.getSettings();
  const lang = settings.language || 'en';
  // @ts-ignore
  return translations[lang]?.[key] || key;
};

export const isRTL = (): boolean => {
  const settings = db.getSettings();
  return settings.language === 'ar';
};

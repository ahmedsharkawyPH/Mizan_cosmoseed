
import { db } from '../services/db';

const translations: Record<string, Record<string, string>> = {
  en: {
    // ... existing translations
    'set.paper_thermal_58': '58mm (2*2 inch)',
    'set.paper_size': 'Paper Size',
    'set.paper_a4': 'A4 (Standard)',
    'set.paper_a5': 'A5 (Half)',
    'set.paper_thermal': '80mm Thermal',
    // ... rest of translations
  },
  ar: {
    // ... existing translations
    'set.paper_thermal_58': '58 مم (2*2 بوصة)',
    'set.paper_size': 'حجم الورق',
    'set.paper_a4': 'A4 (قياسي)',
    'set.paper_a5': 'A5 (نصفي)',
    'set.paper_thermal': '80 مم (حراري)',
    // ... rest of translations
  }
};

// ... keep existing file structure and export
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

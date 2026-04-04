import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const en = {
  translation: {
    nav: {
      home: "Home",
      scan: "Scan",
      history: "History",
      safety: "Safety",
      settings: "Settings",
      remind: "Remind"
    },
    dashboard: {
      title: "Dawa Lens",
      subtitle: "Your smart medicine companion",
      todays_progress: "Today's Progress",
      doses: "doses",
      quick_scan: "Scan Pill",
      quick_add: "Add Reminder",
      quick_history: "View History",
      quick_search: "Search Medicine",
      upcoming_reminders: "Upcoming Reminders",
      no_reminders: "No reminders yet. Add one to get started!",
      disclaimer: "Disclaimer: Medicine information provided is for reference only. Always confirm with your pharmacist or doctor before making any medical decisions."
    },
    scan: {
      pill: "Pill",
      label: "Label OCR",
      barcode: "Barcode",
      camera_loading: "Camera loading...",
      point_barcode: "Point at barcode",
      capture_hint: "Position the pill inside the frame and tap to capture"
    },
    settings: {
      title: "Settings",
      language_preferences: "Language Preferences",
      language_select: "App Language",
      english: "English",
      swahili: "Kiswahili"
    }
  }
};

const sw = {
  translation: {
    nav: {
      home: "Nyumbani",
      scan: "Changanua",
      history: "Historia",
      safety: "Usalama",
      settings: "Mipangilio",
      remind: "Kumbusha"
    },
    dashboard: {
      title: "Dawa Lens",
      subtitle: "Msaidizi wako wa akili wa dawa",
      todays_progress: "Maendeleo ya Leo",
      doses: "dozi",
      quick_scan: "Changanua Kidonge",
      quick_add: "Weka Kikumbusho",
      quick_history: "Tazama Historia",
      quick_search: "Tafuta Dawa",
      upcoming_reminders: "Vikumbusho Vijavyo",
      no_reminders: "Hakuna vikumbusho bado. Ongeza kimoja ili kuanza!",
      disclaimer: "Kanusho: Taarifa za dawa zinazotolewa ni kwa kumbukumbu tu. Kila mara thibitisha na daktari wako kabla ya kufanya maamuzi yoyote ya matibabu."
    },
    scan: {
      pill: "Kidonge",
      label: "Maandishi (OCR)",
      barcode: "Msimbopau",
      camera_loading: "Kamera inafunguka...",
      point_barcode: "Elekeza kwenye msimbopau",
      capture_hint: "Weka kidonge ndani ya fremu kisha gusa ili kupiga picha"
    },
    settings: {
      title: "Mipangilio",
      language_preferences: "Lugha",
      language_select: "Lugha ya Programu",
      english: "Kiingereza",
      swahili: "Kiswahili"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en,
      sw
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

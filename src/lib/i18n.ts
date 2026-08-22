import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const en = {
  translation: {
    common: {
      back: "Back",
      save: "Save",
      search: "Search",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      cancel: "Cancel",
      delete: "Delete"
    },
    nav: {
      home: "Home",
      scan: "Scan",
      history: "History",
      safety: "Safety",
      settings: "Settings",
      remind: "Reminders",
      medvault: "Med Vault",
      medications: "Medications"
    },
    dashboard: {
      title: "Dawa Lens",
      subtitle: "Your smart medicine companion",
      good_morning: "Good morning",
      good_afternoon: "Good afternoon",
      good_evening: "Good evening",
      greeting_there: "there",
      todays_progress: "Today's Progress",
      doses: "doses",
      quick_scan: "Scan Text",
      quick_add: "Add Reminder",
      quick_history: "View History",
      quick_search: "Search Medicine",
      upcoming_reminders: "Upcoming Reminders",
      no_reminders: "No reminders yet. Add one to get started!",
      disclaimer: "Disclaimer: Medicine information provided is for reference only. Always confirm with your pharmacist or doctor before making any medical decisions."
    },
    medicine_info: {
      title: "Medicine Info",
      search_placeholder: "Search medicine name...",
      enter_name: "Enter a medicine name to look up information",
      failed_load: "Failed to load information.",
      severe_warning: "Severe Interaction Warning!",
      generic: "Generic",
      source: "Source",
      uses: "Uses",
      dosage: "Dosage",
      warnings: "Warnings",
      side_effects: "Side Effects",
      not_available: "Not available"
    },
    scan: {
      pill: "Pill",
      text: "Scan Text",
      label: "Label OCR",
      barcode: "Barcode",
      camera_loading: "Camera loading...",
      point_barcode: "Point at barcode",
      capture_hint: "Position the label inside the frame and tap to capture",
      ai_loading: "AI identifying your medicine...",
      high_confidence: "High Confidence Matches",
      low_confidence: "Needs Verification",
      verify: "Verify",
      align_scratch_code: "Align Scratch Code within Frame"
    },
    history: {
      title: "Medication Log",
      export: "Export",
      import: "Import",
      quick_log: "Quick Log",
      no_history: "No dose history yet. Start logging!",
      dose_logged: "Dose logged",
      marked_as: "marked as",
      taken: "taken",
      skipped: "skipped",
      snoozed: "snoozed",
      exported: "Exported!",
      exported_desc: "History downloaded as CSV",
      imported: "Imported!",
      imported_desc: "records imported"
    },
    safety: {
      title: "My Interactions",
      subtitle: "A dynamic check of how your saved medications might interact with each other.",
      disclaimer_title: "Medical Disclaimer",
      disclaimer_body: "The information provided here is for educational purposes only. Sourced from the NIH NLM API. Do not alter your medications without consulting a physician.",
      no_medicines: "Add at least two medications to your profile to check for interactions.",
      no_interactions: "No major interactions found between your saved medications.",
      detected: "Detected Interactions",
      severe: "Severe",
      warning: "Warning"
    },
    reminders: {
      add_title: "Add Reminder",
      med_name: "Medicine Name",
      med_name_placeholder: "e.g. Ibuprofen 200mg",
      dose: "Dose Amount",
      dose_placeholder: "e.g. 1 tablet, 5ml",
      time: "Time",
      repeat: "Repeat Schedule",
      notes: "Notes (optional)",
      notes_placeholder: "Take with food, etc.",
      save_reminder: "Save Reminder",
      once: "Once",
      daily: "Daily",
      custom: "Frequency",
      missing_fields: "Missing fields",
      missing_fields_desc: "Please fill in medicine name and dose.",
      created: "Reminder created!"
    },
    settings: {
      title: "Settings",
      appearance: "Theme & Appearance",
      dark_mode: "Dark Mode",
      theme_desc: "Choose your preferred theme",
      account: "Account",
      signed_in: "Signed in",
      logout: "Log Out",
      login_btn: "Sign In / Sign Up",
      privacy: "Privacy",
      storage_privacy: "Storage & Privacy",
      local_only: "Local-Only Mode",
      local_desc: "Data stays on this device only. Highest privacy, no backup.",
      cloud_sync: "Cloud Sync (Encrypted)",
      cloud_desc: "Secure backup and sync across devices. Required for caregivers.",
      local_mode: "Local-Only Mode",
      local_mode_desc: "Data stays on this device only",
      encrypted: "Encrypted Storage",
      encrypted_desc: "Medication data is encrypted at rest",
      active: "Active",
      sync_start: "Syncing Data",
      sync_desc: "Merging local medications with your cloud profile...",
      sync_complete: "Sync Complete",
      professional_hub: "Professional Hub",
      manage_patients: "Manage Patients Hub",
      chw_label: "Community Health Worker (CHW)",
      chw_desc: "Unlock professional tools to manage medications, track adherence, and monitor refills for multiple clients or family members.",
      years_old: "{{age}} years old",
      notifications: "Notifications",
      push_notifs: "Push Notifications",
      push_desc: "Receive reminders when app is closed",
      enable: "Enable",
      danger_zone: "Danger Zone",
      clear_data: "Clear All Data",
      confirm_delete: "Delete all medication data? This cannot be undone.",
      data_cleared: "All data cleared"
    },
    Intelligence: {
      snapshot: "Health Snapshot",
      adherence: "Medication Adherence",
      doses_taken: "doses taken today",
      watchdog: "Interaction Watchdog",
      no_interactions: "No interactions detected.",
      active_context: "Active Context",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en
    },
    fallbackLng: 'en',
    lng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Language, type TranslationShape } from "@/lib/i18n/translations";

const STORAGE_KEY = "myanflix-admin-language";
// Admins already reading this app in English shouldn't have the UI silently
// switch on them — default stays English, Burmese is an opt-in via the
// switcher (unlike userwebsite, which defaults to "mm" for its consumer
// audience).
const DEFAULT_LANGUAGE: Language = "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Nested translation tree for the active language — e.g. `t.nav.dashboard`, fully typed. */
  t: TranslationShape;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Starts at the real default on both server and client, then syncs to
  // whatever was previously chosen once mounted — avoids a hydration
  // mismatch from reading localStorage during the initial render.
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "mm") setLanguageState(stored);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

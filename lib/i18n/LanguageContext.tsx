"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("id"); // Default to Indonesian

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("cove_ui_language") as Language;
      if (savedLang === "id" || savedLang === "en") {
        setLanguageState(savedLang);
      }
    } catch {
      // Ignore in SSR / private mode
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("cove_ui_language", lang);
    } catch {
      // Ignore
    }
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language] as Record<string, string>;
    if (dict && dict[key]) {
      return dict[key];
    }
    // Fallback to English dictionary if key missing in Indonesian
    const enDict = translations.en as Record<string, string>;
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

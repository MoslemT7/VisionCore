import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// EN
import enCommon from "./locales/en/common.json";
import enTopbar from "./locales/en/topbar.json";
import enSidebar from "./locales/en/sidebar.json";
import enDashboard from "./locales/en/dashboard.json";
import enSummary from "./locales/en/summary.json";
import enUpload from "./locales/en/upload.json";

// FR
import frCommon from "./locales/fr/common.json";
import frTopbar from "./locales/fr/topbar.json";
import frSidebar from "./locales/fr/sidebar.json";
import frSummary from "./locales/fr/summary.json";
import frDashboard from "./locales/fr/dashboard.json";
import frUpload from "./locales/fr/upload.json";
import SummaryTab from "./pages/analyser/SummaryTab";


i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        topbar: enTopbar,
        sidebar: enSidebar,
        dashboard: enDashboard,
        upload: enUpload,
        summary: enSummary,
      },
      fr: {
        common: frCommon,
        topbar: frTopbar,
        sidebar: frSidebar,
        dashboard: frDashboard,
        summary: frSummary,
        upload: frUpload,
      },
    },

    fallbackLng: "en",

    ns: ["common", "topbar", "dashboard", "sidebar", "upload", "summary"],
    defaultNS: "common",

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
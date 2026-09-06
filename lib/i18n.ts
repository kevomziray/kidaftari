import type { Locale } from "@prisma/client";

const messages = {
  en: {
    dashboard: "Dashboard",
    customers: "Customers",
    more: "More",
    addCustomer: "Add customer",
    recordCredit: "Record credit",
    recordPayment: "Record payment",
    sendReminder: "Send reminder",
    customersOweYou: "Customers owe you",
  },
  sw: {
    dashboard: "Dashibodi",
    customers: "Wateja",
    more: "Zaidi",
    addCustomer: "Ongeza mteja",
    recordCredit: "Rekodi mkopo",
    recordPayment: "Rekodi malipo",
    sendReminder: "Tuma ukumbusho",
    customersOweYou: "Wateja wanakudaiwa",
  },
} as const;

export type TranslationKey = keyof (typeof messages)["en"];

export function t(locale: Locale | "EN" | "SW", key: TranslationKey) {
  return messages[locale === "SW" ? "sw" : "en"][key];
}

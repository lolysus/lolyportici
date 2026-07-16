import "server-only";

import type it from "../../messages/it.json";
import type { SupportedLocale } from "@/config/brand";

const dictionaries = {
  it: () => import("../../messages/it.json").then((module) => module.default),
  en: () => import("../../messages/en.json").then((module) => module.default),
  es: () => import("../../messages/es.json").then((module) => module.default),
};

export type Dictionary = typeof it;
export function hasLocale(locale: string): locale is SupportedLocale { return locale in dictionaries; }
export function getDictionary(locale: SupportedLocale) { return dictionaries[locale](); }

"use server";

import { getDictionary as getDict } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/locales";

export type { Locale };

export interface Nav {
  home: string;
  platforms: string;
  contents: string;
  changes: string;
  seeAll: string;
  compare: string;
}

export interface Country {
  label: string;
  pricesFor: string;
  changesFor: string;
  noPrice: string;
  notAvailable: string;
  notCollected: string;
  stale: string;
  taxIncluded: string;
  taxNotIncluded: string;
}

export interface Platforms {
  title: string;
  plans: string;
  planSingular: string;
  price: string;
  priceRange: string;
  contentCount: string;
  contentSingular: string;
  noPlatforms: string;
}

export interface Platform {
  plans: string;
  catalog: string;
  changes: string;
  contentCount: string;
  priceHistory: string;
  bestPrice: string;
  signInToSubscribe: string;
  subscribe: string;
}

export interface Contents {
  title: string;
  searchPlaceholder: string;
  filterType: string;
  all: string;
  movies: string;
  series: string;
  noResults: string;
  availableOn: string;
}

export interface Content {
  type_movie: string;
  type_series: string;
  year: string;
  genre: string;
  rating: string;
  availability: string;
  changes: string;
}

export interface Changes {
  title: string;
  noChanges: string;
  types: {
    PRICE_CHANGE: string;
    CONTENT_ADDED: string;
    CONTENT_REMOVED: string;
    NEW_PLATFORM: string;
    PLAN_CHANGE: string;
  };
  all: string;
}

export interface Compare {
  title: string;
  pick: string;
  selectedCount: string;
  compare: string;
  loading: string;
  clear: string;
  hint: string;
  max: string;
  emptyTitle: string;
  emptyHint: string;
  oneSelected: string;
  feature: string;
  cheapest: string;
  cheapestNoAds: string;
  planCount: string;
  catalog: string;
  maxQuality: string;
  adsOption: string;
  availability: string;
  available: string;
  notAvailable: string;
  bestPrice: string;
  plansTitle: string;
  remove: string;
  withAds: string;
  withoutAds: string;
  monthlyEquivalent: string;
  yes: string;
  no: string;
  viewPlatform: string;
  priceComparison: string;
  cheapestPlans: string;
}

export interface Auth {
  login: string;
  register: string;
  email: string;
  password: string;
  name: string;
  loginError: string;
  registerError: string;
  socialError: string;
  socialDivider: string;
  passwordMismatch: string;
  passwordMin: string;
  passwordSaved: string;
  changePasswordError: string;
  savePasswordError: string;
  newPassword: string;
  currentPassword: string;
  confirmPassword: string;
  changePassword: string;
  setPassword: string;
  logout: string;
  logoutPending: string;
  loginTitle: string;
  registerTitle: string;
  profileTitle: string;
  signedInWithPassword: string;
  accountCreatedViaSocial: string;
  loginPending: string;
  registerPending: string;
  savePending: string;
  backToHome: string;
  submit: string;
  pending: string;
  error: string;
}

export interface Dictionary {
  home: {
    title: string;
    description: string;
    stats: {
      platforms: string;
      contents: string;
      changes: string;
    };
    cheapest: string;
  };
  nav: Nav;
  country: Country;
  pricing: {
    month: string;
    year: string;
    annual: string;
    monthly: string;
    months: string;
  };
  platforms: Platforms;
  platform: Platform;
  contents: Contents;
  content: Content;
  changes: Changes;
  compare: Compare;
  auth: Auth;
}

export const getDictionary = async (locale: Locale) => getDict(locale);
export const hasLocale = async (locale: string) => {
  const normalized = locale.startsWith("/") ? locale.slice(1) : locale;
  try {
    await getDict(normalized as Locale);
    return true;
  } catch {
    return false;
  }
};
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4,
  },

  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxt/fonts'],

  ui: {
    colorMode: false,
  },

  fonts: {
    families: [
      // French / English — editorial serif display + neutral grotesk body (see SPEC.md §3).
      { name: 'Fraunces', provider: 'google', weights: [400, 500, 600, 700], styles: ['normal', 'italic'], subsets: ['latin', 'latin-ext'], global: true },
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700], subsets: ['latin', 'latin-ext'], global: true },
      // Arabic — paired display/body faces with proper Arabic glyph coverage
      // (system fonts render Arabic inconsistently across platforms).
      { name: 'El Messiri', provider: 'google', weights: [500, 600, 700], subsets: ['arabic', 'latin'], global: true },
      { name: 'Cairo', provider: 'google', weights: [400, 500, 600, 700], subsets: ['arabic', 'latin'], global: true },
    ],
  },

  i18n: {
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', dir: 'ltr', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', dir: 'ltr', file: 'en.json' },
      { code: 'ar', language: 'ar-MA', name: 'العربية', dir: 'rtl', file: 'ar.json' },
    ],
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    // No browser-based auto-detection: every visitor sees French by default.
    // Our own plugin (app/plugins/locale.ts) restores an explicit prior choice from a cookie.
    detectBrowserLanguage: false,
    lazy: true,
    langDir: 'locales',
    bundle: {
      optimizeTranslationDirective: false,
    },
  },

  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },

  typescript: {
    typeCheck: false,
    tsConfig: {
      compilerOptions: {
        types: ['@cloudflare/workers-types'],
      },
    },
  },

  nitro: {
    preset: 'cloudflare-module',
    cloudflare: {
      deployConfig: false,
      nodeCompat: true,
    },
  },

  runtimeConfig: {
    // Server-only. Overridden by wrangler vars / secrets in each environment.
    sessionCookieName: 'store_session',
    public: {
      storeName: 'Atelier',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr', dir: 'ltr' },
    },
  },
})

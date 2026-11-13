// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4,
  },

  modules: ['@nuxt/ui', '@nuxtjs/i18n'],

  ui: {
    colorMode: false,
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

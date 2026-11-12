// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4,
  },

  modules: ['@nuxt/ui'],

  ui: {
    colorMode: false,
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
      htmlAttrs: { lang: 'en' },
    },
  },
})

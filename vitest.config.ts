import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, 'server/database/migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    test: {
      include: ['tests/unit/**/*.test.ts'],
      setupFiles: ['./tests/setup/apply-migrations.ts'],
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          // Test-only binding so the setup file can apply migrations before tests run.
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  }
})

import { defineConfig } from 'vitest/config';

// `#src/*` resolves to the TypeScript sources under the `source` condition (package.json "imports").
export default defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
});

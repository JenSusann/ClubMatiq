
import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes-Modus für das Projekt aktivieren
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules')
            ? undefined
            : true
      },

      // Netlify-Adapter für das Deployment
      adapter: adapter()
    })
  ],

  // Softwareversion aus package.json übernehmen
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },

  test: {
    environment: 'node',

    include: [
      'tests/unit/**/*.test.ts'
    ],
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/routes/api/**/*.ts',
        'src/lib/server/**/*.ts',
        'src/hooks.server.ts'
      ],

      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],

      reportsDirectory: './coverage/unit'
    }
  }
});

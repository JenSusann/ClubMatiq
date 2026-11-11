
import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

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
  ]
});

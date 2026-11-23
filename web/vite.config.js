import { defineConfig } from 'vite';

// base relativa: funciona no GitHub Pages (usuario.github.io/klava-intranet/) e em domínio próprio
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});

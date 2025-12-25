
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 关键：Electron 打包必须使用相对路径
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});

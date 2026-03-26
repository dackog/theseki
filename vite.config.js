import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages のサブパス deploy 時は以下を追加:
  // base: '/theseki/',
});

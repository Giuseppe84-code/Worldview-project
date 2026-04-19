import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Worldview-project/',
  server: { port: 3000, open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/d3') || id.includes('node_modules/d3-')) {
            return 'vendor-d3';
          }
        },
      },
    },
  },
})

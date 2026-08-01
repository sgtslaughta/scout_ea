import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Backend origin the dev/preview servers proxy /api to. Override with
// EA_API_TARGET when 8765 is taken by another instance.
const apiTarget = process.env.EA_API_TARGET ?? 'http://127.0.0.1:8765'

// Hostnames Vite will serve to. It rejects unknown Host headers by default,
// which is what makes a tunnelled request fail with "Blocked request".
// Add more with EA_ALLOWED_HOSTS=a.example,b.example
const allowedHosts = [
  'scoutdb.jmolabs.dev',
  ...(process.env.EA_ALLOWED_HOSTS?.split(',').map((h) => h.trim()).filter(Boolean) ?? []),
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts,
    // Behind a Cloudflare tunnel the browser reaches the page over https:443,
    // so the HMR socket has to be told that — it defaults to the local port
    // and would otherwise fail to connect through the tunnel. Opt-in via
    // EA_TUNNEL=1, because forcing wss:443 breaks HMR for plain localhost
    // dev: the socket then dials a port nothing is listening on.
    hmr: process.env.EA_TUNNEL ? { clientPort: 443, protocol: 'wss' } : undefined,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})

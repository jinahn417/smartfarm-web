import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** 로컬 dev에서 /api → Vercel (server.proxy 만으로는 404가 나는 환경 대비) */
const VERCEL_ORIGIN = 'https://smartfarm-web-hazel.vercel.app'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'dev-proxy-api-to-vercel',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const path = req.url || ''
          if (!path.startsWith('/api')) {
            next()
            return
          }
          const dest = VERCEL_ORIGIN + path
          try {
            const r = await fetch(dest, { method: req.method || 'GET' })
            res.statusCode = r.status
            r.headers.forEach((value, key) => {
              if (['transfer-encoding', 'connection'].includes(key.toLowerCase())) return
              try {
                res.setHeader(key, value)
              } catch {
                /* ignore */
              }
            })
            const buf = Buffer.from(await r.arrayBuffer())
            res.end(buf)
          } catch (e) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end(`[dev proxy] ${e?.message || e}`)
          }
        })
      },
    },
    react(),
  ],
})

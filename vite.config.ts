import { defineConfig } from 'vite'

export default defineConfig({
  base: '/demo1/',
  server: { proxy: { '/demo1/api': 'http://127.0.0.1:4174' } },
})

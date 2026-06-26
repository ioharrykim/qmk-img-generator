import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // 프록시 모드(VITE_API_MODE=proxy)로 로컬 개발할 때 /api 를 백엔드로 전달.
    // 직접 모드에서는 사용되지 않음.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

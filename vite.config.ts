import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /** GitHub Pages 配下でも動くように相対パスで出力する */
  base: './',
  server: {
    /** 実機(スマホ)から同一LANで開いて確認するため */
    host: true,
  },
})

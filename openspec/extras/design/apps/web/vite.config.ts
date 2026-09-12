import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// O front nunca conhece portas: tudo passa pelo proxy /api/*.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/catalogo": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api\/catalogo/, ""),
      },
      "/api/pedidos": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api\/pedidos/, "/pedidos"),
      },
    },
  },
});

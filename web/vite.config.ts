import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import basicSsl from "@vitejs/plugin-basic-ssl";

// `npm run dev:phone` serves over https on your Wi-Fi so a phone can use its camera
// (browsers only allow the camera on https or localhost). The certificate is self-signed,
// so the phone shows a warning once: tap "Show Details", then "visit this website".
const phone = process.env.SEAM_PHONE === "1";

export default defineConfig({
  plugins: [svelte(), ...(phone ? [basicSsl()] : [])],
  server: phone ? { port: 5173, host: "0.0.0.0" } : { port: 5173, host: "127.0.0.1" },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});

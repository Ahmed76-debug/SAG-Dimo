import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* =============================================================
   نقطة تشغيل التطبيق (وضع ويب مع قاعدة بيانات مُدارة على الخادم)
   ============================================================= */

function bootstrap() {
  if ("serviceWorker" in navigator && import.meta.env.PROD && import.meta.env.MODE !== "desktop") {
    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* العمل دون اتصال غير متاح — لا يضرّ التشغيل */
      });
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
  }

  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

bootstrap();
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import cards from "./cards.json";
import { appBase, assetUrl } from "./assets";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (
  import.meta.env.PROD &&
  /^https?:$/.test(location.protocol) &&
  !(window as Window & { __NAVY_ASSETS__?: unknown }).__NAVY_ASSETS__ &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", appBase), { scope: appBase.pathname })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const resources = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => new URL(url).origin === location.origin);
        const urls = [
          ...new Set(
            [
              appBase.href,
              assetUrl("icon.svg"),
              assetUrl("manifest.webmanifest"),
              ...cards.map((card) => assetUrl(card.image)),
              ...resources,
            ].map((url) => new URL(url, location.origin).href),
          ),
        ];
        registration.active?.postMessage({ type: "CACHE_CARDS", urls });
      })
      .catch(() => {
        /* Online use remains available when offline caching is unavailable. */
      });
  });
}

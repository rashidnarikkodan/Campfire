"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/userStore";

export default function ClientInit() {
  const init = useUserStore((state) => state.init);

  useEffect(() => {
    init();

    // Register PWA Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("🔥 Campfire PWA Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration failed:", err);
          });
      });
    }
  }, [init]);

  return null;
}

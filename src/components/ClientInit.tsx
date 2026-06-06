"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/userStore";

export default function ClientInit() {
  const init = useUserStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return null;
}

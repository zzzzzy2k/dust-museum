import { useEffect, useState } from "react";
import { todayISO } from "@/lib/ledger";

export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let midnightTimer: number | undefined;

    const refresh = () => setToday(todayISO());

    const scheduleMidnight = () => {
      window.clearTimeout(midnightTimer);
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      );
      midnightTimer = window.setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        scheduleMidnight();
      }
    };

    const handleFocus = () => {
      refresh();
      scheduleMidnight();
    };

    refresh();
    scheduleMidnight();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return today;
}

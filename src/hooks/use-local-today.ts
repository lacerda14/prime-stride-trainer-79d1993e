import { useEffect, useState } from "react";
import { getLocalToday, msUntilNextLocalMidnight, type LocalToday } from "@/lib/local-today";

export function useLocalToday(): LocalToday {
  const [today, setToday] = useState(() => getLocalToday());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday(getLocalToday());
      timer = setTimeout(refresh, msUntilNextLocalMidnight());
    };

    timer = setTimeout(refresh, msUntilNextLocalMidnight());
    const onVisibility = () => {
      if (document.visibilityState === "visible") setToday(getLocalToday());
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return today;
}
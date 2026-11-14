import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ThemeContext = createContext(null);
const IslandContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("civicsathi-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("civicsathi-theme", theme);
    } catch {
      // The theme still works for this page if browser storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

export function IslandProvider({ children }) {
  const [notice, setNotice] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback(({ type = "info", message, progress } = {}) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setNotice({ type, message: message || "", progress: Number.isFinite(progress) ? Math.max(0, Math.min(progress, 100)) : null });
    timerRef.current = window.setTimeout(() => setNotice(null), 3000);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setNotice(null);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return <IslandContext.Provider value={{ notice, show, dismiss }}>{children}</IslandContext.Provider>;
}

export function useIsland() {
  const context = useContext(IslandContext);
  if (!context) throw new Error("useIsland must be used inside IslandProvider");
  return context;
}

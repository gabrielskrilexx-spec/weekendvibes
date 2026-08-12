import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  highContrast: boolean;
  toggleContrast?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType>({ theme: "dark", highContrast: false, switchable: false });

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return stored === "light" || stored === "dark" ? stored : defaultTheme;
    }
    return defaultTheme;
  });
  const [highContrast, setHighContrast] = useState(() => switchable && localStorage.getItem("highContrast") === "true");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("high-contrast", highContrast);

    if (switchable) {
      localStorage.setItem("theme", theme);
      localStorage.setItem("highContrast", String(highContrast));
    }
  }, [theme, highContrast, switchable]);

  const toggleTheme = switchable
    ? () => {
        const root = document.documentElement;
        root.classList.add("theme-transitioning");
        setTheme(prev => (prev === "light" ? "dark" : "light"));
        window.setTimeout(() => root.classList.remove("theme-transitioning"), 220);
      }
    : undefined;
  const toggleContrast = switchable ? () => setHighContrast(prev => !prev) : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, highContrast, toggleContrast, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

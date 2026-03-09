import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeName = "light" | "dark" | "ocean" | "sunset" | "forest";

type ThemeOption = {
  id: ThemeName;
  label: string;
};

export interface ChartColors {
  palette: string[];
  income: string;
  expenses: string;
  net: string;
  projected: string;
  reference: string;
  heatmapBase: string;
}

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: ThemeOption[];
  chartColors: ChartColors;
};

const STORAGE_KEY = "app_theme";

const THEMES: ThemeOption[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "forest", label: "Forest" },
];

const CHART_COLORS: Record<ThemeName, ChartColors> = {
  light: {
    palette: ["#4f46e5", "#0891b2", "#db2777", "#ea580c", "#16a34a", "#7c3aed", "#2563eb", "#c026d3"],
    income: "#16a34a",
    expenses: "#dc2626",
    net: "#4f46e5",
    projected: "#7c3aed",
    reference: "#64748b",
    heatmapBase: "220, 38, 38",
  },
  dark: {
    palette: ["#60a5fa", "#22d3ee", "#f472b6", "#fb923c", "#4ade80", "#a78bfa", "#38bdf8", "#f9a8d4"],
    income: "#4ade80",
    expenses: "#f87171",
    net: "#60a5fa",
    projected: "#a78bfa",
    reference: "#94a3b8",
    heatmapBase: "248, 113, 113",
  },
  ocean: {
    palette: ["#0ea5a8", "#2563eb", "#0d9488", "#0284c7", "#14b8a6", "#0369a1", "#0891b2", "#06b6d4"],
    income: "#059669",
    expenses: "#dc2626",
    net: "#0ea5a8",
    projected: "#0284c7",
    reference: "#3a6876",
    heatmapBase: "220, 38, 38",
  },
  sunset: {
    palette: ["#ea580c", "#f59e0b", "#f43f5e", "#fb7185", "#d97706", "#c2410c", "#b45309", "#f97316"],
    income: "#15803d",
    expenses: "#b91c1c",
    net: "#ea580c",
    projected: "#f59e0b",
    reference: "#9a3412",
    heatmapBase: "185, 28, 28",
  },
  forest: {
    palette: ["#2f855a", "#4d7c0f", "#16a34a", "#65a30d", "#15803d", "#84cc16", "#166534", "#3f6212"],
    income: "#16a34a",
    expenses: "#b91c1c",
    net: "#2f855a",
    projected: "#4d7c0f",
    reference: "#4b6650",
    heatmapBase: "185, 28, 28",
  },
};

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark" || value === "ocean" || value === "sunset" || value === "forest";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeName(stored) ? stored : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      themes: THEMES,
      chartColors: CHART_COLORS[theme],
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

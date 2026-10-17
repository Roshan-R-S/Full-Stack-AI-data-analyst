import { useEffect, useRef, useState } from "react";

import DatasetsPage from "./pages/DatasetsPage";
import AnalystPage from "./pages/AnalystPage";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";

type Theme = "dark" | "light";
type View = "datasets" | "analysis" | "ai" | "dashboard";
type ApiStatus = "checking" | "online" | "offline";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(systemTheme);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousViewRef = useRef<View>("datasets");
  const [view, setView] = useState<View>("datasets");
  const [apiStatus, setApiStatus] =
    useState<ApiStatus>("checking");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (previousViewRef.current !== view) {
      previousViewRef.current = view;
      pageHeadingRef.current?.focus({
        preventScroll: true,
      });
    }

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/v1/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        setApiStatus("online");
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setApiStatus("offline");
      });

    return () => controller.abort();
  }, []);

  const pages: Record<View, {
    number: string;
    title: string;
    description: string;
  }> = {
    datasets: {
      number: "MODULE 01 / DATASET WORKSPACE",
      title: "YOUR DATA.",
      description:
        "Import a dataset. Inspect every column. Understand its structure.",
    },
    analysis: {
      number: "MODULE 02 / ANALYSIS ENGINE",
      title: "FIND PATTERNS.",
      description:
        "Filter, group and aggregate with verified Pandas calculations.",
    },
    dashboard: {
      number: "MODULE 04 / DATA INTELLIGENCE",
      title: "DATA OVERVIEW.",
      description:
        "Explore verified metrics, distributions and comparisons across your dataset.",
    },
    ai: {
      number: "MODULE 03 / AI ANALYST",
      title: "ASK ANYTHING.",
      description:
        "Ask natural-language analytical questions and inspect verified results.",
    },
  };

  const page = pages[view];

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        SKIP TO MAIN CONTENT
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="signal-dot" />
          DATA / ANALYST
        </div>

        <div className="topbar-actions">
          <span className={`api-status ${apiStatus}`} aria-live="polite">
            [{apiStatus.toUpperCase()}]
          </span>

          <button
            className="theme-button"
            type="button"
            onClick={() =>
              setTheme(theme === "dark" ? "light" : "dark")
            }
            aria-label={`Switch to ${
              theme === "dark" ? "light" : "dark"
            } theme`}
          >
            [ {theme === "dark" ? "LIGHT" : "DARK"} ]
          </button>
        </div>
      </header>

      <nav className="app-navigation" aria-label="Main navigation">
        {([
          ["datasets", "01 / DATASETS"],
          ["analysis", "02 / ANALYSIS"],
          ["ai", "03 / AI CHAT"],
          ["dashboard", "04 / DASHBOARD"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            aria-current={view === id ? "page" : undefined}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main id="main-content" tabIndex={-1}>
        <div key={view} className="view-transition">
        <section className="workspace-hero">
          <p className="eyebrow">{page.number}</p>
          <h1 ref={pageHeadingRef} tabIndex={-1}>{page.title}</h1>
          <p>{page.description}</p>
        </section>

        {view === "datasets" && <DatasetsPage />}
        {view === "analysis" && <AnalystPage />}
        {view === "ai" && <ChatPage />}
        {view === "dashboard" && <DashboardPage />}
        </div>
      </main>

      <footer className="footer">
        <span>AI DATA ANALYST / PHASE 05</span>
        <span>BUILT FOR CLARITY.</span>
      </footer>
    </div>
  );
}
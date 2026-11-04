import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Activity from "./components/Activity";
import { BoxIcon, ClipboardIcon, OverviewIcon, PulseIcon } from "./components/Icons";
import Inventory from "./components/Inventory";
import Overview from "./components/Overview";
import PurchaseOrders from "./components/PurchaseOrders";
import { ToastProvider } from "./components/Toast";

type Page = "overview" | "inventory" | "orders" | "activity";

const pages: { id: Page; label: string; title: string; blurb: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", title: "Overview", blurb: "What needs attention in your supply room today.", icon: <OverviewIcon /> },
  { id: "inventory", label: "Inventory", title: "Inventory", blurb: "Stock on hand, expiry dates and reorder points.", icon: <BoxIcon /> },
  { id: "orders", label: "Purchase orders", title: "Purchase orders", blurb: "Order from vendors and receive deliveries into stock.", icon: <ClipboardIcon /> },
  { id: "activity", label: "Activity", title: "Activity", blurb: "A complete audit trail of every stock change.", icon: <PulseIcon /> }
];

const fromHash = (): Page => {
  const id = window.location.hash.replace("#", "");
  return pages.some(p => p.id === id) ? (id as Page) : "overview";
};

export default function App() {
  const [page, setPage] = useState<Page>(fromHash);

  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: Page) => {
    window.location.hash = next;
    setPage(next);
  };

  const current = pages.find(p => p.id === page) ?? pages[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="var(--primary)" />
              <path d="M16 8v16M8 16h16" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
            </svg>
            <div>
              <strong>ClinicOps</strong>
              <span>Supply management</span>
            </div>
          </div>

          <nav aria-label="Main navigation">
            {pages.map(p => (
              <button
                key={p.id}
                type="button"
                className={`nav-item ${page === p.id ? "active" : ""}`}
                aria-current={page === p.id ? "page" : undefined}
                onClick={() => go(p.id)}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <span className="pulse-dot" />
            Live inventory · {today}
          </div>
        </aside>

        <main className="main">
          <header className="page-header">
            <h1>{current.title}</h1>
            <p>{current.blurb}</p>
          </header>

          {page === "overview" && <Overview onNavigate={go} />}
          {page === "inventory" && <Inventory />}
          {page === "orders" && <PurchaseOrders />}
          {page === "activity" && <Activity />}
        </main>
      </div>
    </ToastProvider>
  );
}

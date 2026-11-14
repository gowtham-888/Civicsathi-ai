import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, LoaderCircle, Map, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useIsland, useTheme } from "./AppContexts.jsx";

const links = [
  { to: "/", label: "Report", icon: Sparkles, end: true },
  { to: "/map", label: "Map", icon: Map },
  { to: "/track", label: "Track", icon: Activity },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

function ActiveLinks({ mobile = false }) {
  const layoutId = mobile ? "active-mobile-tab" : "active-island-tab";
  return links.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className="relative isolate flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold transition-colors sm:px-3.5"
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId={layoutId} transition={{ type: "spring", stiffness: 480, damping: 36 }} className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6] shadow-lg shadow-blue-500/20" />}
          <Icon size={15} strokeWidth={2.2} className={isActive ? "text-white" : "text-[var(--text-muted)]"} />
          <span className={isActive ? "text-white" : "text-[var(--text-muted)]"}>{label}</span>
        </>
      )}
    </NavLink>
  ));
}

function NoticeIcon({ type }) {
  if (type === "success") return <CheckCircle2 className="text-[var(--success)]" size={17} />;
  if (type === "warning") return <AlertTriangle className="text-[var(--warning)]" size={17} />;
  if (type === "error") return <AlertTriangle className="text-[var(--danger)]" size={17} />;
  if (type === "progress") return <LoaderCircle className="animate-spin text-[#6ea3ff]" size={17} />;
  return <Sparkles className="text-[#8B5CF6]" size={17} />;
}

export default function Navbar() {
  const { notice } = useIsland();
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <motion.header
        layout
        transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
        className="fixed left-1/2 top-3 z-[1100] w-fit max-w-[calc(100vw-1.25rem)] -translate-x-1/2 rounded-[28px] border border-[var(--glass-border)] bg-[var(--island-bg)] p-1.5 text-[var(--text-primary)] shadow-[0_18px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:top-5 sm:max-w-none sm:rounded-full sm:px-2"
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/" className="flex shrink-0 items-center gap-2 rounded-full px-2 py-1.5 sm:px-3" aria-label="CivicSathi home">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#4F8CFF] to-[#8B5CF6] text-white shadow-md shadow-blue-500/20"><Sparkles size={15} /></span>
            <span className="hidden text-xs font-extrabold tracking-tight sm:inline">CivicSathi</span>
          </NavLink>

          <nav className="hidden items-center gap-0.5 border-l border-[var(--glass-border)] pl-2 md:flex" aria-label="Main navigation">
            <ActiveLinks />
          </nav>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--glass-border)] bg-[var(--surface-soft)] text-[var(--text-primary)] transition hover:border-[#4F8CFF]/50 hover:text-[#8B5CF6]"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {notice && (
            <motion.div
              key="island-notice"
              initial={{ opacity: 0, height: 0, y: -5 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -5 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="overflow-hidden"
            >
              <div className="mt-1.5 border-t border-[var(--glass-border)] px-3 pb-2 pt-3 sm:px-4">
                <div className="flex items-center gap-2.5">
                  <NoticeIcon type={notice.type} />
                  <p aria-live="polite" className="min-w-0 flex-1 text-[11px] font-bold leading-snug sm:text-xs">{notice.message}</p>
                  {notice.progress !== null && <span className="text-[10px] font-extrabold tabular-nums text-[var(--text-muted)]">{Math.round(notice.progress)}%</span>}
                </div>
                {notice.progress !== null && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-soft)]"><motion.div initial={{ width: 0 }} animate={{ width: `${notice.progress}%` }} transition={{ duration: 0.25 }} className="h-full rounded-full bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6]" /></div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <nav className="fixed inset-x-3 bottom-3 z-[1100] flex items-center justify-around rounded-full border border-[var(--glass-border)] bg-[var(--island-bg)] p-1.5 text-[var(--text-primary)] shadow-[0_18px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:hidden" aria-label="Mobile navigation">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="relative isolate flex min-w-[60px] flex-col items-center gap-1 rounded-full px-3 py-2 text-[9px] font-bold">
            {({ isActive }) => <>
              {isActive && <motion.span layoutId="active-mobile-tab" transition={{ type: "spring", stiffness: 480, damping: 36 }} className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6]" />}
              <Icon size={15} className={isActive ? "text-white" : "text-[var(--text-muted)]"} /><span className={isActive ? "text-white" : "text-[var(--text-muted)]"}>{label}</span>
            </>}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

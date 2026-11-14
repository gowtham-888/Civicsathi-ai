import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar.jsx";
import ReportPage from "./pages/ReportPage.jsx";
import { AdminPage, MapPage, TrackPage } from "./pages/OtherPages.jsx";

export default function App() {
  const location = useLocation();
  return (
    <div className="page-shell flex min-h-screen flex-col pb-24 pt-24 md:pb-0 md:pt-28">
      <Navbar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} className="flex-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
          <Routes location={location}>
            <Route path="/" element={<ReportPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<ReportPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      <footer className="border-t border-line bg-white/50 px-4 py-6 text-center text-[11px] text-slate-400"><span className="font-bold text-slate-300">Built for INNOVATE 2.0 Hackathon 2026</span><span className="mx-2">·</span>CivicSathi AI</footer>
    </div>
  );
}

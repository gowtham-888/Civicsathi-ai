import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  Check,
  ChevronRight,
  CloudUpload,
  Crosshair,
  FileImage,
  Languages,
  Mic,
  MicOff,
  MapPin,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import api, { getUploadUrl } from "../lib/api.js";
import LocationPicker from "../components/LocationPicker.jsx";
import { useIsland } from "../components/AppContexts.jsx";

const scoreParts = [
  { key: "severity", label: "Issue severity", max: 40, color: "bg-forest" },
  { key: "location_sensitivity", label: "Location sensitivity", max: 30, color: "bg-teal-500" },
  { key: "duplicate_count", label: "Nearby reports", max: 20, color: "bg-amber" },
  { key: "age", label: "Report age", max: 10, color: "bg-sky-500" },
];

function ScoreBreakdown({ breakdown = {} }) {
  return (
    <div className="space-y-4">
      {scoreParts.map((part) => {
        const value = Number(breakdown[part.key] || 0);
        return (
          <div key={part.key}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">{part.label}</span>
              <span className="font-bold tabular-nums text-ink">{value.toFixed(1)} <span className="font-medium text-slate-400">/ {part.max}</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((value / part.max) * 100, 100)}%` }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className={`h-full rounded-full ${part.color}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultImage({ report, previewUrl }) {
  const [dimensions, setDimensions] = useState(null);
  const imageUrl = previewUrl || getUploadUrl(report.image_path);
  const box = report.bbox;
  const style = dimensions && box
    ? {
        left: `${(box.x / dimensions.width) * 100}%`,
        top: `${(box.y / dimensions.height) * 100}%`,
        width: `${(box.w / dimensions.width) * 100}%`,
        height: `${(box.h / dimensions.height) * 100}%`,
      }
    : undefined;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-100">
      <img
        src={imageUrl}
        alt="Submitted civic issue"
        className="block max-h-[420px] w-full object-contain"
        onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      />
      {style && <div className="bbox-overlay" style={style}><span>Detected {report.category}</span></div>}
      {!style && <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow">No AI box available</div>}
    </div>
  );
}

function ScoreGauge({ score }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-paper/60 p-4">
      <div className="relative h-[94px] w-[94px] shrink-0" role="img" aria-label={`Priority score ${Math.round(value)} out of 100`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(158,177,210,.16)" strokeWidth="8" />
          <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#score-gradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - value / 100) }} transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }} />
          <defs><linearGradient id="score-gradient"><stop stopColor="#4F8CFF"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs>
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xl font-black tabular-nums text-ink">{Math.round(value)}</span>
      </div>
      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority score · {Math.round(value)}/100</p><p className="mt-0.5 text-sm font-extrabold text-ink">{value >= 70 ? "High priority" : value >= 40 ? "Medium priority" : "Low priority"}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Weighted from four report signals</p></div>
    </div>
  );
}

function DetectionBanner() {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <ShieldAlert size={19} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-extrabold">AI detection unavailable</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/75">Choose the issue category yourself to continue. Your report will still be submitted.</p>
      </div>
    </motion.div>
  );
}

export default function ReportPage() {
  const { show } = useIsland();
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechTimerRef = useRef(null);
  const speechBaseRef = useRef("");
  const speechFinalRef = useRef("");
  const understandingRequestRef = useRef(0);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [location, setLocation] = useState(null);
  const [description, setDescription] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState("kn-IN");
  const [listening, setListening] = useState(false);
  const [understanding, setUnderstanding] = useState(null);
  const [understandingLoading, setUnderstandingLoading] = useState(false);
  const [understandingError, setUnderstandingError] = useState(false);
  const [category, setCategory] = useState("");
  const [categoryNeeded, setCategoryNeeded] = useState(false);
  const [detectionUnavailable, setDetectionUnavailable] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => {
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* Recognition may already have ended. */ }
    }
  }, []);

  async function understandDescription(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const requestId = ++understandingRequestRef.current;
    setUnderstandingLoading(true);
    setUnderstandingError(false);
    try {
      const response = await api.post("/api/understand-text", { description: trimmed });
      if (requestId === understandingRequestRef.current) {
        setUnderstanding(response.data);
        setUnderstandingError(false);
      }
    } catch {
      // Keep report submission available if Gemini is not configured or reachable.
      if (requestId === understandingRequestRef.current) setUnderstandingError(true);
    } finally {
      if (requestId === understandingRequestRef.current) setUnderstandingLoading(false);
    }
  }

  function scheduleTextUnderstanding(text, delay = 1000) {
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    speechTimerRef.current = window.setTimeout(() => understandDescription(text), delay);
  }

  function toggleSpeechRecognition() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;
    speechBaseRef.current = description.trim();
    speechFinalRef.current = "";
    setUnderstanding(null);
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interimText += `${result[0].transcript} `;
      }
      speechFinalRef.current = finalText.trim();
      const transcript = [speechBaseRef.current, finalText.trim(), interimText.trim()].filter(Boolean).join(" ").slice(0, 500);
      setDescription(transcript);
      if (speechFinalRef.current) {
        scheduleTextUnderstanding([speechBaseRef.current, speechFinalRef.current].filter(Boolean).join(" "));
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      if (speechFinalRef.current) {
        scheduleTextUnderstanding([speechBaseRef.current, speechFinalRef.current].filter(Boolean).join(" "), 250);
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setError("Choose an image file such as JPG or PNG.");
      return;
    }
    setFile(nextFile);
    setReport(null);
    setError("");
    setCategory("");
    setCategoryNeeded(false);
    setDetectionUnavailable(false);
  }

  function useBrowserLocation() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available in this browser. Click the map to place a pin.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage("Your location is selected. You can adjust it by clicking the map.");
        setLocating(false);
      },
      () => {
        setLocationMessage("Couldn’t access your location. Click the map to place a pin.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function submitReport(event) {
    event.preventDefault();
    setError("");
    if (!file) return setError("Add a photo of the issue first.");
    if (!location) return setError("Choose the issue location using your location or the map.");
    if (categoryNeeded && !category) return setError("Choose whether this is a pothole or garbage report.");

    const body = new FormData();
    body.append("image", file);
    body.append("latitude", String(location.latitude));
    body.append("longitude", String(location.longitude));
    body.append("description", description.trim());
    if (category) body.append("category", category);

    setSubmitting(true);
    show({ type: "progress", message: "Uploading photo…", progress: 0 });
    let lastProgressStep = -1;
    let analysisStarted = false;
    try {
      const response = await api.post("/api/reports", body, {
        onUploadProgress: (event) => {
          if (!event.total) return;
          const progress = Math.round((event.loaded / event.total) * 100);
          if (progress >= 100) {
            if (!analysisStarted) {
              analysisStarted = true;
              show({ type: "progress", message: "AI is analysing…", progress: 100 });
            }
            return;
          }
          const progressStep = Math.floor(progress / 5);
          if (progressStep !== lastProgressStep) {
            lastProgressStep = progressStep;
            show({ type: "progress", message: "Uploading photo…", progress });
          }
        },
      });
      setReport(response.data);
      const isManual = response.data.detection_source === "manual";
      setDetectionUnavailable(isManual);
      setCategoryNeeded(isManual);
      window.setTimeout(() => document.getElementById("report-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

      const messages = [];
      if (isManual) {
        messages.push({ type: "warning", message: "AI detection unavailable" });
      } else {
        const detectedCategory = response.data.category === "pothole" ? "Pothole" : "Garbage";
        const confidence = Math.round(Number(response.data.confidence || 0) * 100);
        messages.push({ type: "success", message: `${detectedCategory} detected - ${confidence}%` });
      }
      const score = Number(response.data.priority_score || 0);
      const priority = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
      messages.push({ type: score >= 70 ? "warning" : "info", message: `Priority ${Math.round(score)} - ${priority}` });
      if (response.data.duplicate_of) {
        messages.push({ type: "info", message: "Linked to 1 similar report" });
      }
      messages.push({ type: "success", message: `Submitted - Report ID ${response.data.id}` });
      messages.forEach((message, index) => {
        window.setTimeout(() => show(message), index * 850);
      });
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      if (typeof detail === "string" && detail.toLowerCase().includes("category") && detail.toLowerCase().includes("detection")) {
        setCategoryNeeded(true);
        setDetectionUnavailable(true);
        setError("");
        show({ type: "warning", message: "AI detection unavailable" });
      } else {
        setError(typeof detail === "string" ? detail : "Could not send your report. Check that the backend is running and try again.");
        show({ type: "error", message: "Could not submit report" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFile(null);
    setLocation(null);
    setDescription("");
    setCategory("");
    setCategoryNeeded(false);
    setDetectionUnavailable(false);
    setReport(null);
    setError("");
    setLocationMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
      <section className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-mint px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-forest">
            <span className="h-1.5 w-1.5 rounded-full bg-forest" /> Your neighbourhood, heard
          </div>
          <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-[-0.04em] text-ink sm:text-5xl">Small report.<br className="hidden sm:block" /> <span className="text-forest">Real change.</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">Spot a pothole or a garbage issue? Add a photo and location. We’ll get it to the right people.</p>
        </div>
        <div className="hidden items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm lg:flex">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><MapPin size={19} /></span>
          <div><p className="text-xs font-extrabold text-ink">Built for local action</p><p className="mt-0.5 text-[11px] text-slate-500">Potholes · Garbage · Bengaluru</p></div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
        <form onSubmit={submitReport} className="space-y-5 rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-forest/70">New report</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink">Tell us what needs fixing</h2></div>
            <span className="rounded-full bg-paper px-3 py-1.5 text-[10px] font-bold text-slate-500">STEP 1 OF 1</span>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-ink">Issue photo <span className="text-rose-500">*</span></label>
              {file && <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-bold text-forest hover:underline">Change photo</button>}
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
            {file ? (
                <div className={`relative overflow-hidden rounded-2xl border border-line bg-paper ${submitting ? "scan-active" : ""}`}>
                <img src={previewUrl} alt="Selected issue preview" className="max-h-72 w-full object-contain" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-ink shadow"><FileImage size={14} className="text-forest" />{file.name}</div>
                  {submitting && <div className="absolute inset-0 grid place-items-center bg-slate-950/25"><span className="rounded-full border border-white/20 bg-slate-950/70 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur">Scanning image for civic issues…</span></div>}
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
                aria-label="Choose an issue photo by browsing or dropping an image"
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
                className={`group cursor-pointer rounded-2xl border-2 border-dashed px-5 py-9 text-center transition ${dragging ? "border-forest bg-mint/60" : "border-slate-200 bg-paper/70 hover:border-forest/40 hover:bg-mint/30"}`}
              >
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-forest shadow-sm transition group-hover:-translate-y-0.5"><CloudUpload size={22} /></span>
                <p className="mt-3 text-sm font-extrabold text-ink">Drop your photo here, or <span className="text-forest">browse</span></p>
                <p className="mt-1 text-xs text-slate-400">A clear photo helps us understand the issue</p>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-bold text-ink">Where is it? <span className="text-rose-500">*</span></label>
              <button type="button" onClick={useBrowserLocation} disabled={locating} className="inline-flex items-center gap-1.5 rounded-full border border-forest/15 bg-mint/50 px-3 py-2 text-xs font-extrabold text-forest transition hover:bg-mint disabled:opacity-60">
                <Crosshair size={14} className={locating ? "animate-spin" : ""} />{locating ? "Finding you…" : "Use my location"}
              </button>
            </div>
            <p className="mb-2 text-xs text-slate-500">Click on the map to place or move the pin.</p>
            <LocationPicker location={location} onChoose={(point) => { setLocation(point); setLocationMessage("Pin placed. You can move it by clicking elsewhere on the map."); }} />
            {location && <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-forest"><Check size={14} />{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</div>}
            {locationMessage && <p className="mt-2 text-xs text-slate-500">{locationMessage}</p>}
          </section>

          <section>
            <label htmlFor="description" className="mb-2 block text-sm font-bold text-ink">A little more detail <span className="font-medium text-slate-400">(optional)</span></label>
            <textarea id="description" rows={3} maxLength={500} value={description} onChange={(event) => { setDescription(event.target.value); setUnderstanding(null); setUnderstandingError(false); understandingRequestRef.current += 1; if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current); }} placeholder="Tell us what you noticed, or a nearby landmark…" className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-forest/50 focus:ring-4 focus:ring-forest/5" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {SpeechRecognition && <div className="flex items-center gap-2">
                <button type="button" onClick={toggleSpeechRecognition} aria-label={listening ? "Stop voice description" : "Start voice description"} aria-pressed={listening} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${listening ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-line bg-paper/60 text-slate-500 hover:border-forest/40 hover:text-forest"}`}>
                  {listening ? <MicOff size={15}/> : <Mic size={15}/>}<span>{listening ? "Stop speaking" : "Speak description"}</span>
                </button>
                <button type="button" disabled={listening} onClick={() => setSpeechLanguage((current) => current === "kn-IN" ? "en-IN" : "kn-IN")} aria-label={`Speech language ${speechLanguage === "kn-IN" ? "Kannada" : "English"}. Switch language`} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-400 transition hover:text-forest disabled:opacity-50"><Languages size={14}/>{speechLanguage === "kn-IN" ? "ಕನ್ನಡ" : "English"}</button>
              </div>}
              <p className="ml-auto text-right text-[10px] text-slate-400">{description.length}/500</p>
            </div>
            {(understandingLoading || understanding) && <div className="mt-3 rounded-2xl border border-line bg-paper/50 p-4" aria-live="polite" aria-busy={understandingLoading}>
              {understandingLoading ? <p className="flex items-center gap-2 text-xs font-semibold text-slate-400"><span className="h-3 w-3 animate-spin rounded-full border-2 border-forest/30 border-t-forest"/>Understanding your description…</p> : <>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-forest">Description understood</p>
                <p className="mt-2 text-sm font-semibold capitalize text-ink">Suggested category: {understanding.category}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{understanding.summary_english}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Urgency hint: <span className="text-amber">{understanding.urgency_hint}</span></p>
              </>}
            </div>}
            {understandingError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900" role="status">Text suggestion is unavailable. Your description is kept, and you can still submit the report.</p>}
          </section>

          <AnimatePresence>{detectionUnavailable && <DetectionBanner />}</AnimatePresence>

          <AnimatePresence>
            {categoryNeeded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label htmlFor="category" className="mb-2 block text-sm font-bold text-ink">Choose the issue type <span className="text-rose-500">*</span></label>
                <select id="category" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-forest/50 focus:ring-4 focus:ring-forest/5">
                  <option value="">Select a category</option><option value="pothole">Pothole</option><option value="garbage">Garbage</option>
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"><AlertCircle size={16} className="shrink-0" />{error}</div>}

          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-forest/15 transition hover:-translate-y-0.5 hover:bg-ink disabled:cursor-wait disabled:opacity-70">
            {submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Sending your report…</> : <><Send size={16} />Submit report<ChevronRight size={16} /></>}
          </button>
          <p className="text-center text-[10px] leading-relaxed text-slate-400">Your report helps local teams understand what needs attention.</p>
        </form>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-[28px] bg-ink p-6 text-white shadow-card sm:p-7">
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-amber"><Sparkles size={20} /></span>
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/60">How it works</span>
            </div>
            <h3 className="mt-5 text-xl font-extrabold tracking-tight">A clearer picture.<br />A faster response.</h3>
            <div className="mt-5 space-y-4">
              {[
                ["01", "Share a photo", "Show us the issue as you found it."],
                ["02", "Pin the place", "A precise location helps the right team act."],
                ["03", "Follow the progress", "Keep your report ID to check back."],
              ].map(([number, title, detail]) => <div key={number} className="flex gap-3"><span className="mt-0.5 text-xs font-black text-amber">{number}</span><div><p className="text-xs font-extrabold">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-white/55">{detail}</p></div></div>)}
            </div>
            <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[10px] font-semibold text-white/55"><MapPin size={13} className="text-amber" />Neighbourhood reports make a difference.</div>
          </div>

          <AnimatePresence>
            {report && (
              <motion.section id="report-result" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-24 space-y-4 rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-forest"><Check size={12} />Report received</div><h3 className="mt-2 text-lg font-extrabold tracking-tight text-ink">Your report is in</h3></div>
                  <button type="button" onClick={resetForm} title="Start another report" className="rounded-xl border border-line p-2 text-slate-400 transition hover:bg-paper hover:text-forest"><RotateCcw size={15} /></button>
                </div>
                <ResultImage report={report} previewUrl={previewUrl} />
                <div className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Issue category</p><p className="mt-0.5 text-sm font-extrabold capitalize text-ink">{report.category}</p></div>
                  <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confidence</p><p className="mt-0.5 text-sm font-extrabold text-ink">{report.detection_source === "ai" ? `${(Number(report.confidence || 0) * 100).toFixed(0)}%` : "Manual"}</p></div>
                </div>
                {report.duplicate_of ? (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900"><MapPin size={14} />Linked to 1 similar report <span className="text-amber-700/70">(report #{report.duplicate_of})</span></div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5 text-xs font-semibold text-slate-500"><Check size={14} className="text-forest" />No similar reports linked</div>
                )}
                <div className="rounded-2xl border border-line p-4">
                  <ScoreGauge score={report.priority_score} />
                  <div className="mt-5">
                  <ScoreBreakdown breakdown={report.score_breakdown} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-3"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Report ID</span><span className="font-mono text-sm font-black text-ink">#{report.id}</span></div>
                <button type="button" onClick={resetForm} className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-extrabold text-forest hover:bg-mint/50"><ArrowDown size={14} className="rotate-180" />Submit another report</button>
              </motion.section>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </main>
  );
}

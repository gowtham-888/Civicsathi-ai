import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CalendarDays, Check, CircleDot, Clock3, ImagePlus, LockKeyhole, LogOut, MapPinned, RefreshCw, Search, ShieldCheck, TriangleAlert, Upload, Users, X } from "lucide-react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { getUploadUrl } from "../lib/api.js";
import { useIsland } from "../components/AppContexts.jsx";

const MAP_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CHART_COLORS = ["#4F8CFF", "#8B5CF6", "#2DD4BF", "#F59E0B"];
const CATEGORIES = ["All", "pothole", "garbage"];
const STATUSES = ["All", "Reported", "In progress", "Resolved"];

function priorityColor(score) {
  if (score >= 70) return "#dc4b4b";
  if (score >= 40) return "#ed9b37";
  return "#25866c";
}

function FitReports({ reports }) {
  const map = useMap();
  useEffect(() => {
    if (reports.length > 0) {
      const points = reports.map((report) => [report.latitude, report.longitude]);
      map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
    }
  }, [map, reports]);
  return null;
}

function ReportPopup({ report }) {
  const imageUrl = getUploadUrl(report.image_path);
  const createdDate = report.created_at ? new Date(report.created_at).toLocaleString() : "Date unavailable";

  return (
    <div className="w-[230px] overflow-hidden text-ink">
      {imageUrl ? (
        <img src={imageUrl} alt={`${report.category} report`} className="mb-2 h-28 w-full rounded-lg bg-paper object-cover" />
      ) : (
        <div className="mb-2 grid h-24 place-items-center rounded-lg bg-paper text-xs font-semibold text-slate-400">No photo available</div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold capitalize">{report.category}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Priority score <strong className="text-ink">{Number(report.priority_score || 0).toFixed(1)}</strong></p>
        </div>
        <span className="rounded-full bg-paper px-2 py-1 text-[10px] font-bold text-slate-600">{report.status}</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500">
        <span>{report.duplicate_count || 0} similar reports</span>
        <span>#{report.id}</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{createdDate}</p>
      {report.is_demo_data && <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-800">Demo data</span>}
    </div>
  );
}

function FilterChips({ label, options, value, onChange, format = (option) => option }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition ${value === option ? "border-forest bg-forest text-white" : "border-line bg-white text-slate-500 hover:border-forest/30 hover:text-forest"}`}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

export function MapPage() {
  const { show } = useIsland();
  const [reports, setReports] = useState([]);
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/reports");
      setReports(response.data);
    } catch (requestError) {
      const message = requestError.response ? "Could not load reports from the server." : "Could not connect to the API. Make sure the backend is running.";
      setError(message);
      show({ type: "error", message: "Map reports could not be loaded" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); }, []);

  const filteredReports = useMemo(() => reports.filter((report) => {
    const hasLocation = report.latitude != null && report.longitude != null;
    const categoryMatches = category === "All" || report.category === category;
    const statusMatches = status === "All" || report.status === status;
    return hasLocation && categoryMatches && statusMatches;
  }), [reports, category, status]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <PageHeading icon={MapPinned} eyebrow="Neighbourhood view" title="Issues on the map" detail="Explore reports near you. Select a pin to see its details." />
        <button type="button" onClick={loadReports} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-xs font-extrabold text-forest shadow-sm transition hover:border-forest/30 disabled:opacity-60">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{loading ? "Loading…" : "Refresh map"}
        </button>
      </div>

      <section className="mt-7 rounded-[28px] border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="space-y-3 border-b border-line pb-4">
          <FilterChips label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
          <FilterChips label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl">
          <MapContainer center={[12.9716, 77.5946]} zoom={12} className="large-map">
            <TileLayer attribution={TILE_ATTRIBUTION} url={MAP_TILES} />
            <FitReports reports={filteredReports} />
            {filteredReports.map((report) => {
              const color = priorityColor(Number(report.priority_score || 0));
              return (
                <CircleMarker
                  key={report.id}
                  center={[report.latitude, report.longitude]}
                  radius={10}
                  pathOptions={{ color: "#ffffff", weight: 3, fillColor: color, fillOpacity: 0.95 }}
                >
                  <Popup><ReportPopup report={report} /></Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
          {loading && <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950/35 backdrop-blur-[2px]" role="status" aria-label="Loading reports"><div className="glass-skeleton h-full w-full rounded-2xl" /><p className="absolute rounded-full border border-line bg-white px-4 py-2 text-xs font-bold text-ink shadow">Loading reports…</p></div>}
          {!loading && !error && filteredReports.length === 0 && <div className="absolute inset-x-4 top-4 z-[500] flex items-center gap-2 rounded-xl border border-line bg-white/95 px-3 py-2.5 text-xs font-semibold text-slate-500 shadow-sm"><CircleDot size={15} className="text-forest" />No located reports match these filters.</div>}
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold text-slate-500">Showing <strong className="text-ink">{filteredReports.length}</strong> of {reports.filter((report) => report.latitude != null && report.longitude != null).length} located reports</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full bg-paper px-3 py-2 text-[10px] font-bold text-slate-600">
            <span className="mr-1 uppercase tracking-wider text-slate-400">Priority</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#dc4b4b]" />High · 70+</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ed9b37]" />Medium · 40–69</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#25866c]" />Low · under 40</span>
          </div>
        </div>
        {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"><AlertCircle size={15} />{error}</div>}
      </section>
    </main>
  );
}

export function TrackPage() {
  const { show } = useIsland();
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function findReport(event) {
    event.preventDefault();
    setMessage("");
    setReport(null);
    setLoading(true);
    try {
      const response = await api.get(`/api/reports/${encodeURIComponent(reportId.trim())}`);
      setReport(response.data);
      show({ type: "success", message: `Report #${response.data.id} found` });
    } catch {
      const nextMessage = "We couldn’t find that report ID. Check the number and try again.";
      setMessage(nextMessage);
      show({ type: "error", message: "Report ID not found" });
    } finally {
      setLoading(false);
    }
  }

  const statusSteps = ["Reported", "In progress", "Resolved"];
  const currentStep = Math.max(statusSteps.indexOf(report?.status), 0);
  const beforePhoto = report?.image_path ? getUploadUrl(report.image_path) : null;
  const afterPhoto = report?.after_image_path ? getUploadUrl(report.after_image_path) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <PageHeading icon={Activity} eyebrow="Report follow-up" title="Track your report" detail="Enter the report ID you received after submitting." />
      <form onSubmit={findReport} className="mt-7 flex max-w-2xl gap-2 rounded-2xl border border-line bg-white p-2 shadow-card">
        <input value={reportId} onChange={(event) => setReportId(event.target.value)} required inputMode="numeric" aria-label="Report ID" placeholder="Enter report ID, e.g. 104" className="min-w-0 flex-1 rounded-xl px-3 text-sm outline-none" />
        <button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}{loading ? "Looking…" : "Track report"}</button>
      </form>
      {message && <p role="alert" className="mt-4 flex max-w-2xl items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={16} />{message}</p>}

      {loading && <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]" role="status" aria-label="Loading report details"><div className="glass-skeleton h-80 rounded-[28px]"/><div className="glass-skeleton h-80 rounded-[28px]"/></section>}

      {!loading && !report && !message && <div className="empty-state mt-7 max-w-2xl"><Search size={20}/><p>Enter a report ID to see its latest status and photos.</p></div>}

      {report && (
        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
          <section className="rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-5">
              <div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-forest/65">Report #{report.id}</p><h2 className="mt-1 text-xl font-black capitalize tracking-tight text-ink">{report.category} report</h2><p className="mt-1 text-xs text-slate-500">Submitted {report.created_at ? new Date(report.created_at).toLocaleString() : ""}</p></div>
              <span className="rounded-full bg-mint px-3 py-1.5 text-xs font-extrabold text-forest">{report.status}</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PhotoPanel title="Before photo" imageUrl={beforePhoto} emptyText="No before photo attached" />
              {report.status === "Resolved" && <PhotoPanel title="After photo" imageUrl={afterPhoto} emptyText="No after photo has been added" />}
            </div>
            {report.description && <div className="mt-5 rounded-2xl bg-paper p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Description</p><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{report.description}</p></div>}
          </section>

          <section className="rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-7">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-forest"><Clock3 size={18} /></span><div><h2 className="text-base font-extrabold text-ink">Report progress</h2><p className="text-xs text-slate-500">Status updates from the response team</p></div></div>
            <ol className="mt-6">
              {statusSteps.map((step, index) => {
                const completed = index < currentStep;
                const active = index === currentStep;
                return (
                  <li key={step} className="relative flex min-h-[76px] gap-3 last:min-h-0">
                    {index < statusSteps.length - 1 && <span className={`absolute left-[14px] top-8 h-[calc(100%-8px)] w-px ${completed ? "bg-forest" : "bg-slate-200"}`} />}
                    <span className={`relative z-10 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 ${completed || active ? "border-forest bg-forest text-white" : "border-slate-200 bg-white text-slate-300"}`}>{completed ? <Check size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span>
                    <span className="pt-1"><span className={`block text-sm font-extrabold ${completed || active ? "text-ink" : "text-slate-400"}`}>{step}</span><span className="mt-1 block text-[11px] text-slate-400">{active ? "Current status" : completed ? "Completed" : "Next step"}</span></span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}

function PhotoPanel({ title, imageUrl, emptyText }) {
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold text-ink">{title}</p>
      {imageUrl ? <img src={imageUrl} alt={title} className="h-48 w-full rounded-2xl bg-paper object-cover" /> : <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-line bg-paper px-3 text-center text-xs font-semibold text-slate-400">{emptyText}</div>}
    </div>
  );
}

export function AdminPage() {
  const { show } = useIsland();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editValues, setEditValues] = useState({});
  const [pendingResolutionId, setPendingResolutionId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const headers = { "X-Admin-Password": password };

  async function loadAdminData(secret = password) {
    setLoading(true);
    setError("");
    const authHeaders = { "X-Admin-Password": secret };
    try {
      const [statsResponse, reportsResponse] = await Promise.all([
        api.get("/api/admin/stats", { headers: authHeaders }),
        api.get("/api/reports"),
      ]);
      setStats(statsResponse.data);
      setReports(reportsResponse.data);
      setEditValues(Object.fromEntries(reportsResponse.data.map((report) => [report.id, {
        assigned_to: report.assigned_to || "",
        deadline: report.deadline ? report.deadline.slice(0, 10) : "",
      }])));
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setAuthenticated(false);
        setPassword("");
        setError("Admin password was rejected. Please sign in again.");
      } else {
        setError(requestError.response?.data?.detail || "Could not load the admin data. Check the backend and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setLoginBusy(true);
    setError("");
    try {
      await api.post("/api/admin/login", null, { headers });
      setAuthenticated(true);
      show({ type: "success", message: "Signed in to the admin dashboard" });
      await loadAdminData(password);
    } catch (requestError) {
      const message = requestError.response?.data?.detail || "Could not sign in. Check the password and backend connection.";
      setError(message);
      show({ type: "error", message: "Admin sign in failed" });
    } finally {
      setLoginBusy(false);
    }
  }

  function signOut() {
    setPassword("");
    setAuthenticated(false);
    setStats(null);
    setReports([]);
    setEditValues({});
    setError("");
  }

  const visibleReports = useMemo(() => reports.filter((report) =>
    (categoryFilter === "All" || report.category === categoryFilter)
    && (statusFilter === "All" || report.status === statusFilter),
  ), [reports, categoryFilter, statusFilter]);

  async function updateReport(reportId, changes) {
    setSavingId(reportId);
    setError("");
    try {
      const response = await api.patch(`/api/admin/reports/${reportId}`, changes, { headers });
      setReports((current) => current.map((report) => report.id === reportId ? { ...report, ...response.data } : report));
      setEditValues((current) => ({ ...current, [reportId]: {
        ...current[reportId],
        assigned_to: response.data.assigned_to || "",
        deadline: response.data.deadline ? response.data.deadline.slice(0, 10) : "",
      } }));
      const refreshedStats = await api.get("/api/admin/stats", { headers });
      setStats(refreshedStats.data);
      show({ type: "success", message: `Report #${reportId} updated` });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Could not save this report update.");
    } finally {
      setSavingId(null);
    }
  }

  async function uploadAfterPhoto(reportId, file, alsoResolve = false) {
    if (!file) return;
    setSavingId(reportId);
    setError("");
    let statusUpdated = false;
    try {
      if (alsoResolve) {
        await api.patch(`/api/admin/reports/${reportId}`, { status: "Resolved" }, { headers });
        statusUpdated = true;
      }
      const formData = new FormData();
      formData.append("image", file);
      const response = await api.post(`/api/admin/reports/${reportId}/after-photo`, formData, { headers });
      setReports((current) => current.map((report) => report.id === reportId ? {
        ...report,
        status: alsoResolve ? "Resolved" : report.status,
        after_image_path: response.data.after_image_path,
      } : report));
      setPendingResolutionId(null);
      const refreshedStats = await api.get("/api/admin/stats", { headers });
      setStats(refreshedStats.data);
      show({ type: "success", message: alsoResolve ? "Report resolved and after photo saved" : "After photo uploaded" });
    } catch (requestError) {
      if (statusUpdated) {
        setReports((current) => current.map((report) => report.id === reportId ? { ...report, status: "Resolved" } : report));
        setPendingResolutionId(null);
        try {
          const refreshedStats = await api.get("/api/admin/stats", { headers });
          setStats(refreshedStats.data);
        } catch {
          // Keep the current counters if the stats refresh also fails.
        }
      }
      setError(requestError.response?.data?.detail || (alsoResolve ? "Status may have changed, but the after photo could not be uploaded." : "Could not upload the after photo."));
    } finally {
      setSavingId(null);
    }
  }

  function onStatusChange(report, nextStatus) {
    if (nextStatus === "Resolved" && report.status !== "Resolved") {
      setPendingResolutionId(report.id);
      setError("");
      return;
    }
    updateReport(report.id, { status: nextStatus });
  }

  const statCards = stats ? [
    { label: "All reports", value: stats.total, icon: Users, tone: "bg-slate-100 text-slate-600" },
    { label: "High priority", value: stats.high_priority, icon: TriangleAlert, tone: "bg-rose-50 text-rose-600" },
    { label: "In progress", value: stats.in_progress, icon: RefreshCw, tone: "bg-amber-50 text-amber-700" },
    { label: "Resolved", value: stats.resolved, icon: ShieldCheck, tone: "bg-mint text-forest" },
    { label: "Reported", value: stats.counts_by_status?.Reported ?? 0, icon: CircleDot, tone: "bg-sky-50 text-sky-700" },
    { label: "Overdue", value: stats.overdue, icon: Clock3, tone: "bg-rose-50 text-rose-600" },
    { label: "Potholes", value: stats.counts_by_category?.pothole ?? 0, icon: MapPinned, tone: "bg-forest/10 text-forest" },
    { label: "Garbage", value: stats.counts_by_category?.garbage ?? 0, icon: ImagePlus, tone: "bg-amber-50 text-amber-700" },
  ] : [];

  const categoryData = stats ? Object.entries(stats.counts_by_category || {}).map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value: Number(value) || 0 })) : [];
  const statusData = stats ? ["Reported", "In progress", "Resolved"].map((name) => ({ name, reports: Number(stats.counts_by_status?.[name] || 0) })) : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><PageHeading icon={LockKeyhole} eyebrow="Civic operations" title="Admin dashboard" detail="Monitor reports and coordinate the response." />{authenticated && <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-xs font-extrabold text-slate-500 hover:text-rose-600"><LogOut size={14} />Sign out</button>}</div>

      {!authenticated ? (
        <form onSubmit={signIn} className="mt-7 max-w-xl rounded-[28px] border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-forest"><LockKeyhole size={20} /></div>
          <h2 className="mt-4 text-lg font-extrabold text-ink">Admin access</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">Enter the admin password configured in the backend. It stays in this page’s memory and is cleared when you sign out or refresh.</p>
          <label htmlFor="admin-password" className="mb-2 mt-5 block text-xs font-extrabold text-ink">Password</label>
          <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-forest/50 focus:ring-4 focus:ring-forest/5" />
          {error && <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700"><AlertCircle size={15} />{error}</p>}
          <button disabled={loginBusy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-extrabold text-white hover:bg-ink disabled:opacity-60">{loginBusy ? <RefreshCw size={15} className="animate-spin" /> : <LockKeyhole size={15} />}{loginBusy ? "Checking…" : "Continue to admin"}</button>
        </form>
      ) : (
        <>
          {error && <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertCircle size={16} />{error}</p>}
          {loading && !stats ? <section aria-label="Loading dashboard statistics" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{Array.from({ length: 8 }, (_, index) => <div key={index} className="glass-skeleton h-28 rounded-2xl" />)}</section> : <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {statCards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-line bg-white p-4 shadow-sm"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={17} /></span><p className="mt-4 text-2xl font-black tracking-tight text-ink">{loading ? "—" : value}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p></div>)}
          </section>}

          {stats && <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-6">
              <div><h2 className="text-base font-extrabold text-ink">Reports by category</h2><p className="mt-1 text-xs text-slate-500">Live category totals from the report database.</p></div>
              {categoryData.reduce((sum, item) => sum + item.value, 0) === 0 ? <div className="empty-state mt-4"><CircleDot size={20}/><p>No category data yet</p></div> : <div className="mt-3 flex flex-col items-center sm:flex-row">
                <div className="h-56 w-full min-w-0 sm:w-1/2" role="img" aria-label={`Donut chart of reports by category: ${categoryData.map((item) => `${item.name} ${item.value}`).join(", ")}`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={4} stroke="none">{categoryData.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: "#111A2D", border: "1px solid rgba(191,207,237,.18)", borderRadius: 12, color: "#F4F7FF" }} /></PieChart></ResponsiveContainer></div>
                <ul className="grid w-full gap-3 sm:w-1/2">{categoryData.map((item, index) => <li key={item.name} className="flex items-center justify-between rounded-xl bg-paper/60 px-3 py-2.5 text-xs"><span className="flex items-center gap-2 font-semibold text-slate-500"><i className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name}</span><strong className="text-ink">{item.value}</strong></li>)}</ul>
              </div>}
            </article>
            <article className="rounded-[28px] border border-line bg-white p-5 shadow-card sm:p-6">
              <div><h2 className="text-base font-extrabold text-ink">Reports by status</h2><p className="mt-1 text-xs text-slate-500">Current workflow distribution across all reports.</p></div>
              {statusData.reduce((sum, item) => sum + item.reports, 0) === 0 ? <div className="empty-state mt-4"><CircleDot size={20}/><p>No status data yet</p></div> : <div className="mt-4 h-60 w-full" role="img" aria-label={`Bar chart of reports by status: ${statusData.map((item) => `${item.name} ${item.reports}`).join(", ")}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(158,177,210,.12)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#94A1BA", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#94A1BA", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "rgba(79,140,255,.08)" }} contentStyle={{ background: "#111A2D", border: "1px solid rgba(191,207,237,.18)", borderRadius: 12, color: "#F4F7FF" }} /><Bar dataKey="reports" name="Reports" radius={[8, 8, 0, 0]}>{statusData.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>}
            </article>
          </section>}

          <section className="mt-6 overflow-hidden rounded-[28px] border border-line bg-white shadow-card">
            <div className="flex flex-col justify-between gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:px-6">
              <div><h2 className="text-base font-extrabold text-ink">Report queue</h2><p className="mt-1 text-xs text-slate-500">Sorted by highest priority first.</p></div>
              <div className="flex flex-wrap gap-2">
                <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-forest/40"><option>All</option><option value="pothole">Pothole</option><option value="garbage">Garbage</option></select>
                <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-forest/40"><option>All</option><option>Reported</option><option>In progress</option><option>Resolved</option></select>
                <button type="button" onClick={() => loadAdminData()} disabled={loading} title="Refresh admin data" className="grid h-9 w-9 place-items-center rounded-xl border border-line text-forest hover:bg-mint disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead><tr className="bg-paper/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Report</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assigned to</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">After photo</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {visibleReports.map((report) => {
                    const score = Number(report.priority_score || 0);
                    const deadlineDate = report.deadline ? new Date(`${report.deadline.replace(/Z$/, "")}Z`) : null;
                    const overdue = report.status !== "Resolved" && deadlineDate && deadlineDate < new Date();
                    const edits = editValues[report.id] || { assigned_to: "", deadline: "" };
                    const rowBusy = savingId === report.id;
                    return (
                      <tr key={report.id} className="align-top hover:bg-paper/50">
                        <td className="px-5 py-4"><div className="flex items-center gap-3">{report.image_path ? <img src={getUploadUrl(report.image_path)} alt="" className="h-11 w-12 rounded-lg bg-paper object-cover" /> : <span className="grid h-11 w-12 place-items-center rounded-lg bg-paper text-slate-400"><ImagePlus size={16} /></span>}<div><p className="text-xs font-extrabold capitalize text-ink">#{report.id} · {report.category}</p><p className="mt-1 max-w-[190px] truncate text-[10px] text-slate-400">{report.description || "No description"}</p>{report.is_demo_data && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">Demo data</span>}</div></div></td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${score >= 70 ? "bg-rose-50 text-rose-700" : score >= 40 ? "bg-amber-50 text-amber-800" : "bg-mint text-forest"}`}>{score.toFixed(1)}</span>{overdue && <span className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-[9px] font-extrabold text-white"><TriangleAlert size={11} />Overdue</span>}</td>
                        <td className="px-4 py-4"><select aria-label={`Status for report ${report.id}`} disabled={rowBusy} value={pendingResolutionId === report.id ? "Resolved" : report.status} onChange={(event) => onStatusChange(report, event.target.value)} className="rounded-lg border border-line bg-white px-2 py-2 text-xs font-bold text-slate-600 outline-none focus:border-forest/40 disabled:opacity-50"><option>Reported</option><option>In progress</option><option>Resolved</option></select>{pendingResolutionId === report.id && <div className="mt-2 w-48 rounded-xl border border-amber-100 bg-amber-50 p-2.5"><p className="mb-2 text-[10px] font-bold leading-relaxed text-amber-900">Add an after photo to mark resolved.</p><input type="file" accept="image/*" disabled={rowBusy} onChange={(event) => uploadAfterPhoto(report.id, event.target.files?.[0], true)} className="w-full text-[10px] text-amber-900 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-[10px] file:font-bold" /><button type="button" onClick={() => setPendingResolutionId(null)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800"><X size={12} />Cancel</button></div>}</td>
                        <td className="px-4 py-4"><input aria-label={`Assigned to for report ${report.id}`} value={edits.assigned_to} disabled={rowBusy} onChange={(event) => setEditValues((current) => ({ ...current, [report.id]: { ...edits, assigned_to: event.target.value } }))} onBlur={(event) => { const nextValue = event.target.value.trim() || null; if (nextValue !== (report.assigned_to || null)) updateReport(report.id, { assigned_to: nextValue }); }} placeholder="Team or person" className="w-36 rounded-lg border border-line px-2.5 py-2 text-xs outline-none focus:border-forest/40 disabled:opacity-50" /></td>
                        <td className="px-4 py-4"><div className="flex items-center gap-1.5"><CalendarDays size={13} className="text-slate-400" /><input aria-label={`Deadline for report ${report.id}`} type="date" value={edits.deadline} disabled={rowBusy} onChange={(event) => setEditValues((current) => ({ ...current, [report.id]: { ...edits, deadline: event.target.value } }))} onBlur={(event) => { const nextValue = event.target.value ? `${event.target.value}T23:59:59Z` : null; const existing = report.deadline ? report.deadline.slice(0, 10) : ""; if (event.target.value !== existing) updateReport(report.id, { deadline: nextValue }); }} className="w-[132px] rounded-lg border border-line px-2 py-2 text-[11px] text-slate-600 outline-none focus:border-forest/40 disabled:opacity-50" /></div></td>
                        <td className="px-4 py-4">{report.status === "Resolved" ? <div className="w-44">{report.after_image_path && <a href={getUploadUrl(report.after_image_path)} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold text-forest"><Check size={12} />View photo</a>}<label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-extrabold text-forest hover:underline"><Upload size={13} />{report.after_image_path ? "Replace after photo" : "Upload after photo"}<input type="file" accept="image/*" disabled={rowBusy} onChange={(event) => uploadAfterPhoto(report.id, event.target.files?.[0])} className="sr-only" /></label></div> : <span className="text-[10px] text-slate-300">Available when resolved</span>}</td>
                      </tr>
                    );
                  })}
                  {!loading && visibleReports.length === 0 && <tr><td colSpan="6" className="px-5 py-12"><div className="empty-state"><Search size={20}/><p>{reports.length ? "No reports match these filters." : "Your report queue is empty."}</p></div></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-5 py-3 text-[10px] font-semibold text-slate-400">{visibleReports.length} report{visibleReports.length === 1 ? "" : "s"} shown · changes save to the API as you edit</div>
          </section>
        </>
      )}
    </main>
  );
}

function PageHeading({ icon: Icon, eyebrow, title, detail }) {
  return <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-forest"><Icon size={14} />{eyebrow}</div><h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{detail}</p></div>;
}

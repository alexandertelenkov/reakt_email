import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Building2,
  Wallet,
  AlertTriangle,
  Search,
  RefreshCw,
  ClipboardList,
  LayoutDashboard,
  BookOpen,
  Activity,
  ShieldAlert,
  CheckCircle2,
  Zap,
  X,
  Download,
  Settings,
  History,
  Database,
  Sheet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";

/**
 * OPS DASH v4 — "Smart Import is the engine"
 *
 * Entry points:
 * 1) Bookings → Smart Import (paste from Google Sheets, tab-separated)
 * 2) Dashboard → RawData (paste accounts: email + password)
 */

const COLORS = {
  bg: "#0B0E14",
  card: "#151A23",
  primary: "#3B82F6",
  accent: "#6366F1",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#E2E8F0",
  textDim: "#94A3B8",
  border: "#1E293B",
  gold: "#FFD700",
  plat: "#60A5FA",
};

const REWARD_TYPES = ["Booking", "Copa", "AA", "CC"] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const safeLower = (s: any) => (s || "").trim().toLowerCase();

const parseDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

function addDaysISO(iso: string, days: number) {
  const d = parseDate(iso);
  if (!d || !Number.isFinite(days)) return "";
  const t = new Date(d.getTime() + days * 24 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

const daysDiff = (fromISO: string, toISO = todayISO()) => {
  const a = parseDate(fromISO);
  const b = parseDate(toISO);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const money = (n: any) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n || 0)
  );

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

function downloadCSV(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) return;
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const header = Object.keys(rows[0] || {}).join(",");
  const body = rows
    .map((r) => Object.keys(rows[0]).map((k) => esc(r[k])).join(","))
    .join("\n");
  const csv = header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stableHotelIdFromName(name: string) {
  const base = (name || "HOTEL")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18);
  let hash = 0;
  const s = name || "HOTEL";
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const tail = (hash.toString(16).toUpperCase() + "0000").slice(0, 4);
  return `H_${base}_${tail}`;
}

const KNOWN_STATUS = new Set(["pending", "confirmed", "completed", "cancelled"]);

function normalizeStatus(raw: any) {
  const s = safeLower(raw);
  if (!s) return "Pending";
  if (s.startsWith("conf")) return "Confirmed";
  if (s.startsWith("pend")) return "Pending";
  if (s.startsWith("comp")) return "Completed";
  if (s.startsWith("canc")) return "Cancelled";
  return "Pending";
}

function extractGeniusLevel(tailCells: string[]) {
  const cells = (tailCells || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (cells.length === 0) return "";

  // Try to lock onto the expected label, даже если рядом есть даты/мусор.
  const re = /genius\s*level\s*(1|2|3)/i;
  for (const c of cells) {
    const m = c.match(re);
    if (m) return `Genius Level ${m[1]}`;
  }
  const joined = cells.join(" ").trim();
  const mj = joined.match(re);
  if (mj) return `Genius Level ${mj[1]}`;

  // If it looks like a date, we don't want it pretending to be a level.
  if (/^\d{4}-\d{2}-\d{2}$/.test(joined)) return "";
  return joined;
}

function normalizeRewardType(raw: any) {
  const s = safeLower(raw);
  if (!s) return "Booking";
  if (s === "booking") return "Booking";
  if (s === "copa") return "Copa";
  if (s === "aa") return "AA";
  if (s === "cc") return "CC";
  return "Booking";
}

function parseMoney(raw: any) {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const cleaned = s.replaceAll(",", "").replaceAll("$", "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function isNumericLike(x: any) {
  const s = String(x ?? "").trim();
  if (!s) return false;
  const cleaned = s.replaceAll(",", "").replaceAll("$", "");
  return cleaned !== "" && !Number.isNaN(Number(cleaned));
}

function isISODateLike(x: any) {
  const s = String(x ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !!parseDate(s);
}

function computeRewardETA(b: any, settings: any) {
  const checkOut = String(b.checkOut || "").trim();
  if (!checkOut) return "";
  const type = normalizeRewardType(b.rewardType || "Booking");
  const days = type === "Booking" ? Number(settings.rewardDaysBooking || 14) : Number(settings.rewardDaysOther || 64);
  return addDaysISO(checkOut, days);
}

/**
 * Target paste columns (from Google Sheets), tab-separated:
 * Date | Email | BookingNo | PIN | HotelID | HotelName | Cost | CheckIn | CheckOut | (optional promo) | Reward | Status | Level | (optional Type) | (optional RewardPaidOn)
 *
 * Examples:
 * 2025-12-15    email@gmx.com    5051780387    6635        Hotel Name    6,066.89    2026-03-12    2026-03-13    120.00    confirmed    Genius Level 1
 * 2025-12-15    email@gmx.com    5051780387    6635        Hotel Name    6,066.89    2026-03-12    2026-03-13    120.00    confirmed    Genius Level 2    Copa    2026-05-20
 */
function parseBookingLine(line: string) {
  const raw = (line || "").trim();
  if (!raw) return null;
  const parts = raw.split("\t").map((x) => (x ?? "").trim());
  if (parts.length < 10) return null;

  let statusIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (KNOWN_STATUS.has(safeLower(parts[i]))) {
      statusIdx = i;
      break;
    }
  }
  if (statusIdx === -1) return null;

  const createdAt = parts[0] || "";
  const email = safeLower(parts[1] || "");
  const bookingNo = String(parts[2] || "");
  const pin = String(parts[3] || "");

  const hotelId = String(parts[4] || "");
  const hotelName = parts[5] || "";

  const cost = parseMoney(parts[6]);
  const checkIn = parts[7] || "";
  const checkOut = parts[8] || "";

  const between = parts.slice(9, statusIdx);
  let rewardAmount = 0;
  let promoCode = "";
  if (between.length >= 1) {
    const last = between[between.length - 1];
    if (isNumericLike(last)) rewardAmount = parseMoney(last);
    const first = between[0];
    if (between.length > 1 && !isNumericLike(first)) promoCode = first;
  }

  const status = normalizeStatus(parts[statusIdx] || "");

  // tail: Level + optional Type + optional RewardPaidOn (ISO date)
  const tail = parts.slice(statusIdx + 1).filter(Boolean);

  let rewardType: any = "Booking";
  let rewardPaidOn = "";

  // Extract type + paid date if present
  const tailRemainder: string[] = [];
  for (const tok of tail) {
    if (isISODateLike(tok)) {
      rewardPaidOn = tok;
      continue;
    }
    const t = normalizeRewardType(tok);
    if ((REWARD_TYPES as readonly string[]).includes(t) && safeLower(tok) === safeLower(t)) {
      rewardType = t;
      continue;
    }
    tailRemainder.push(tok);
  }

  // Level should be "Genius Level 1/2/3" (not a date). Prefer a clean extracted label.
  const level = extractGeniusLevel(tailRemainder);

  if (!createdAt || !email || !bookingNo) return null;

  return {
    createdAt,
    email,
    bookingNo,
    pin,
    hotelId,
    hotelName,
    cost,
    checkIn,
    checkOut,
    promoCode,
    rewardAmount,
    status,
    level,
    rewardType,
    rewardPaidOn,
    note: "",
    _raw: raw,
  };
}

function parsePaste(text: string) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: any[] = [];
  const errors: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const row = parseBookingLine(lines[i]);
    if (row) parsed.push(row);
    else errors.push({ line: i + 1, raw: lines[i] });
  }
  return { parsed, errors };
}

function tsvRow(email: string, password: string) {
  return `${email}\t${password ?? ""}`;
}

function accountsToTSV(rows: Array<{ email: string; password?: string }>) {
  return rows.map((a) => tsvRow(a.email, a.password || "")).join("\n");
}

function parseAccountsPaste(text: string) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: Array<{ email: string; password: string }> = [];
  const errors: Array<{ line: number; raw: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Prefer tabs (Google Sheets). Fallback to comma/semicolon.
    const parts =
      raw.includes("\t")
        ? raw.split("\t")
        : raw.includes(";")
        ? raw.split(";")
        : raw.includes(",")
        ? raw.split(",")
        : raw.split(/\s+/);

    const email = safeLower(parts[0] || "");
    const password = String(parts[1] ?? "").trim();
    if (!email || !email.includes("@")) {
      errors.push({ line: i + 1, raw });
      continue;
    }
    rows.push({ email, password });
  }

  return { rows, errors };
}

// ----------------------- seed -----------------------
const SEED: any = {
  settings: {
    goldThreshold: 300,
    platinumAfterDays: 40,
    cooldownDays: 20,
    maxActiveBookings: 3,
    techBlockConsecutive: 3,
    techBlockTotal: 3,
    hotelTechBlockTotal: 3,
    rewardDaysBooking: 14,
    rewardDaysOther: 64,
    autoCreateFromImport: true,
    autoWriteTechBlocks: true,
  },
  database: [
    { email: "demo1@mail.com", password: "pass-demo-1", manualStatus: "Активен", notes: "" },
    { email: "demo2@mail.com", password: "pass-demo-2", manualStatus: "Активен", notes: "" },
  ],
  hotels: [{ hotelId: "74", name: "The Bower Coronado", manualStatus: "OK", notes: "" }],
  bookings: [],
  sales: [],
  audit: [],
  lastImport: null,
  lastRawImport: null,
};

// ----------------------- derive model -----------------------
function deriveModel(state: any) {
  const { database, hotels, bookings, sales, settings } = state;

  const bookingsByEmail = new Map<string, any[]>();
  for (const b of bookings) {
    const key = safeLower(b.email);
    if (!bookingsByEmail.has(key)) bookingsByEmail.set(key, []);
    bookingsByEmail.get(key)!.push(b);
  }
  for (const [, list] of bookingsByEmail.entries()) {
    list.sort(
      (x, y) =>
        (parseDate(y.createdAt)?.getTime() || 0) -
        (parseDate(x.createdAt)?.getTime() || 0)
    );
  }

  const salesByEmail = new Map<string, any[]>();
  for (const s of sales) {
    const key = safeLower(s.email);
    if (!salesByEmail.has(key)) salesByEmail.set(key, []);
    salesByEmail.get(key)!.push(s);
  }

  // Hotel stats
  const hotelStats = new Map<string, { total: number; confirmed: number; cancelled: number }>();
  for (const b of bookings) {
    const id = b.hotelId || "";
    if (!id) continue;
    if (!hotelStats.has(id)) hotelStats.set(id, { total: 0, confirmed: 0, cancelled: 0 });
    const st = hotelStats.get(id)!;
    st.total += 1;
    if (b.status === "Confirmed") st.confirmed += 1;
    if (b.status === "Cancelled") st.cancelled += 1;
  }

  const derivedHotels = hotels.map((h: any) => {
    const st = hotelStats.get(h.hotelId) || { total: 0, confirmed: 0, cancelled: 0 };
    const techBlocked = st.cancelled >= settings.hotelTechBlockTotal;
    const manualBlocked = h.manualStatus === "BLOCK";
    const isBlocked = manualBlocked || techBlocked;
    return {
      ...h,
      totalBookings: st.total,
      confirmed: st.confirmed,
      cancelled: st.cancelled,
      techBlocked,
      manualBlocked,
      isBlocked,
      blockReason: manualBlocked
        ? "MANUAL"
        : techBlocked
        ? `TECH: hotel cancelled>=${settings.hotelTechBlockTotal}`
        : "",
    };
  });

  const derivedAccounts = database.map((row: any) => {
    const emailKey = safeLower(row.email);
    const accBookings = bookingsByEmail.get(emailKey) || [];
    const accSales = salesByEmail.get(emailKey) || [];

    const totalBookings = accBookings.length;
    const confirmedBookings = accBookings.filter((b) => b.status === "Confirmed").length;
    const cancelledBookings = accBookings.filter((b) => b.status === "Cancelled").length;
    const positiveBookings = accBookings.filter((b) => b.status !== "Cancelled").length;

    const bonusEvents = accBookings.filter(
      (b) =>
        ((b.status === "Completed" && Number(b.rewardAmount || 0) > 0) ||
          (b.rewardPaidOn && Number(b.rewardAmount || 0) > 0)) &&
        !b._void
    );

    const totalBonuses = bonusEvents.reduce((sum, b) => sum + Number(b.rewardAmount || 0), 0);
    const totalSales = accSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const netBalance = totalBonuses - totalSales;

    const lastBookingAt = accBookings[0]?.createdAt || "";
    const daysSinceLastBooking = lastBookingAt ? daysDiff(lastBookingAt) : null;
    const cooldownOk = lastBookingAt
      ? daysSinceLastBooking !== null && daysSinceLastBooking >= settings.cooldownDays
      : true;

    const activeBookingsCount = accBookings.filter(
      (b) => b.status === "Pending" || b.status === "Confirmed"
    ).length;

    const totalCancelled = cancelledBookings;
    let consecutiveCancelled = 0;
    for (const b of accBookings) {
      if (b.status === "Cancelled") consecutiveCancelled += 1;
      else break;
    }

    const techBlocked =
      totalCancelled >= settings.techBlockTotal ||
      consecutiveCancelled >= settings.techBlockConsecutive;

    const manualBlocked = row.manualStatus === "Блок";
    const isBlocked = manualBlocked || techBlocked;

    let lastBonusPaidOn = "";
    if (bonusEvents.length > 0) {
      lastBonusPaidOn = bonusEvents
        .map((b) => b.rewardPaidOn || b.createdAt)
        .filter(Boolean)
        .sort((a, b) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))[0];
    }
    const daysSinceLastBonus = lastBonusPaidOn ? daysDiff(lastBonusPaidOn) : null;

    let tier = "Standard";
    if (netBalance >= settings.goldThreshold && !isBlocked) {
      tier = "Gold";
      if (daysSinceLastBonus !== null && daysSinceLastBonus > settings.platinumAfterDays)
        tier = "Platinum";
    }

    const canAddBooking =
      !isBlocked && activeBookingsCount < settings.maxActiveBookings && cooldownOk;

    const blockReason = manualBlocked
      ? "MANUAL"
      : techBlocked
      ? `TECH: cancelled (total=${totalCancelled}, streak=${consecutiveCancelled})`
      : "";

    const progressToGold = Math.max(0, Math.min(1, netBalance / settings.goldThreshold));

    return {
      ...row,
      emailKey,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      positiveBookings,
      totalBonuses,
      totalSales,
      netBalance,
      progressToGold,
      activeBookingsCount,
      lastBookingAt,
      daysSinceLastBooking,
      cooldownOk,
      totalCancelled,
      consecutiveCancelled,
      techBlocked,
      manualBlocked,
      isBlocked,
      blockReason,
      tier,
      lastBonusPaidOn,
      daysSinceLastBonus,
      canAddBooking,
    };
  });

  const accountsReady = derivedAccounts
    .filter((a: any) => a.canAddBooking)
    .sort((a: any, b: any) => (b.netBalance || 0) - (a.netBalance || 0));

  const hotelsEligible = derivedHotels
    .filter((h: any) => !h.isBlocked && h.cancelled <= 2 && (h.confirmed || 0) > 0)
    .sort((a: any, b: any) => (b.confirmed || 0) - (a.confirmed || 0));

  const premium = derivedAccounts.filter((a: any) => a.tier === "Gold" || a.tier === "Platinum");

  const topHotels = [...derivedHotels]
    .sort((a: any, b: any) => b.totalBookings - a.totalBookings)
    .slice(0, 10);

  const topAccounts = [...derivedAccounts]
    .sort((a: any, b: any) => b.totalBookings - a.totalBookings)
    .slice(0, 10);

  const statusCounts: any = { Pending: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
  for (const b of bookings) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;

  return {
    derivedAccounts,
    derivedHotels,
    accountsReady,
    hotelsEligible,
    premium,
    topHotels,
    topAccounts,
    statusCounts,
  };
}

// ----------------------- self-tests (no deps) -----------------------
function runSelfTestsOnce() {
  try {
    const w: any = typeof window !== "undefined" ? window : null;
    if (!w) return;
    if (w.__OPS_DASH_TESTS_RAN__) return;
    w.__OPS_DASH_TESTS_RAN__ = true;

    const line =
      "2025-12-15\ta@b.com\t5051780387\t6635\t\tHyatt Regency JFK Airport\t6,066.89\t2026-03-12\t2026-03-13\t120.00\tconfirmed\tGenius Level 1";
    const b: any = parseBookingLine(line);
    console.assert(!!b, "parseBookingLine should parse a valid line");
    console.assert(b.email === "a@b.com", "email should be normalized to lower");
    console.assert(b.status === "Confirmed", "status should be normalized");
    console.assert(b.rewardAmount === 120, "rewardAmount should parse numeric");
    console.assert(b.cost === 6066.89, "cost should parse with commas");
    console.assert(b.level === "Genius Level 1", "level should be preserved");
    console.assert(b.rewardType === "Booking", "default type should be Booking");

    const line2 =
      "2025-12-15\ta@b.com\t999\t0000\t74\tHotel\t100\t2026-03-12\t2026-03-13\t80\tcancelled\tGenius Level 2\tCopa\t2026-05-20";
    const b2: any = parseBookingLine(line2);
    console.assert(b2.rewardType === "Copa", "type should parse from tail");
    console.assert(b2.rewardPaidOn === "2026-05-20", "rewardPaidOn should parse ISO date");
    console.assert(b2.level === "Genius Level 2", "level should not get polluted by date/type");

    console.assert(
      computeRewardETA({ checkOut: "2026-01-01", rewardType: "Booking" }, { rewardDaysBooking: 14, rewardDaysOther: 64 }) === "2026-01-15",
      "ETA should be checkout+14 for Booking"
    );
    console.assert(
      computeRewardETA({ checkOut: "2026-01-01", rewardType: "AA" }, { rewardDaysBooking: 14, rewardDaysOther: 64 }) === "2026-03-06",
      "ETA should be checkout+64 for non-Booking"
    );

    const bad = parseBookingLine("not\ta\tvalid");
    console.assert(bad === null, "invalid line should return null");

    const paste = `${line}\n${line}`;
    const p = parsePaste(paste);
    console.assert(p.parsed.length === 2, "parsePaste should parse 2 lines");

    const tsv = accountsToTSV([
      { email: "x@y.com", password: "p1" },
      { email: "z@y.com", password: "" },
    ]);
    console.assert(
      tsv === "x@y.com\tp1\nz@y.com\t",
      "accountsToTSV should join with \\n and include tab"
    );

    const ar = parseAccountsPaste("user@x.com\tpass\nbadline\nu2@x.com\t");
    console.assert(ar.rows.length === 2 && ar.errors.length === 1, "parseAccountsPaste should parse rows + errors");
  } catch {
    // no-throw by design
  }
}

if (typeof window !== "undefined") {
  setTimeout(runSelfTestsOnce, 0);
}

// ----------------------- UI bits -----------------------
const Badge = ({ kind, children }: any) => {
  const map: any = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    block: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    tech: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gold: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    plat: "bg-blue-400/10 text-blue-300 border-blue-400/20",
    dim: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
        map[kind] || map.dim
      }`}
    >
      {children}
    </span>
  );
};

const StatCard = ({ title, value, subValue, icon: Icon, onClick }: any) => (
  <div
    onClick={onClick}
    className="relative overflow-hidden p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm transition-all cursor-pointer hover:border-slate-700"
  >
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Icon size={64} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 rounded-lg bg-white/5 border border-slate-700">
        <Icon size={18} />
      </div>
      <span className="text-slate-400 text-sm font-medium">{title}</span>
    </div>
    <div className="flex items-end gap-3">
      <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
      {subValue && <span className="text-xs text-slate-500 mb-1">{subValue}</span>}
    </div>
  </div>
);

function Modal({ open, title, onClose, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(980px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-[#0B0E14] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="text-white font-bold">{title}</div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800">
            <X size={18} className="text-slate-400" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Toasts({ toasts, onDismiss }: any) {
  return (
    <div className="fixed right-6 bottom-6 z-50 space-y-2">
      {toasts.map((t: any) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl border shadow-lg backdrop-blur bg-slate-900/70 ${
            t.kind === "ok"
              ? "border-emerald-500/30"
              : t.kind === "warn"
              ? "border-amber-500/30"
              : "border-rose-500/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {t.kind === "ok" ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : t.kind === "warn" ? (
                <AlertTriangle size={16} className="text-amber-400" />
              ) : (
                <ShieldAlert size={16} className="text-rose-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{t.title}</div>
              {t.msg && <div className="text-xs text-slate-400 mt-1">{t.msg}</div>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------- App -----------------------
export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  // Next Action UX: table mode + multi-select copy
  const [nextActionMode, setNextActionMode] = useState<"table" | "list">("table");
  const [readySelected, setReadySelected] = useState<Record<string, boolean>>(() => ({}));
  const clearReadySelected = () => setReadySelected({});

  // RawData: show only emails without passwords
  const [rawOnlyMissing, setRawOnlyMissing] = useState(false);

  // Bookings filters
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("ALL");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>("ALL");
  const [bookingMissingPaidFilter, setBookingMissingPaidFilter] = useState(false);

  // Database filter
  const [dbOnlyMissing, setDbOnlyMissing] = useState(false);

  const [toasts, setToasts] = useState<any[]>([]);
  const pushToast = (kind: "ok" | "warn" | "err", title: string, msg = "") => {
    const id = uid();
    setToasts((p) => [...p, { id, kind, title, msg }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3200);
  };

  const [state, setState] = useState<any>(() => {
    try {
      const raw = localStorage.getItem("ops_dash_v4_state");
      if (raw) return JSON.parse(raw);
    } catch {}
    return SEED;
  });

  useEffect(() => {
    try {
      localStorage.setItem("ops_dash_v4_state", JSON.stringify(state));
    } catch {}
  }, [state]);

  const model = useMemo(() => deriveModel(state), [state]);

  // Auto-write TECH blocks back into manual status
  useEffect(() => {
    if (!state.settings.autoWriteTechBlocks) return;

    const techAcc = model.derivedAccounts.filter((a: any) => a.techBlocked && a.manualStatus !== "Блок");
    const techHotels = model.derivedHotels.filter((h: any) => h.techBlocked && h.manualStatus !== "BLOCK");

    if (techAcc.length === 0 && techHotels.length === 0) return;

    setState((prev: any) => {
      const next = { ...prev, database: [...prev.database], hotels: [...prev.hotels], audit: [...(prev.audit || [])] };

      const now = new Date().toISOString();
      for (const a of techAcc) {
        const idx = next.database.findIndex((x: any) => safeLower(x.email) === a.emailKey);
        if (idx >= 0) {
          next.database[idx] = {
            ...next.database[idx],
            manualStatus: "Блок",
            notes: ((next.database[idx].notes || "") + " TECH_BLOCK").trim(),
          };
          next.audit.push({ id: uid(), at: now, type: "AUTO_BLOCK_ACCOUNT", msg: `TECH block → manual Блок: ${a.email}` });
        }
      }
      for (const h of techHotels) {
        const idx = next.hotels.findIndex((x: any) => x.hotelId === h.hotelId);
        if (idx >= 0) {
          next.hotels[idx] = {
            ...next.hotels[idx],
            manualStatus: "BLOCK",
            notes: ((next.hotels[idx].notes || "") + " TECH_BLOCK").trim(),
          };
          next.audit.push({ id: uid(), at: now, type: "AUTO_BLOCK_HOTEL", msg: `TECH block → manual BLOCK: ${h.hotelId} ${h.name}` });
        }
      }

      next.audit = next.audit.slice(-400);
      return next;
    });
  }, [model.derivedAccounts, model.derivedHotels, state.settings.autoWriteTechBlocks]);

  const totals = useMemo(() => {
    const totalNet = model.derivedAccounts.reduce((s: number, a: any) => s + Number(a.netBalance || 0), 0);
    const totalBookings = state.bookings.length;
    const status = model.statusCounts;
    const blocked = model.derivedAccounts.filter((a: any) => a.isBlocked).length;
    const missingPasswords = model.derivedAccounts.filter((a: any) => !String(a.password || "").trim()).length;
    return { totalNet, totalBookings, status, blocked, missingPasswords };
  }, [model, state.bookings.length]);

  const netTrend = useMemo(() => {
    const days = 30;
    const end = parseDate(todayISO())!;
    const map = new Map<string, { date: string; net: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, net: 0 });
    }
    for (const b of state.bookings) {
      const key = (b.rewardPaidOn || b.createdAt || "").slice(0, 10);
      if (map.has(key) && (b.status === "Completed" || b.rewardPaidOn) && Number(b.rewardAmount || 0) > 0) {
        map.get(key)!.net += Number(b.rewardAmount || 0);
      }
    }
    for (const s of state.sales) {
      const key = (s.date || "").slice(0, 10);
      if (map.has(key)) map.get(key)!.net -= Number(s.amount || 0);
    }
    return Array.from(map.values());
  }, [state.bookings, state.sales]);

  // --------- MUTATIONS ----------
  const setSettings = (patch: any) => setState((prev: any) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  const upsertDatabaseRow = (email: string, patch: any) => {
    setState((prev: any) => {
      const next = { ...prev, database: [...prev.database] };
      const key = safeLower(email);
      const idx = next.database.findIndex((x: any) => safeLower(x.email) === key);
      if (idx >= 0) next.database[idx] = { ...next.database[idx], ...patch };
      return next;
    });
  };

  const removeDatabaseRow = (email: string) =>
    setState((prev: any) => ({
      ...prev,
      database: prev.database.filter((x: any) => safeLower(x.email) !== safeLower(email)),
      bookings: prev.bookings.filter((b: any) => safeLower(b.email) !== safeLower(email)),
      sales: prev.sales.filter((s: any) => safeLower(s.email) !== safeLower(email)),
    }));

  // --------- THE ENGINE: Smart Import ingestion ----------
  const ingestFromPaste = (text: string) => {
    let summary: any = null;

    setState((prev: any) => {
      const { parsed, errors } = parsePaste(text);
      const now = new Date().toISOString();

      const next = {
        ...prev,
        database: [...prev.database],
        hotels: [...prev.hotels],
        bookings: [...prev.bookings],
        audit: [...(prev.audit || [])],
      };

      const dbEmails = new Set(next.database.map((a: any) => safeLower(a.email)));
      const hotelById = new Map(next.hotels.map((h: any) => [String(h.hotelId), h]));
      const hotelIdByName = new Map(next.hotels.map((h: any) => [safeLower(h.name), String(h.hotelId)]));

      const existingBookingKeys = new Set(next.bookings.map((b: any) => `${safeLower(b.email)}::${String(b.bookingNo)}`));

      let added = 0;
      let dupSkipped = 0;
      let accCreated = 0;
      let hotelCreated = 0;

      for (const row of parsed) {
        const bookingKey = `${safeLower(row.email)}::${String(row.bookingNo)}`;
        if (existingBookingKeys.has(bookingKey)) {
          dupSkipped += 1;
          next.audit.push({ id: uid(), at: now, type: "DUP_SKIP", msg: `Duplicate booking skipped: ${row.email} / ${row.bookingNo}` });
          continue;
        }

        // ensure account exists
        if (!dbEmails.has(safeLower(row.email))) {
          if (prev.settings.autoCreateFromImport) {
            next.database.push({ email: row.email, password: "", manualStatus: "Активен", notes: "AUTO_CREATED_FROM_IMPORT" });
            dbEmails.add(safeLower(row.email));
            accCreated += 1;
            next.audit.push({ id: uid(), at: now, type: "ACCOUNT_CREATE", msg: `Account auto-created: ${row.email}` });
          }
        }

        // resolve/create hotel
        let hid = (row.hotelId || "").trim();
        const hname = (row.hotelName || "").trim();

        if (!hid) {
          const match = hotelIdByName.get(safeLower(hname));
          if (match) hid = match;
        }

        if (hid) {
          if (!hotelById.has(hid)) {
            if (prev.settings.autoCreateFromImport) {
              const nh = { hotelId: hid, name: hname || hid, manualStatus: "OK", notes: "AUTO_CREATED_FROM_IMPORT" };
              next.hotels.push(nh);
              hotelById.set(hid, nh);
              hotelIdByName.set(safeLower(nh.name), hid);
              hotelCreated += 1;
              next.audit.push({ id: uid(), at: now, type: "HOTEL_CREATE", msg: `Hotel auto-created: ${hid} — ${nh.name}` });
            }
          } else {
            const existing = hotelById.get(hid);
            if (existing && (!existing.name || existing.name.trim() === "") && hname) {
              existing.name = hname;
              hotelIdByName.set(safeLower(hname), hid);
              next.audit.push({ id: uid(), at: now, type: "HOTEL_UPDATE", msg: `Hotel name updated: ${hid} — ${hname}` });
            }
          }
        } else {
          // no hid, generate stable from name
          if (prev.settings.autoCreateFromImport) {
            hid = stableHotelIdFromName(hname);
            if (!hotelById.has(hid)) {
              const nh = { hotelId: hid, name: hname || hid, manualStatus: "OK", notes: "AUTO_CREATED_FROM_IMPORT" };
              next.hotels.push(nh);
              hotelById.set(hid, nh);
              hotelIdByName.set(safeLower(nh.name), hid);
              hotelCreated += 1;
              next.audit.push({ id: uid(), at: now, type: "HOTEL_CREATE", msg: `Hotel auto-created: ${hid} — ${nh.name}` });
            }
          }
        }

        // add booking
        next.bookings.push({
          bookingId: uid(),
          createdAt: row.createdAt,
          email: row.email,
          bookingNo: row.bookingNo,
          pin: row.pin,
          hotelId: hid || row.hotelId || "",
          hotelNameSnapshot: hname || hid || "",
          cost: row.cost,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          promoCode: row.promoCode || "",
          rewardAmount: row.rewardAmount || 0,
          rewardType: row.rewardType || "Booking",
          rewardPaidOn: row.rewardPaidOn || "",
          status: row.status,
          level: row.level || "",
          note: row.note || "",
          _raw: row._raw || "",
        });

        existingBookingKeys.add(bookingKey);
        added += 1;
        next.audit.push({ id: uid(), at: now, type: "BOOKING_ADD", msg: `Booking added: ${row.email} / ${row.bookingNo} / ${row.status}` });
      }

      // errors log
      for (const e of errors) {
        next.audit.push({ id: uid(), at: now, type: "PARSE_ERROR", msg: `Parse error line ${e.line}: ${e.raw}` });
      }

      next.audit = next.audit.slice(-400);

      summary = {
        at: now,
        added,
        dupSkipped,
        accCreated,
        hotelCreated,
        errors: errors.length,
        parsed: parsed.length,
      };

      next.lastImport = summary;
      return next;
    });

    if (summary) {
      if (summary.parsed === 0) {
        pushToast("warn", "Import: nothing parsed", "Проверь, что вставляешь табами (из Google Sheets).");
      } else {
        const msg = `Added ${summary.added}. New accounts ${summary.accCreated}. New hotels ${summary.hotelCreated}. Dup ${summary.dupSkipped}. Errors ${summary.errors}.`;
        pushToast(summary.errors > 0 ? "warn" : "ok", "Smart Import ingested", msg);
      }
    }
  };

  const ingestRawAccounts = (text: string) => {
    let summary: any = null;

    setState((prev: any) => {
      const { rows, errors } = parseAccountsPaste(text);
      const now = new Date().toISOString();

      const next = { ...prev, database: [...prev.database], audit: [...(prev.audit || [])] };
      const byEmail = new Map(next.database.map((a: any) => [safeLower(a.email), a]));

      let updated = 0;
      let created = 0;

      for (const r of rows) {
        const key = safeLower(r.email);
        const existing = byEmail.get(key);
        if (existing) {
          if (String(existing.password || "").trim() !== String(r.password || "").trim()) {
            existing.password = r.password;
            updated += 1;
            next.audit.push({ id: uid(), at: now, type: "RAW_UPDATE", msg: `Password updated: ${r.email}` });
          }
        } else {
          const a = { email: r.email, password: r.password || "", manualStatus: "Активен", notes: "RAW_DATA_IMPORT" };
          next.database.push(a);
          byEmail.set(key, a);
          created += 1;
          next.audit.push({ id: uid(), at: now, type: "RAW_CREATE", msg: `Account created from RawData: ${r.email}` });
        }
      }

      for (const e of errors) {
        next.audit.push({ id: uid(), at: now, type: "RAW_PARSE_ERROR", msg: `RawData parse error line ${e.line}: ${e.raw}` });
      }

      next.audit = next.audit.slice(-400);

      summary = { at: now, rows: rows.length, updated, created, errors: errors.length };
      next.lastRawImport = summary;

      return next;
    });

    if (summary) {
      if (summary.rows === 0) pushToast("warn", "RawData: nothing parsed", "Формат: email<TAB>password");
      else pushToast(summary.errors ? "warn" : "ok", "RawData ingested", `Rows ${summary.rows}. Updated ${summary.updated}. Created ${summary.created}. Errors ${summary.errors}.`);
    }
  };

  // --------- Views ----------
  const OverviewView = () => {
    const statusData = [
      { name: "Pending", value: model.statusCounts.Pending || 0, fill: "#64748B" },
      { name: "Confirmed", value: model.statusCounts.Confirmed || 0, fill: COLORS.success },
      { name: "Completed", value: model.statusCounts.Completed || 0, fill: COLORS.gold },
      { name: "Cancelled", value: model.statusCounts.Cancelled || 0, fill: COLORS.danger },
    ];

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <StatCard title="Total Net Balance" value={money(totals.totalNet)} subValue="Bonuses − Sales" icon={Wallet} />
          <StatCard title="Total Bookings" value={totals.totalBookings} subValue="All statuses" icon={BookOpen} onClick={() => setActiveTab("bookings")} />
          <StatCard title="Accounts Ready" value={model.accountsReady.length} subValue="Passed all rules" icon={Zap} onClick={() => setActiveTab("next_action")} />
          <StatCard title="Missing Passwords" value={totals.missingPasswords} subValue="Needs RawData" icon={Database} onClick={() => setActiveTab("rawdata")} />
          <StatCard title="Blocked Accounts" value={totals.blocked} subValue="Manual + TECH" icon={ShieldAlert} onClick={() => setActiveTab("database")} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-[#151A23] border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg text-white mb-4">Net Trend (30d)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748B" axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} />
                  <Area type="monotone" dataKey="net" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#151A23] border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg text-white mb-4">Booking Status Mix</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} stroke="none">
                    {statusData.map((x: any, i: number) => (
                      <Cell key={i} fill={x.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-[#151A23] border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg text-white mb-4">Top Hotels (by bookings)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.topHotels.map((h: any) => ({ name: (h.name || h.hotelId).slice(0, 18), value: h.totalBookings }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748B" axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#151A23] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">Top Accounts (by bookings)</h3>
              <button
                onClick={() => setAuditOpen(true)}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
              >
                <History size={16} /> Audit
              </button>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.topAccounts.map((a: any) => ({ name: a.email.slice(0, 18), value: a.totalBookings }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748B" axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DatabaseView = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Database (Accounts)</h2>
          <p className="text-xs text-slate-500">
            Passwords приходят из <b>RawData</b>. Ручной статус <b>Блок</b> — global kill-switch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            <input type="checkbox" checked={dbOnlyMissing} onChange={(e) => setDbOnlyMissing((e.target as HTMLInputElement).checked)} />
            only emails without passwords
          </label>
          <button
            onClick={() => downloadCSV("database.csv", state.database)}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-[#151A23] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-[#0B0E14] text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Password</th>
                <th className="px-6 py-4">Manual Status</th>
                <th className="px-6 py-4">Metrics</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {model.derivedAccounts
                .filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true))
                .filter((a: any) => (dbOnlyMissing ? !String(a.password || "").trim() : true))
                .map((a: any) => {
                  const missing = !String(a.password || "").trim();
                  return (
                    <tr key={a.emailKey} className={`hover:bg-slate-800/40 ${missing ? "bg-rose-500/5" : ""}`}>
                      <td className="px-6 py-4 align-top">
                        <div className="text-white font-bold">{a.email}</div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => copyToClipboard(a.email)} className="text-xs text-blue-400 hover:text-blue-300">Copy Email</button>
                          <button onClick={() => copyToClipboard(a.password || "")} className="text-xs text-blue-400 hover:text-blue-300">Copy Pass</button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!a.isBlocked ? <Badge kind="active">ACTIVE</Badge> : <Badge kind="block">BLOCK</Badge>}
                          {a.techBlocked && <Badge kind="tech">TECH</Badge>}
                          {a.tier === "Gold" && <Badge kind="gold">GOLD</Badge>}
                          {a.tier === "Platinum" && <Badge kind="plat">PLAT</Badge>}
                          {a.canAddBooking ? <Badge kind="active">READY</Badge> : <Badge kind="dim">NOT READY</Badge>}
                          {missing && <Badge kind="block">NO PASS</Badge>}
                        </div>
                        {a.blockReason && <div className="mt-2 text-xs text-rose-300">{a.blockReason}</div>}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <input
                          className={`bg-[#0B0E14] border rounded px-2 py-1 text-slate-200 w-full text-xs font-mono ${
                            missing ? "border-rose-500/40" : "border-slate-700"
                          }`}
                          value={a.password || ""}
                          onChange={(e) => upsertDatabaseRow(a.email, { password: e.target.value })}
                          placeholder="password"
                        />
                        {missing && <div className="mt-2 text-xs text-rose-300">Password not found → add in RawData</div>}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <select
                          className="bg-[#0B0E14] border border-slate-700 rounded px-2 py-1 text-white text-xs w-full"
                          value={a.manualStatus}
                          onChange={(e) => upsertDatabaseRow(a.email, { manualStatus: e.target.value })}
                        >
                          <option value="Активен">Активен</option>
                          <option value="Блок">Блок</option>
                        </select>
                      </td>

                      <td className="px-6 py-4 align-top text-xs text-slate-300">
                        <div className="flex justify-between"><span className="text-slate-500">Bookings</span><span className="font-bold">{a.totalBookings}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Confirmed</span><span>{a.confirmedBookings}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Cancelled</span><span>{a.cancelledBookings}</span></div>
                        <div className="flex justify-between mt-2"><span className="text-slate-500">Balance</span><span className="font-mono">{money(a.netBalance)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Active</span><span>{a.activeBookingsCount}/{state.settings.maxActiveBookings}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Cooldown</span><span>{a.cooldownOk ? "OK" : `${a.daysSinceLastBooking ?? "?"}d`}</span></div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <input
                          className="bg-[#0B0E14] border border-slate-700 rounded px-2 py-1 text-slate-200 w-full text-xs"
                          value={a.notes || ""}
                          onChange={(e) => upsertDatabaseRow(a.email, { notes: e.target.value })}
                          placeholder="notes"
                        />
                      </td>

                      <td className="px-6 py-4 align-top text-right">
                        <button
                          onClick={() => removeDatabaseRow(a.email)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-bold border border-rose-900/50 bg-rose-900/10 px-3 py-2 rounded-xl hover:bg-rose-900/30"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {model.derivedAccounts.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Database empty (будет наполняться от Smart Import).</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const RawDataView = () => {
    const missing = model.derivedAccounts.filter((a: any) => !String(a.password || "").trim());
    const rows = model.derivedAccounts
      .filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true))
      .filter((a: any) => (rawOnlyMissing ? !String(a.password || "").trim() : true));

    const copyMissingEmails = async () => {
      const payload = missing.map((a: any) => a.email).join("\n");
      await copyToClipboard(payload);
      pushToast("ok", "Copied", `${missing.length} emails without passwords.`);
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#151A23] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Sheet size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Dashboard — RawData (accounts: email + password)</h3>
                <p className="text-xs text-slate-500">
                  Вставляй сюда все аккаунты: <span className="font-mono">email&lt;TAB&gt;password</span>. Пароли автоматически обновятся в Database и Next Action.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 flex items-center gap-2">
                <input type="checkbox" checked={rawOnlyMissing} onChange={(e) => setRawOnlyMissing((e.target as HTMLInputElement).checked)} />
                show emails without passwords
              </label>
              <button
                onClick={copyMissingEmails}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-xs font-bold"
              >
                Copy missing emails ({missing.length})
              </button>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              className="w-full bg-[#0B0E14] border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-200 focus:border-indigo-500 outline-none min-h-[120px]"
              placeholder={"PASTE HERE (tab-separated from Google):\nemail1@example.com\tpassword1\nemail2@example.com\tpassword2"}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                ingestRawAccounts(text);
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  const t = (e.currentTarget as HTMLTextAreaElement).value;
                  if (t && t.trim()) ingestRawAccounts(t);
                  (e.currentTarget as HTMLTextAreaElement).value = "";
                }
              }}
            />
            <div className="mt-3 text-xs text-slate-500 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} />
                <span>Paste = upsert passwords + create missing accounts.</span>
              </div>
              {state.lastRawImport ? (
                <div className="text-slate-400">
                  Last raw import: <b className="text-slate-200">{new Date(state.lastRawImport.at).toLocaleString()}</b> • Rows{" "}
                  <b className="text-slate-200">{state.lastRawImport.rows}</b> • Updated{" "}
                  <b className="text-slate-200">{state.lastRawImport.updated}</b> • Created{" "}
                  <b className="text-slate-200">{state.lastRawImport.created}</b> • Errors{" "}
                  <b className="text-amber-300">{state.lastRawImport.errors}</b>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#151A23] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 font-bold text-white flex justify-between items-center">
            <span>RawData — Accounts</span>
            <span className="text-slate-500 text-sm font-normal">{rows.length} rows</span>
          </div>

          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-[#0B0E14] text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((a: any) => {
                  const missingPass = !String(a.password || "").trim();
                  return (
                    <tr key={a.emailKey} className={`hover:bg-slate-800/40 ${missingPass ? "bg-rose-500/5" : ""}`}>
                      <td className="px-6 py-4">
                        <div className="text-white font-semibold">{a.email}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-200">
                        {missingPass ? <span className="text-rose-300">—</span> : a.password}
                      </td>
                      <td className="px-6 py-4">
                        {missingPass ? <Badge kind="block">NO PASS</Badge> : <Badge kind="active">OK</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-500">No rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const HotelsView = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Hotels</h2>
          <p className="text-xs text-slate-500">Отели создаются автоматически из Smart Import. TECH block: cancelled ≥ {state.settings.hotelTechBlockTotal}.</p>
        </div>
        <button
          onClick={() => downloadCSV("hotels.csv", state.hotels)}
          className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
        >
          <Download size={16} /> Export
        </button>
      </div>

      <div className="bg-[#151A23] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-[#0B0E14] text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Hotel</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Stats</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {model.derivedHotels
                .filter((h: any) =>
                  searchTerm
                    ? safeLower(h.name).includes(safeLower(searchTerm)) || String(h.hotelId).includes(searchTerm)
                    : true
                )
                .sort((a: any, b: any) => b.totalBookings - a.totalBookings)
                .map((h: any) => (
                  <tr key={h.hotelId} className="hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <div className="text-white font-bold">{h.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{h.hotelId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {!h.isBlocked ? <Badge kind="active">OK</Badge> : <Badge kind="block">BLOCK</Badge>}
                        {h.techBlocked && <Badge kind="tech">TECH</Badge>}
                        {h.manualBlocked && <Badge kind="block">MANUAL</Badge>}
                      </div>
                      {h.blockReason && <div className="mt-2 text-xs text-rose-300">{h.blockReason}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">{h.totalBookings}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Confirmed</span><span>{h.confirmed}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Cancelled</span><span>{h.cancelled}</span></div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        className="bg-[#0B0E14] border border-slate-700 rounded px-2 py-1 text-slate-200 w-full text-xs"
                        value={h.notes || ""}
                        onChange={(e) => {
                          const notes = e.target.value;
                          setState((prev: any) => {
                            const next = { ...prev, hotels: [...prev.hotels] };
                            const idx = next.hotels.findIndex((x: any) => x.hotelId === h.hotelId);
                            if (idx >= 0) next.hotels[idx] = { ...next.hotels[idx], notes };
                            return next;
                          });
                        }}
                        placeholder="notes"
                      />
                    </td>
                  </tr>
                ))}
              {model.derivedHotels.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">Hotels empty (будет наполняться от Smart Import).</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const BookingsView = () => {
    const filtered = [...state.bookings]
      .sort((a: any, b: any) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))
      .filter((b: any) => {
        if (!searchTerm) return true;
        const q = safeLower(searchTerm);
        return (
          safeLower(b.email).includes(q) ||
          String(b.bookingNo || "").toLowerCase().includes(q) ||
          safeLower(b.hotelNameSnapshot || "").includes(q) ||
          String(b.hotelId || "").toLowerCase().includes(q)
        );
      })
      .filter((b: any) => (bookingStatusFilter === "ALL" ? true : b.status === bookingStatusFilter))
      .filter((b: any) => (bookingTypeFilter === "ALL" ? true : normalizeRewardType(b.rewardType) === bookingTypeFilter))
      .filter((b: any) => (bookingMissingPaidFilter ? !String(b.rewardPaidOn || "").trim() : true));

    return (
      <div className="space-y-6">
        {/* SMART IMPORT — SINGLE ENTRY POINT */}
        <div className="bg-[#151A23] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <ClipboardList size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Bookings — Smart Import (paste = commit)</h3>
                <p className="text-xs text-slate-500">
                  Вставляешь строки из Google Sheets → они сразу попадают в лог, создают Account/Hotel при необходимости и запускают перерасчёт.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadCSV("bookings.csv", state.bookings)}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
              >
                <Download size={16} /> Export
              </button>
              <button
                onClick={() => setAuditOpen(true)}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
              >
                <History size={16} /> Audit
              </button>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              className="w-full bg-[#0B0E14] border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-200 focus:border-blue-500 outline-none min-h-[120px]"
              placeholder={`PASTE HERE (tab-separated from Google):\n2025-12-15\tr...@gmx.com\t5051780387\t6635\t\tHyatt Regency...\t6,066.89\t2026-03-12\t2026-03-13\t120.00\tconfirmed\tGenius Level 1`}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                ingestFromPaste(text);
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  const t = (e.currentTarget as HTMLTextAreaElement).value;
                  if (t && t.trim()) ingestFromPaste(t);
                  (e.currentTarget as HTMLTextAreaElement).value = "";
                }
              }}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} />
                <span>
                  Auto-create Accounts/Hotels: <b className="text-slate-300">{state.settings.autoCreateFromImport ? "ON" : "OFF"}</b> • Auto-write TECH blocks:{" "}
                  <b className="text-slate-300">{state.settings.autoWriteTechBlocks ? "ON" : "OFF"}</b>
                </span>
              </div>
              {state.lastImport ? (
                <div className="text-slate-400">
                  Last import: <b className="text-slate-200">{new Date(state.lastImport.at).toLocaleString()}</b> • Added{" "}
                  <b className="text-slate-200">{state.lastImport.added}</b> • New Acc{" "}
                  <b className="text-slate-200">{state.lastImport.accCreated}</b> • New Hotels{" "}
                  <b className="text-slate-200">{state.lastImport.hotelCreated}</b> • Dup{" "}
                  <b className="text-slate-200">{state.lastImport.dupSkipped}</b> • Errors{" "}
                  <b className="text-amber-300">{state.lastImport.errors}</b>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        {/* BOOKINGS TABLE */}
        <div className="bg-[#151A23] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3 items-center justify-between">
            <div className="font-bold text-white">Bookings Log (Google-like columns)</div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="text-slate-500">{filtered.length} / {state.bookings.length}</div>
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter((e.target as HTMLSelectElement).value)}
                className="bg-[#0B0E14] border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value="ALL">Status: ALL</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={bookingTypeFilter}
                onChange={(e) => setBookingTypeFilter((e.target as HTMLSelectElement).value)}
                className="bg-[#0B0E14] border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value="ALL">Type: ALL</option>
                {REWARD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="text-slate-400 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bookingMissingPaidFilter}
                  onChange={(e) => setBookingMissingPaidFilter((e.target as HTMLInputElement).checked)}
                />
                missing RewardPaidOn
              </label>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-[#0B0E14] text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">AccountID</th>
                  <th className="px-6 py-4">BookingNo</th>
                  <th className="px-6 py-4">PIN</th>
                  <th className="px-6 py-4">Hotel</th>
                  <th className="px-6 py-4">Cost</th>
                  <th className="px-6 py-4">CheckIn</th>
                  <th className="px-6 py-4">CheckOut</th>
                  <th className="px-6 py-4">Reward</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">LEVEL</th>
                  <th className="px-6 py-4">Reward paid on</th>
                  <th className="px-6 py-4">Reward ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((b: any) => {
                  const eta = computeRewardETA(b, state.settings);
                  const paidMissing = !String(b.rewardPaidOn || "").trim();
                  return (
                    <tr key={b.bookingId} className={`hover:bg-slate-800/40 ${paidMissing ? "bg-amber-500/5" : ""}`}>
                      <td className="px-6 py-4">{b.createdAt}</td>
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{b.email}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-200">{b.bookingNo}</td>
                      <td className="px-6 py-4 font-mono">{b.pin}</td>
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{b.hotelNameSnapshot}</div>
                        <div className="text-xs text-slate-500 font-mono">{b.hotelId}</div>
                      </td>
                      <td className="px-6 py-4 font-mono">{money(b.cost)}</td>
                      <td className="px-6 py-4">{b.checkIn}</td>
                      <td className="px-6 py-4">{b.checkOut}</td>
                      <td className="px-6 py-4 font-mono text-emerald-300">
                        {b.rewardAmount ? money(b.rewardAmount) : <span className="text-slate-600">—</span>}
                      </td>

                      <td className="px-6 py-4">
                        <select
                          value={normalizeRewardType(b.rewardType || "Booking")}
                          onChange={(e) => {
                            const rewardType = (e.target as HTMLSelectElement).value;
                            setState((prev: any) => {
                              const next = { ...prev, bookings: [...prev.bookings], audit: [...(prev.audit || [])] };
                              const idx = next.bookings.findIndex((x: any) => x.bookingId === b.bookingId);
                              if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], rewardType };
                              next.audit.push({ id: uid(), at: new Date().toISOString(), type: "BOOKING_UPDATE", msg: `Reward type updated: ${b.email} / ${b.bookingNo} → ${rewardType}` });
                              next.audit = next.audit.slice(-400);
                              return next;
                            });
                          }}
                          className="bg-[#0B0E14] border border-slate-700 rounded text-xs px-2 py-1 text-slate-300 outline-none"
                        >
                          {REWARD_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-6 py-4">
                        <select
                          value={b.status}
                          onChange={(e) => {
                            const status = (e.target as HTMLSelectElement).value;
                            setState((prev: any) => {
                              const next = { ...prev, bookings: [...prev.bookings], audit: [...(prev.audit || [])] };
                              const idx = next.bookings.findIndex((x: any) => x.bookingId === b.bookingId);
                              if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], status };
                              next.audit.push({ id: uid(), at: new Date().toISOString(), type: "BOOKING_UPDATE", msg: `Booking status updated: ${b.email} / ${b.bookingNo} → ${status}` });
                              next.audit = next.audit.slice(-400);
                              return next;
                            });
                          }}
                          className="bg-[#0B0E14] border border-slate-700 rounded text-xs px-2 py-1 text-slate-300 outline-none"
                        >
                          <option>Pending</option>
                          <option>Confirmed</option>
                          <option>Completed</option>
                          <option>Cancelled</option>
                        </select>
                        <div className="mt-2">
                          {b.status === "Confirmed" ? (
                            <Badge kind="active">CONFIRMED</Badge>
                          ) : b.status === "Pending" ? (
                            <Badge kind="dim">PENDING</Badge>
                          ) : b.status === "Completed" ? (
                            <Badge kind="gold">COMPLETED</Badge>
                          ) : b.status === "Cancelled" ? (
                            <Badge kind="block">CANCELLED</Badge>
                          ) : (
                            <Badge kind="dim">{b.status}</Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">{b.level || <span className="text-slate-600">—</span>}</td>

                      <td className="px-6 py-4">
                        <input
                          type="date"
                          value={b.rewardPaidOn || ""}
                          onChange={(e) => {
                            const rewardPaidOn = (e.target as HTMLInputElement).value;
                            setState((prev: any) => {
                              const next = { ...prev, bookings: [...prev.bookings], audit: [...(prev.audit || [])] };
                              const idx = next.bookings.findIndex((x: any) => x.bookingId === b.bookingId);
                              if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], rewardPaidOn };
                              next.audit.push({ id: uid(), at: new Date().toISOString(), type: "BOOKING_UPDATE", msg: `Reward paid date updated: ${b.email} / ${b.bookingNo} → ${rewardPaidOn || "CLEAR"}` });
                              next.audit = next.audit.slice(-400);
                              return next;
                            });
                          }}
                          className={`bg-[#0B0E14] border rounded text-xs px-2 py-1 text-slate-300 outline-none ${
                            paidMissing ? "border-amber-500/40" : "border-slate-700"
                          }`}
                        />
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-slate-200">{eta || <span className="text-slate-600">—</span>}</td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-6 py-10 text-center text-slate-500">No bookings match current filters. Paste into Smart Import.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const NextActionView = () => {
    const readyList = model.accountsReady.filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true));

    const toggleOne = (emailKey: string) => {
      setReadySelected((prev) => {
        const next = { ...prev };
        if (next[emailKey]) delete next[emailKey];
        else next[emailKey] = true;
        return next;
      });
    };

    const setAllVisible = (checked: boolean) => {
      if (!checked) return clearReadySelected();
      const next: Record<string, boolean> = {};
      for (const a of readyList) next[a.emailKey] = true;
      setReadySelected(next);
    };

    const selectedCount = Object.keys(readySelected).length;
    const allVisibleSelected = readyList.length > 0 && readyList.every((a: any) => !!readySelected[a.emailKey]);

    const copySelected = async () => {
      const rows = readyList.filter((a: any) => !!readySelected[a.emailKey]);
      if (rows.length === 0) {
        pushToast("warn", "Nothing selected", "Выдели строки и жми Copy.");
        return;
      }
      const payload = accountsToTSV(rows);
      await copyToClipboard(payload);
      pushToast("ok", "Copied", `${rows.length} rows → clipboard (email + password).`);
    };

    const copyOne = async (a: any) => {
      await copyToClipboard(tsvRow(a.email, a.password || ""));
      pushToast("ok", "Copied", "email + password");
    };

    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in">
        <div className="bg-[#151A23] border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[78vh]">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start gap-4">
            <div>
              <h3 className="font-bold text-white text-lg">Accounts Ready</h3>
              <p className="text-xs text-slate-500">
                Active • Not Blocked • &lt; {state.settings.maxActiveBookings} active • Cooldown ≥ {state.settings.cooldownDays}d
              </p>
              <p className="text-[11px] text-slate-600 mt-1 font-mono">
                Quick export format: <span className="text-slate-400">email\tpassword</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNextActionMode("table")}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                    nextActionMode === "table"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                      : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  TABLE
                </button>
                <button
                  onClick={() => setNextActionMode("list")}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                    nextActionMode === "list"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                      : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  LIST
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                  {readyList.length} Ready
                </div>
                <button
                  onClick={copySelected}
                  className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-white text-xs font-bold"
                >
                  Copy Selected ({selectedCount})
                </button>
              </div>
            </div>
          </div>

          {nextActionMode === "table" ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="sticky top-0 bg-[#0B0E14] text-xs uppercase font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={(e) => setAllVisible((e.target as HTMLInputElement).checked)} />
                    </th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Password</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Stat</th>
                    <th className="px-4 py-3 text-right">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {readyList.map((a: any) => {
                    const selected = !!readySelected[a.emailKey];
                    const canc = a.cancelledBookings || 0;
                    const pos = a.positiveBookings || 0;
                    return (
                      <tr
                        key={a.emailKey}
                        className={`hover:bg-slate-800/30 cursor-pointer ${selected ? "bg-blue-500/5" : ""}`}
                        onClick={(e: any) => {
                          const tag = (e.target?.tagName || "").toLowerCase();
                          if (tag === "button" || tag === "input") return;
                          toggleOne(a.emailKey);
                        }}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleOne(a.emailKey)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-semibold">{a.email}</div>
                          <div className="text-[11px] text-slate-600">Bookings {a.totalBookings} • Tier {a.tier}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-200 text-xs">{a.password ? a.password : <span className="text-rose-300">—</span>}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-200">{money(a.netBalance)}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{a.activeBookingsCount}/{state.settings.maxActiveBookings}</td>
                        <td className="px-4 py-3 text-xs font-mono">
                          <span className="text-emerald-300">{pos}</span>
                          <span className="text-slate-600">/</span>
                          <span className={canc > 0 ? "text-rose-400" : "text-slate-500"}>{canc}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyOne(a);
                            }}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl border border-slate-700"
                          >
                            Copy row
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {readyList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">No accounts ready. Main blockers: Блок/TECH/cooldown/active limit.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <tbody className="divide-y divide-slate-800">
                  {readyList.map((a: any) => (
                    <tr key={a.emailKey} className="hover:bg-slate-800/30 group">
                      <td className="px-6 py-4">
                        <div className="text-white font-bold">{a.email}</div>
                        <div className="text-xs text-slate-500">Bookings {a.totalBookings} • Active {a.activeBookingsCount}/{state.settings.maxActiveBookings}</div>
                        <div className="text-xs text-slate-500">Balance {money(a.netBalance)} • Tier {a.tier} • Stat {a.positiveBookings}/{a.cancelledBookings}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => copyToClipboard(a.email)} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl border border-slate-700">Copy Email</button>
                          <button onClick={() => copyToClipboard(a.password || "")} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl border border-slate-700">Copy Pass</button>
                          <button onClick={() => copyOne(a)} className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 px-3 py-2 rounded-xl border border-blue-500/30">Copy Both</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {readyList.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-slate-500">No accounts ready. Main blockers: Блок/TECH/cooldown/active limit.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[#151A23] border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[78vh]">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-lg">Hotels Eligible</h3>
              <p className="text-xs text-slate-500">Confirmed &gt; 0 • Cancelled ≤ 2 • Not blocked</p>
            </div>
            <div className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20">
              {model.hotelsEligible.length} Eligible
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <tbody className="divide-y divide-slate-800">
                {model.hotelsEligible.map((h: any) => (
                  <tr key={h.hotelId} className="hover:bg-slate-800/30">
                    <td className="px-6 py-4">
                      <div className="text-white font-bold">{h.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{h.hotelId}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs">
                        <span className="text-emerald-400">{h.confirmed} Conf</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-rose-400">{h.cancelled} Canc</span>
                        <span className="text-slate-600 mx-1">•</span>
                        <span className="text-slate-200">{h.totalBookings} total</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {model.hotelsEligible.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-slate-500">No hotels eligible yet. Нужно confirmed и low canc.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const NAV: any[] = [
    { id: "overview", icon: LayoutDashboard, label: "Overview" },
    { id: "bookings", icon: BookOpen, label: "Bookings" },
    { id: "database", icon: Users, label: "Database" },
    { id: "rawdata", icon: Database, label: "RawData" },
    { id: "hotels", icon: Building2, label: "Hotels" },
    { id: "next_action", icon: Activity, label: "Next Action" },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-200 font-sans selection:bg-blue-500/30 flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-20 bg-[#151A23] border-r border-slate-800 flex flex-col items-center py-8 z-20">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mb-10 shadow-lg shadow-blue-500/20 flex items-center justify-center font-bold text-white text-xl">Ops</div>

        <nav className="flex flex-col gap-6 w-full">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 mx-auto rounded-xl transition-all duration-300 relative group ${
                activeTab === item.id ? "bg-blue-600/10 text-blue-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              }`}
              title={item.label}
            >
              <item.icon size={22} />
              {activeTab === item.id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-l-full" />}
              <div className="absolute left-16 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700 ml-2">
                {item.label}
              </div>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <button onClick={() => setSettingsOpen(true)} className="p-3 mx-auto rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800" title="Settings">
            <Settings size={22} />
          </button>
          <button onClick={() => setAuditOpen(true)} className="p-3 mx-auto rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800" title="Audit">
            <History size={22} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="pl-20 flex-1">
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-[#0B0E14]/80 backdrop-blur sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-wide">{activeTab.replace("_", " ")}</h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              ACC: {state.database.length} • HOTELS: {state.hotels.length} • BOOKINGS: {state.bookings.length} • READY: {model.accountsReady.length}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Global Search..."
                className="bg-[#151A23] border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 w-64 transition-all focus:w-96"
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
              />
            </div>

            <button
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-2 rounded-xl border border-slate-800 bg-[#151A23] hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <Settings size={16} /> Settings
            </button>
          </div>
        </header>

        <div className="p-8 max-w-[1900px] mx-auto">
          {activeTab === "overview" && <OverviewView />}
          {activeTab === "bookings" && <BookingsView />}
          {activeTab === "database" && <DatabaseView />}
          {activeTab === "rawdata" && <RawDataView />}
          {activeTab === "hotels" && <HotelsView />}
          {activeTab === "next_action" && <NextActionView />}
        </div>
      </main>

      {/* Settings */}
      <Modal open={settingsOpen} title="Rules & Automation Settings" onClose={() => setSettingsOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { k: "goldThreshold", label: "Gold threshold ($)", type: "number" },
            { k: "platinumAfterDays", label: "Platinum after days", type: "number" },
            { k: "cooldownDays", label: "Cooldown days between bookings", type: "number" },
            { k: "maxActiveBookings", label: "Max active bookings per account", type: "number" },
            { k: "techBlockConsecutive", label: "Account TECH block streak", type: "number" },
            { k: "techBlockTotal", label: "Account TECH block total", type: "number" },
            { k: "hotelTechBlockTotal", label: "Hotel TECH block total", type: "number" },
            { k: "rewardDaysBooking", label: "Reward days after CheckOut (Booking)", type: "number" },
            { k: "rewardDaysOther", label: "Reward days after CheckOut (Copa/AA/CC)", type: "number" },
          ].map((x: any) => (
            <div key={x.k} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <div className="text-xs text-slate-500 font-bold uppercase">{x.label}</div>
              <input
                type={x.type}
                className="mt-2 w-full bg-[#0B0E14] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500"
                value={state.settings[x.k]}
                onChange={(e) => setSettings({ [x.k]: Number((e.target as HTMLInputElement).value) })}
              />
            </div>
          ))}

          <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
            <div className="text-xs text-slate-500 font-bold uppercase">Auto-create from import</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-200">Create missing accounts/hotels during paste</div>
              <input type="checkbox" checked={state.settings.autoCreateFromImport} onChange={(e) => setSettings({ autoCreateFromImport: (e.target as HTMLInputElement).checked })} />
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
            <div className="text-xs text-slate-500 font-bold uppercase">Auto-write TECH blocks</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-200">When TECH triggers, force manual block</div>
              <input type="checkbox" checked={state.settings.autoWriteTechBlocks} onChange={(e) => setSettings({ autoWriteTechBlocks: (e.target as HTMLInputElement).checked })} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => {
              setSettingsOpen(false);
              pushToast("ok", "Saved", "Rules updated.");
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* Audit */}
      <Modal open={auditOpen} title="Audit Log (last 400 events)" onClose={() => setAuditOpen(false)}>
        <div className="text-xs text-slate-500 mb-3">Это твой “журнал операций”: импорты, RawData, автосоздания, дедупы, ошибки парсинга, авто-блоки.</div>
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-[#0B0E14] text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[...(state.audit || [])]
                  .slice()
                  .reverse()
                  .map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-500">{new Date(e.at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{e.type}</td>
                      <td className="px-4 py-3 text-slate-200">{e.msg}</td>
                    </tr>
                  ))}
                {(state.audit || []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Empty audit.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Toasts */}
      <Toasts toasts={toasts} onDismiss={(id: string) => setToasts((p) => p.filter((t: any) => t.id !== id))} />
    </div>
  );
}

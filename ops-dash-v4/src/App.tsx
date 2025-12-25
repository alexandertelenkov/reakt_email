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
  bg: "#F6F7FB",
  card: "#FFFFFF",
  primary: "#3B82F6",
  accent: "#6366F1",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#FFFFFF",
  textDim: "#94A3B8",
  border: "#E2E8F0",
  gold: "#FFD700",
  plat: "#60A5FA",
};

const DEFAULT_REWARD_TYPES = [
  { name: "Booking", days: 14 },
  { name: "Copa", days: 64 },
  { name: "AA", days: 64 },
  { name: "CC", days: 64 },
] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const safeLower = (s: any) => (s || "").trim().toLowerCase();
const nowISO = () => new Date().toISOString();

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

function downloadJSON(filename: string, payload: any) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportStateByEmail(state: any) {
  const accounts = state.database.map((acc: any) => {
    const key = safeLower(acc.email);
    return {
      ...acc,
      bookings: state.bookings.filter((b: any) => safeLower(b.email) === key),
      sales: state.sales.filter((s: any) => safeLower(s.email) === key),
    };
  });

  return {
    exportedAt: nowISO(),
    settings: state.settings,
    hotels: state.hotels,
    accounts,
  };
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

function normalizeChainName(name: string) {
  const raw = String(name || "").trim();
  if (!raw) return "Unknown";
  const lowered = raw.toLowerCase();
  const known = [
    "holiday inn",
    "hampton",
    "hilton",
    "marriott",
    "hyatt",
    "sheraton",
    "westin",
    "crowne plaza",
    "intercontinental",
    "holiday express",
    "radisson",
    "wyndham",
    "doubletree",
    "ramada",
    "fairfield",
    "courtyard",
    "residence inn",
  ];
  for (const k of known) {
    if (lowered.includes(k)) {
      return k
        .split(" ")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
    }
  }
  const first = raw.split(/[\s,]/).filter(Boolean)[0] || raw;
  return first.charAt(0).toUpperCase() + first.slice(1);
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

  // If it looks like a date or anything else, don't let it pretend to be a level.
  return "";
}

function getRewardTypes(settings?: any) {
  const list = settings?.rewardTypes;
  if (Array.isArray(list) && list.length > 0) return list;
  return DEFAULT_REWARD_TYPES.map((r) => ({ ...r }));
}

function normalizeRewardType(raw: any, rewardTypes = DEFAULT_REWARD_TYPES) {
  const s = safeLower(raw);
  if (!s) return "Booking";
  const hit = rewardTypes.find((t: any) => safeLower(t.name) === s);
  if (hit) return hit.name;
  if (s === "booking") return "Booking";
  return raw ? String(raw).trim() : "Booking";
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
  const types = getRewardTypes(settings);
  const type = normalizeRewardType(b.rewardType || "Booking", types);
  const match = types.find((t: any) => safeLower(t.name) === safeLower(type));
  const days = match
    ? Number(match.days || 0)
    : type === "Booking"
    ? Number(settings.rewardDaysBooking || 14)
    : Number(settings.rewardDaysOther || 64);
  return addDaysISO(checkOut, days);
}

function leadTimeBucket(days: number | null) {
  if (days === null || Number.isNaN(days)) return "Unknown";
  if (days <= 3) return "0-3d";
  if (days <= 7) return "4-7d";
  if (days <= 14) return "8-14d";
  if (days <= 30) return "15-30d";
  return "31+d";
}

/**
 * Target paste columns (from Google Sheets), tab-separated:
 * Date | Email | BookingNo | PIN | HotelID | HotelName | Cost | CheckIn | CheckOut | (optional promo) | Reward | Status | Level | (optional Type) | (optional RewardPaidOn)
 *
 * Examples:
 * 2025-12-15    email@gmx.com    5051780387    6635        Hotel Name    6,066.89    2026-03-12    2026-03-13    120.00    confirmed    Genius Level 1
 * 2025-12-15    email@gmx.com    5051780387    6635        Hotel Name    6,066.89    2026-03-12    2026-03-13    120.00    confirmed    Genius Level 2    Copa    2026-05-20
 */
function parseBookingLine(line: string, rewardTypes = DEFAULT_REWARD_TYPES) {
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
  const pin = String(parts[3] || "").padStart(4, "0");

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

  // tail: Level + optional Type + optional RewardPaidOn (ISO date) + optional Airline
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
    const t = normalizeRewardType(tok, rewardTypes);
    if (rewardTypes.some((rt: any) => safeLower(rt.name) === safeLower(t))) {
      rewardType = t;
      continue;
    }
    tailRemainder.push(tok);
  }

  // Level should be "Genius Level 1/2/3" (not a date). Prefer a clean extracted label.
  const level = extractGeniusLevel(tailRemainder);
  const airlineToken = tailRemainder.find((t) => !/genius\s*level/i.test(t)) || "";

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
    rewardCurrency: "USD",
    status,
    level,
    rewardType,
    airline: airlineToken,
    rewardPaidOn,
    note: "",
    _raw: raw,
  };
}

function parsePaste(text: string, rewardTypes = DEFAULT_REWARD_TYPES) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: any[] = [];
  const errors: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const row = parseBookingLine(lines[i], rewardTypes);
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

function parseSpentPaste(text: string) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: Array<{ date: string; email: string; amount: number; note: string }> = [];
  const errors: Array<{ line: number; raw: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const parts = raw.includes("\t")
      ? raw.split("\t")
      : raw.includes(";")
      ? raw.split(";")
      : raw.includes(",")
      ? raw.split(",")
      : raw.split(/\s+/);

    const date = String(parts[0] || "").trim();
    const email = safeLower(parts[1] || "");
    const amountRaw = parts[2];
    const note = parts.slice(3).join(" ").trim();

    if (!isISODateLike(date) || !email || !email.includes("@") || !isNumericLike(amountRaw)) {
      errors.push({ line: i + 1, raw });
      continue;
    }
    rows.push({ date, email, amount: parseMoney(amountRaw), note });
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
    rewardTypes: DEFAULT_REWARD_TYPES.map((r) => ({ ...r })),
    autoCreateFromImport: true,
    autoWriteTechBlocks: true,
  },
  database: [
    { email: "demo1@mail.com", password: "pass-demo-1", manualStatus: "Активен", notes: "", createdAt: "2025-02-01" },
    { email: "demo2@mail.com", password: "pass-demo-2", manualStatus: "Активен", notes: "", createdAt: "2025-02-02" },
    { email: "demo3@mail.com", password: "pass-demo-3", manualStatus: "Активен", notes: "", createdAt: "2025-02-03" },
    { email: "demo4@mail.com", password: "pass-demo-4", manualStatus: "Активен", notes: "", createdAt: "2025-02-04" },
    { email: "demo5@mail.com", password: "", manualStatus: "Активен", notes: "", createdAt: "2025-02-05" },
    { email: "demo6@mail.com", password: "pass-demo-6", manualStatus: "Активен", notes: "", createdAt: "2025-02-05" },
    { email: "demo7@mail.com", password: "pass-demo-7", manualStatus: "Активен", notes: "", createdAt: "2025-02-06" },
    { email: "demo8@mail.com", password: "", manualStatus: "Активен", notes: "", createdAt: "2025-02-07" },
    { email: "demo9@mail.com", password: "pass-demo-9", manualStatus: "Активен", notes: "", createdAt: "2025-02-08" },
    { email: "demo10@mail.com", password: "pass-demo-10", manualStatus: "Активен", notes: "", createdAt: "2025-02-08" },
    { email: "demo11@mail.com", password: "pass-demo-11", manualStatus: "Активен", notes: "", createdAt: "2025-02-09" },
    { email: "demo12@mail.com", password: "", manualStatus: "Активен", notes: "", createdAt: "2025-02-10" },
  ],
  hotels: [{ hotelId: "74", name: "The Bower Coronado", manualStatus: "OK", notes: "" }],
  bookings: [
    {
      bookingId: uid(),
      createdAt: "2025-02-10",
      email: "demo1@mail.com",
      bookingNo: "BK1001",
      pin: "1122",
      hotelId: "74",
      hotelNameSnapshot: "The Bower Coronado",
      cost: 320,
      checkIn: "2025-02-12",
      checkOut: "2025-02-13",
      promoCode: "",
      rewardAmount: 40,
      rewardType: "Booking",
      rewardPaidOn: "",
      status: "Confirmed",
      level: "Genius Level 1",
      note: "",
      _raw: "",
    },
    {
      bookingId: uid(),
      createdAt: "2025-02-11",
      email: "demo2@mail.com",
      bookingNo: "BK1002",
      pin: "2211",
      hotelId: "74",
      hotelNameSnapshot: "The Bower Coronado",
      cost: 540,
      checkIn: "2025-02-14",
      checkOut: "2025-02-16",
      promoCode: "",
      rewardAmount: 60,
      rewardType: "Copa",
      rewardPaidOn: "2025-04-21",
      status: "Completed",
      level: "Genius Level 2",
      note: "",
      _raw: "",
    },
    {
      bookingId: uid(),
      createdAt: "2025-02-12",
      email: "demo5@mail.com",
      bookingNo: "BK1003",
      pin: "3344",
      hotelId: "74",
      hotelNameSnapshot: "The Bower Coronado",
      cost: 280,
      checkIn: "2025-02-18",
      checkOut: "2025-02-19",
      promoCode: "",
      rewardAmount: 0,
      rewardType: "Booking",
      rewardPaidOn: "",
      status: "Cancelled",
      level: "Genius Level 1",
      note: "",
      _raw: "",
    },
  ],
  sales: [
    { id: uid(), date: "2025-02-12", email: "demo1@mail.com", amount: 15, note: "Taxi" },
    { id: uid(), date: "2025-02-15", email: "demo2@mail.com", amount: 25, note: "Support" },
    { id: uid(), date: "2025-02-20", email: "demo7@mail.com", amount: 10, note: "SIM" },
  ],
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
  const hotelStats = new Map<string, { total: number; confirmed: number; cancelled: number; spent: number }>();
  for (const b of bookings) {
    const id = b.hotelId || "";
    if (!id) continue;
    if (!hotelStats.has(id)) hotelStats.set(id, { total: 0, confirmed: 0, cancelled: 0, spent: 0 });
    const st = hotelStats.get(id)!;
    st.total += 1;
    if (b.status === "Confirmed") st.confirmed += 1;
    if (b.status === "Cancelled") st.cancelled += 1;
    st.spent += Number(b.cost || 0);
  }

  const derivedHotels = hotels.map((h: any) => {
    const st = hotelStats.get(h.hotelId) || { total: 0, confirmed: 0, cancelled: 0, spent: 0 };
    const techBlocked = st.cancelled >= settings.hotelTechBlockTotal;
    const manualBlocked = h.manualStatus === "BLOCK";
    const isBlocked = manualBlocked || techBlocked;
    return {
      ...h,
      totalBookings: st.total,
      confirmed: st.confirmed,
      cancelled: st.cancelled,
      spent: st.spent,
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
    const b2: any = parseBookingLine(line2, DEFAULT_REWARD_TYPES);
    console.assert(b2.rewardType === "Copa", "type should parse from tail");
    console.assert(b2.rewardPaidOn === "2026-05-20", "rewardPaidOn should parse ISO date");
    console.assert(b2.level === "Genius Level 2", "level should not get polluted by date/type");

    const line3 =
      "2025-12-15\ta@b.com\t777\t0000\t74\tHotel\t100\t2026-03-12\t2026-03-13\t80\tconfirmed\tGenius Level 3\tAA\tAmerican Airlines";
    const b3: any = parseBookingLine(line3, DEFAULT_REWARD_TYPES);
    console.assert(b3.airline === "American Airlines", "airline should parse from tail");

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
    const p = parsePaste(paste, DEFAULT_REWARD_TYPES);
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
const Badge = ({ kind, children, themeMode }: any) => {
  const map: any = {
    active: themeMode === "dark" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    block: themeMode === "dark" ? "bg-rose-500/10 text-rose-300 border-rose-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20",
    tech: themeMode === "dark" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20",
    gold: themeMode === "dark" ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    plat: themeMode === "dark" ? "bg-blue-400/10 text-blue-200 border-blue-400/20" : "bg-blue-400/10 text-blue-500 border-blue-400/20",
    dim: themeMode === "dark" ? "bg-slate-500/10 text-slate-400 border-slate-500/20" : "bg-slate-500/10 text-slate-500 border-slate-500/20",
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

const StatCard = ({ title, value, subValue, icon: Icon, onClick, theme }: any) => (
  <div
    onClick={onClick}
    className={`relative overflow-hidden p-6 rounded-2xl border transition-all cursor-pointer ${
      theme === "dark"
        ? "border-slate-800 bg-gradient-to-br from-[#111827] via-[#0B1220] to-[#0B0E14] shadow-[0_10px_30px_rgba(15,23,42,0.6)] hover:border-blue-500/60"
        : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
    }`}
  >
    <div className={`absolute top-0 right-0 p-4 opacity-20 ${theme === "dark" ? "text-blue-400" : "text-slate-400"}`}>
      <Icon size={64} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div
        className={`p-2 rounded-lg border ${
          theme === "dark"
            ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
            : "bg-slate-100 border-slate-200 text-slate-600"
        }`}
      >
        <Icon size={18} />
      </div>
      <span className={`text-sm font-medium ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{title}</span>
    </div>
    <div className="flex items-end gap-3">
      <h3 className={`text-2xl font-bold tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{value}</h3>
      {subValue && <span className={`text-xs mb-1 ${theme === "dark" ? "text-slate-500" : "text-slate-500"}`}>{subValue}</span>}
    </div>
  </div>
);

function Modal({ open, title, onClose, children, themeMode }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`absolute left-1/2 top-1/2 w-[min(980px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border shadow-2xl ${
          themeMode === "dark" ? "border-slate-800 bg-[#0F172A]" : "border-slate-200 bg-white"
        }`}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${themeMode === "dark" ? "border-slate-800" : "border-slate-200"}`}>
          <div className={`${themeMode === "dark" ? "text-slate-100" : "text-slate-900"} font-bold`}>{title}</div>
          <button onClick={onClose} className={`p-2 rounded-lg ${themeMode === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
            <X size={18} className={`${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`} />
          </button>
        </div>
        <div className={`p-5 ${themeMode === "dark" ? "text-slate-200" : "text-slate-700"}`}>{children}</div>
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
          className={`px-4 py-3 rounded-xl border shadow-lg backdrop-blur bg-slate-50/70 ${
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
              <div className="text-sm font-bold text-slate-900">{t.title}</div>
              {t.msg && <div className="text-xs text-slate-500 mt-1">{t.msg}</div>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-500 hover:text-slate-900 text-xs"
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
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [trendDays, setTrendDays] = useState(30);
  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [chainModalName, setChainModalName] = useState("");
  const [bestHotelMode, setBestHotelMode] = useState<"cancellations" | "spend">("cancellations");
  const [rewardModalEmail, setRewardModalEmail] = useState<string | null>(null);

  // Next Action UX: table mode + multi-select copy
  const [nextActionMode, setNextActionMode] = useState<"table" | "list">("table");
  const [readySelected, setReadySelected] = useState<Record<string, boolean>>(() => ({}));
  const clearReadySelected = () => setReadySelected({});
  const [readyBalanceMin, setReadyBalanceMin] = useState("");

  // RawData: show only emails without passwords
  const [rawOnlyMissing, setRawOnlyMissing] = useState(false);

  // Bookings filters
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("ALL");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>("ALL");
  const [bookingMissingPaidFilter, setBookingMissingPaidFilter] = useState(false);
  const [bookingMissingPasswordFilter, setBookingMissingPasswordFilter] = useState(false);
  const [bookingEditMode, setBookingEditMode] = useState(false);
  const [bookingDupOpen, setBookingDupOpen] = useState(false);
  const [bookingDupRows, setBookingDupRows] = useState<any[]>([]);

  // Database filter
  const [dbOnlyMissing, setDbOnlyMissing] = useState(false);
  const [hotelConfirmedMin, setHotelConfirmedMin] = useState("");
  const [hotelCancelledMax, setHotelCancelledMax] = useState("");
  const [hotelTopRatedOnly, setHotelTopRatedOnly] = useState(false);

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

  const theme = useMemo(
    () =>
      themeMode === "dark"
        ? {
            bg: "bg-[#0B0E14] text-slate-200",
            panel: "bg-[#121826] border border-slate-800 shadow-[0_8px_30px_rgba(15,23,42,0.45)]",
            panelMuted: "bg-[#0F172A] border border-slate-800",
            header: "bg-[#0B0E14]/90 border-slate-800",
            sidebar: "bg-[#0F172A] border-slate-800",
            input: "bg-[#0B1220] border-slate-700 text-slate-200",
            button: "bg-[#0F172A] border-slate-700 text-slate-200 hover:bg-slate-800",
            text: "text-slate-200",
            textDim: "text-slate-400",
            tableHead: "bg-[#0B1220] text-slate-400",
            rowHover: "hover:bg-slate-800/40",
            tooltip: { backgroundColor: "#0B1220", borderColor: "#1E293B", color: "#E2E8F0" },
            grid: "#1E293B",
            axis: "#94A3B8",
          }
        : {
            bg: "bg-[#F6F7FB] text-slate-900",
            panel: "bg-white border border-slate-200 shadow-sm",
            panelMuted: "bg-slate-50 border border-slate-200",
            header: "bg-white/80 border-slate-200",
            sidebar: "bg-white border-slate-200",
            input: "bg-white border-slate-200 text-slate-700",
            button: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
            text: "text-slate-900",
            textDim: "text-slate-500",
            tableHead: "bg-white text-slate-500",
            rowHover: "hover:bg-slate-50",
            tooltip: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", color: "#334155" },
            grid: "#E2E8F0",
            axis: "#94A3B8",
          },
    [themeMode]
  );

  const netTrend = useMemo(() => {
    const days = trendDays;
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
  }, [state.bookings, state.sales, trendDays]);

  const accountsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of state.database) {
      const date = String(acc.createdAt || "").slice(0, 10) || todayISO();
      map.set(date, (map.get(date) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [state.database]);

  const rewardTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of state.bookings) {
      if (!Number(b.rewardAmount || 0)) continue;
      const date = String(b.rewardPaidOn || b.createdAt || "").slice(0, 10);
      if (!date) continue;
      map.set(date, (map.get(date) || 0) + Number(b.rewardAmount || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [state.bookings]);

  const spentTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of state.sales) {
      const date = String(s.date || "").slice(0, 10);
      if (!date) continue;
      map.set(date, (map.get(date) || 0) + Number(s.amount || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [state.sales]);

  const chainStats = useMemo(() => {
    const map = new Map<string, { total: number; cancelled: number }>();
    for (const b of state.bookings) {
      const chain = normalizeChainName(b.hotelNameSnapshot || b.hotelId || "");
      if (!map.has(chain)) map.set(chain, { total: 0, cancelled: 0 });
      const st = map.get(chain)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(map.entries())
      .map(([chain, st]) => ({
        chain,
        cancelled: st.cancelled,
        other: st.total - st.cancelled,
        total: st.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [state.bookings]);

  const chainReliability = useMemo(() => {
    return chainStats.map((c) => ({
      ...c,
      cancelRate: c.total ? Math.round((c.cancelled / c.total) * 100) : 0,
    }));
  }, [chainStats]);

  const chainHotels = useMemo(() => {
    const map = new Map<string, Map<string, { name: string; total: number; cancelled: number }>>();
    for (const b of state.bookings) {
      const chain = normalizeChainName(b.hotelNameSnapshot || b.hotelId || "");
      if (!map.has(chain)) map.set(chain, new Map());
      const hotelKey = b.hotelId || b.hotelNameSnapshot || "Unknown";
      const hmap = map.get(chain)!;
      if (!hmap.has(hotelKey)) hmap.set(hotelKey, { name: b.hotelNameSnapshot || b.hotelId || "Unknown", total: 0, cancelled: 0 });
      const st = hmap.get(hotelKey)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    const out: Record<string, any[]> = {};
    for (const [chain, hmap] of map.entries()) {
      out[chain] = Array.from(hmap.values())
        .map((h) => ({ ...h, cancelRate: h.total ? Math.round((h.cancelled / h.total) * 100) : 0 }))
        .sort((a, b) => a.cancelRate - b.cancelRate || b.total - a.total);
    }
    return out;
  }, [state.bookings]);

  const leadTimeStats = useMemo(() => {
    const buckets = new Map<string, { total: number; cancelled: number }>();
    for (const b of state.bookings) {
      const lead = daysDiff(b.createdAt, b.checkIn);
      const bucket = leadTimeBucket(lead);
      if (!buckets.has(bucket)) buckets.set(bucket, { total: 0, cancelled: 0 });
      const st = buckets.get(bucket)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(buckets.entries()).map(([bucket, st]) => ({
      bucket,
      total: st.total,
      cancelled: st.cancelled,
      cancelRate: st.total ? Math.round((st.cancelled / st.total) * 100) : 0,
    }));
  }, [state.bookings]);

  const promoStats = useMemo(() => {
    const withPromo = { total: 0, cancelled: 0 };
    const withoutPromo = { total: 0, cancelled: 0 };
    for (const b of state.bookings) {
      const hasPromo = String(b.promoCode || "").trim().length > 0;
      const target = hasPromo ? withPromo : withoutPromo;
      target.total += 1;
      if (b.status === "Cancelled") target.cancelled += 1;
    }
    const withRate = withPromo.total ? Math.round((withPromo.cancelled / withPromo.total) * 100) : 0;
    const withoutRate = withoutPromo.total ? Math.round((withoutPromo.cancelled / withoutPromo.total) * 100) : 0;
    return { withPromo, withoutPromo, withRate, withoutRate };
  }, [state.bookings]);

  const bestHotels = useMemo(() => {
    const map = new Map<string, { hotelId: string; name: string; total: number; cancelled: number }>();
    for (const b of state.bookings) {
      const key = b.hotelId || b.hotelNameSnapshot || "Unknown";
      if (!map.has(key))
        map.set(key, {
          hotelId: b.hotelId || "",
          name: b.hotelNameSnapshot || b.hotelId || "Unknown",
          total: 0,
          cancelled: 0,
        });
      const st = map.get(key)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(map.values())
      .map((h) => ({
        ...h,
        cancelRate: h.total ? Math.round((h.cancelled / h.total) * 100) : 0,
      }))
      .filter((h) => h.total >= 2)
      .sort((a, b) => a.cancelRate - b.cancelRate || b.total - a.total)
      .slice(0, 8);
  }, [state.bookings]);

  const bestHotelsBySpend = useMemo(() => {
    const map = new Map<string, { name: string; total: number; cancelled: number; spent: number }>();
    for (const b of state.bookings) {
      const key = b.hotelId || b.hotelNameSnapshot || "Unknown";
      if (!map.has(key)) map.set(key, { name: b.hotelNameSnapshot || b.hotelId || "Unknown", total: 0, cancelled: 0, spent: 0 });
      const st = map.get(key)!;
      st.total += 1;
      st.spent += Number(b.cost || 0);
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(map.values())
      .map((h) => ({ ...h, cancelRate: h.total ? Math.round((h.cancelled / h.total) * 100) : 0 }))
      .filter((h) => h.total >= 2)
      .sort((a, b) => a.cancelRate - b.cancelRate || b.spent - a.spent)
      .slice(0, 8);
  }, [state.bookings]);

  const riskyAccounts = useMemo(() => {
    return model.derivedAccounts
      .map((a: any) => {
        const risk =
          (a.cancelledBookings || 0) * 2 +
          (a.consecutiveCancelled || 0) * 3 +
          (!String(a.password || "").trim() ? 3 : 0) +
          (!a.cooldownOk ? 2 : 0);
        return { ...a, risk };
      })
      .sort((a: any, b: any) => b.risk - a.risk)
      .slice(0, 8);
  }, [model.derivedAccounts]);

  const recommendedPairs = useMemo(() => {
    const accounts = model.accountsReady.slice(0, 6);
    const hotels = model.hotelsEligible.slice(0, 6);
    const pairs: Array<{ email: string; hotel: string }> = [];
    for (let i = 0; i < Math.max(accounts.length, hotels.length); i++) {
      const acc = accounts[i % accounts.length];
      const hot = hotels[i % hotels.length];
      if (acc && hot) pairs.push({ email: acc.email, hotel: hot.name || hot.hotelId });
    }
    return pairs.slice(0, 6);
  }, [model.accountsReady, model.hotelsEligible]);

  const rewardSummary = useMemo(() => {
    const today = todayISO();
    const byEmail = new Map<string, any>();
    for (const acc of state.database) {
      const key = safeLower(acc.email);
      byEmail.set(key, {
        email: acc.email,
        password: acc.password || "",
        accumulated: 0,
        potential: 0,
        nextRewardAt: "",
        lastRewardAt: "",
        earnedCount: 0,
      });
    }
    for (const b of state.bookings) {
      if (b.status === "Cancelled") continue;
      if (!Number(b.rewardAmount || 0)) continue;
      const key = safeLower(b.email);
      if (!byEmail.has(key)) continue;
      const eta = computeRewardETA(b, state.settings);
      if (!eta) continue;
      if (eta <= today) {
        const row = byEmail.get(key);
        row.accumulated += Number(b.rewardAmount || 0);
        row.earnedCount += 1;
        if (!row.lastRewardAt || eta > row.lastRewardAt) row.lastRewardAt = eta;
      } else {
        const row = byEmail.get(key);
        row.potential += Number(b.rewardAmount || 0);
        if (!row.nextRewardAt || eta < row.nextRewardAt) row.nextRewardAt = eta;
      }
    }
    const salesByEmail = new Map<string, number>();
    for (const s of state.sales) {
      const key = safeLower(s.email);
      salesByEmail.set(key, (salesByEmail.get(key) || 0) + Number(s.amount || 0));
    }
    return Array.from(byEmail.values()).map((row) => {
      const spent = salesByEmail.get(safeLower(row.email)) || 0;
      const daysSinceLast = row.lastRewardAt ? daysDiff(row.lastRewardAt) : null;
      const daysUntilNext = row.nextRewardAt ? daysDiff(today, row.nextRewardAt) : null;
      let medal = "—";
      const totalEarned = row.accumulated;
      if (totalEarned > 300 && row.potential === 0 && daysSinceLast !== null) {
        if (daysSinceLast >= 40) medal = "Platinum";
        else if (daysSinceLast >= 20) medal = "Gold";
      } else if (totalEarned >= 200 && totalEarned <= 300 && daysSinceLast !== null) {
        medal = daysSinceLast <= 20 ? "Bronze/Silver" : "Silver";
      } else if (totalEarned >= 50 && totalEarned < 200) {
        medal = "Bronze";
      }
      return {
        ...row,
        spent,
        restAmount: totalEarned - spent,
        daysSinceLast,
        daysUntilNext,
        medal,
      };
    });
  }, [state.database, state.bookings, state.sales, state.settings]);

  const accountsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of state.database) {
      const date = String(acc.createdAt || "").slice(0, 10) || todayISO();
      map.set(date, (map.get(date) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [state.database]);

  const rewardTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of state.bookings) {
      if (!Number(b.rewardAmount || 0)) continue;
      const date = String(b.rewardPaidOn || b.createdAt || "").slice(0, 10);
      if (!date) continue;
      map.set(date, (map.get(date) || 0) + Number(b.rewardAmount || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [state.bookings]);

  const spentTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of state.sales) {
      const date = String(s.date || "").slice(0, 10);
      if (!date) continue;
      map.set(date, (map.get(date) || 0) + Number(s.amount || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [state.sales]);

  const chainStats = useMemo(() => {
    const map = new Map<string, { total: number; cancelled: number }>();
    for (const b of state.bookings) {
      const chain = normalizeChainName(b.hotelNameSnapshot || b.hotelId || "");
      if (!map.has(chain)) map.set(chain, { total: 0, cancelled: 0 });
      const st = map.get(chain)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(map.entries())
      .map(([chain, st]) => ({
        chain,
        cancelled: st.cancelled,
        other: st.total - st.cancelled,
        total: st.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [state.bookings]);

  const chainReliability = useMemo(() => {
    return chainStats.map((c) => ({
      ...c,
      cancelRate: c.total ? Math.round((c.cancelled / c.total) * 100) : 0,
    }));
  }, [chainStats]);

  const leadTimeStats = useMemo(() => {
    const buckets = new Map<string, { total: number; cancelled: number }>();
    for (const b of state.bookings) {
      const lead = daysDiff(b.createdAt, b.checkIn);
      const bucket = leadTimeBucket(lead);
      if (!buckets.has(bucket)) buckets.set(bucket, { total: 0, cancelled: 0 });
      const st = buckets.get(bucket)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(buckets.entries()).map(([bucket, st]) => ({
      bucket,
      total: st.total,
      cancelled: st.cancelled,
      cancelRate: st.total ? Math.round((st.cancelled / st.total) * 100) : 0,
    }));
  }, [state.bookings]);

  const promoStats = useMemo(() => {
    const withPromo = { total: 0, cancelled: 0 };
    const withoutPromo = { total: 0, cancelled: 0 };
    for (const b of state.bookings) {
      const hasPromo = String(b.promoCode || "").trim().length > 0;
      const target = hasPromo ? withPromo : withoutPromo;
      target.total += 1;
      if (b.status === "Cancelled") target.cancelled += 1;
    }
    const withRate = withPromo.total ? Math.round((withPromo.cancelled / withPromo.total) * 100) : 0;
    const withoutRate = withoutPromo.total ? Math.round((withoutPromo.cancelled / withoutPromo.total) * 100) : 0;
    return { withPromo, withoutPromo, withRate, withoutRate };
  }, [state.bookings]);

  const bestHotels = useMemo(() => {
    const map = new Map<string, { hotelId: string; name: string; total: number; cancelled: number }>();
    for (const b of state.bookings) {
      const key = b.hotelId || b.hotelNameSnapshot || "Unknown";
      if (!map.has(key))
        map.set(key, {
          hotelId: b.hotelId || "",
          name: b.hotelNameSnapshot || b.hotelId || "Unknown",
          total: 0,
          cancelled: 0,
        });
      const st = map.get(key)!;
      st.total += 1;
      if (b.status === "Cancelled") st.cancelled += 1;
    }
    return Array.from(map.values())
      .map((h) => ({
        ...h,
        cancelRate: h.total ? Math.round((h.cancelled / h.total) * 100) : 0,
      }))
      .filter((h) => h.total >= 2)
      .sort((a, b) => a.cancelRate - b.cancelRate || b.total - a.total)
      .slice(0, 8);
  }, [state.bookings]);

  const riskyAccounts = useMemo(() => {
    return model.derivedAccounts
      .map((a: any) => {
        const risk =
          (a.cancelledBookings || 0) * 2 +
          (a.consecutiveCancelled || 0) * 3 +
          (!String(a.password || "").trim() ? 3 : 0) +
          (!a.cooldownOk ? 2 : 0);
        return { ...a, risk };
      })
      .sort((a: any, b: any) => b.risk - a.risk)
      .slice(0, 8);
  }, [model.derivedAccounts]);

  const recommendedPairs = useMemo(() => {
    const accounts = model.accountsReady.slice(0, 6);
    const hotels = model.hotelsEligible.slice(0, 6);
    const pairs: Array<{ email: string; hotel: string }> = [];
    for (let i = 0; i < Math.max(accounts.length, hotels.length); i++) {
      const acc = accounts[i % accounts.length];
      const hot = hotels[i % hotels.length];
      if (acc && hot) pairs.push({ email: acc.email, hotel: hot.name || hot.hotelId });
    }
    return pairs.slice(0, 6);
  }, [model.accountsReady, model.hotelsEligible]);

  // --------- MUTATIONS ----------
  const setSettings = (patch: any) => setState((prev: any) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  const handleExport = () => {
    const payload = exportStateByEmail(state);
    downloadJSON(`ops-dash-export-${todayISO()}.json`, payload);
    pushToast("ok", "Exported", "JSON export generated.");
  };

  const handleImport = (payload: any) => {
    if (!payload || !Array.isArray(payload.accounts)) {
      throw new Error("Invalid import format: missing accounts.");
    }
    const nextState = {
      ...state,
      settings: payload.settings || state.settings,
      hotels: Array.isArray(payload.hotels) ? payload.hotels : state.hotels,
      database: payload.accounts.map((a: any) => {
        const { bookings, sales, ...rest } = a || {};
        return rest;
      }),
      bookings: payload.accounts.flatMap((a: any) => a.bookings || []),
      sales: payload.accounts.flatMap((a: any) => a.sales || []),
    };
    setState(nextState);
    pushToast("ok", "Imported", "Database restored from JSON.");
  };

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
      const { parsed, errors } = parsePaste(text, getRewardTypes(prev.settings));
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
            next.database.push({
              email: row.email,
              password: "",
              manualStatus: "Активен",
              notes: "AUTO_CREATED_FROM_IMPORT",
              createdAt: todayISO(),
            });
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
          rewardCurrency: row.rewardCurrency || "USD",
          rewardType: row.rewardType || "Booking",
          airline: row.airline || "",
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
          const a = {
            email: r.email,
            password: r.password || "",
            manualStatus: "Активен",
            notes: "RAW_DATA_IMPORT",
            createdAt: todayISO(),
          };
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
      { name: "Pending", value: model.statusCounts.Pending || 0, fill: "#94A3B8" },
      { name: "Confirmed", value: model.statusCounts.Confirmed || 0, fill: COLORS.success },
      { name: "Completed", value: model.statusCounts.Completed || 0, fill: COLORS.gold },
      { name: "Cancelled", value: model.statusCounts.Cancelled || 0, fill: COLORS.danger },
    ];

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <StatCard theme={themeMode} title="Total Net Balance" value={money(totals.totalNet)} subValue="Bonuses − Sales" icon={Wallet} />
          <StatCard theme={themeMode} title="Total Bookings" value={totals.totalBookings} subValue="All statuses" icon={BookOpen} onClick={() => setActiveTab("bookings")} />
          <StatCard theme={themeMode} title="Accounts Ready" value={model.accountsReady.length} subValue="Passed all rules" icon={Zap} onClick={() => setActiveTab("next_action")} />
          <StatCard theme={themeMode} title="Missing Passwords" value={totals.missingPasswords} subValue="Needs RawData" icon={Database} onClick={() => setActiveTab("rawdata")} />
          <StatCard theme={themeMode} title="Blocked Accounts" value={totals.blocked} subValue="Manual + TECH" icon={ShieldAlert} onClick={() => setActiveTab("database")} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className={`xl:col-span-2 ${theme.panel} rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-lg ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>Net Trend</h3>
              <div className="flex items-center gap-2 text-xs">
                {[30, 50, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTrendDays(d)}
                    className={`px-2.5 py-1 rounded-full border ${
                      trendDays === d ? "border-blue-500 text-blue-500" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={theme.tooltip} />
                  <Area type="monotone" dataKey="net" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className={`font-bold text-lg mb-4 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>Booking Status Mix</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} stroke="none">
                    {statusData.map((x: any, i: number) => (
                      <Cell key={i} fill={x.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={theme.tooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Accounts Registered (per day)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={theme.tooltip} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#60A5FA" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Rewards Earned (per day)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rewardTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={theme.tooltip} />
                  <Area type="monotone" dataKey="total" stroke="#10B981" fill="#10B98120" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Spent (per day)</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={theme.tooltip} />
                  <Area type="monotone" dataKey="total" stroke="#F59E0B" fill="#F59E0B20" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={`${theme.panel} rounded-2xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Hotels by Chain (Cancelled vs Other)</h3>
              <p className="text-xs text-slate-500">Top 12 chains by volume • stacked bars</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chainStats}
                layout="vertical"
                barSize={14}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} horizontal={false} />
                <XAxis type="number" stroke={theme.axis} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="chain" stroke={theme.axis} axisLine={false} tickLine={false} width={120} />
                <RechartsTooltip contentStyle={theme.tooltip} />
                <Bar
                  dataKey="other"
                  stackId="a"
                  fill="#3B82F6"
                  radius={[0, 6, 6, 0]}
                  onClick={(data: any) => {
                    if (!data?.payload?.chain) return;
                    setChainModalName(data.payload.chain);
                    setChainModalOpen(true);
                  }}
                />
                <Bar
                  dataKey="cancelled"
                  stackId="a"
                  fill="#EF4444"
                  radius={[0, 6, 6, 0]}
                  onClick={(data: any) => {
                    if (!data?.payload?.chain) return;
                    setChainModalName(data.payload.chain);
                    setChainModalOpen(true);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Lead Time vs Cancel Rate</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTimeStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="bucket" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={theme.tooltip} />
                  <Bar dataKey="cancelRate" radius={[6, 6, 0, 0]} fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-slate-500">Cancel rate (%) by days between booking and check-in.</div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Promo vs No-Promo Cancels</h3>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>With Promo</span>
                <span className="font-mono text-rose-300">{promoStats.withRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-rose-500/60" style={{ width: `${promoStats.withRate}%` }} />
              </div>
              <div className="flex items-center justify-between mt-4">
                <span>No Promo</span>
                <span className="font-mono text-emerald-300">{promoStats.withoutRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500/60" style={{ width: `${promoStats.withoutRate}%` }} />
              </div>
            </div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Chain Reliability</h3>
            <div className="space-y-2 text-xs text-slate-600">
              {chainReliability.slice(0, 6).map((c) => (
                <div key={c.chain} className="flex items-center justify-between">
                  <span className="truncate">{c.chain}</span>
                  <span className={`font-mono ${c.cancelRate >= 30 ? "text-rose-300" : "text-emerald-300"}`}>
                    {c.cancelRate}% ({c.cancelled}/{c.total})
                  </span>
                </div>
              ))}
              {chainReliability.length === 0 && <div className="text-slate-500">No chain data.</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className={`${theme.panel} rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-900">Best Hotels</h3>
              <button
                onClick={() => setBestHotelMode(bestHotelMode === "cancellations" ? "spend" : "cancellations")}
                className="px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-600"
              >
                {bestHotelMode === "cancellations" ? "By spend + low cancels" : "By low cancels"}
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              {(bestHotelMode === "cancellations" ? bestHotels : bestHotelsBySpend).map((h: any) => (
                <div key={`${h.hotelId}-${h.name}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">{h.name}</span>
                  <span className={`font-mono ${h.cancelRate >= 25 ? "text-rose-300" : "text-emerald-300"}`}>
                    {h.cancelRate}% ({h.cancelled}/{h.total})
                  </span>
                </div>
              ))}
              {(bestHotelMode === "cancellations" ? bestHotels : bestHotelsBySpend).length === 0 && (
                <div className="text-slate-500">Not enough data yet.</div>
              )}
            </div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Risky Accounts</h3>
            <div className="space-y-2 text-xs text-slate-600">
              {riskyAccounts.map((a: any) => (
                <div key={a.emailKey} className="flex items-center justify-between gap-3">
                  <span className="truncate">{a.email}</span>
                  <span className={`font-mono ${a.risk >= 6 ? "text-rose-300" : "text-amber-300"}`}>
                    risk {a.risk}
                  </span>
                </div>
              ))}
              {riskyAccounts.length === 0 && <div className="text-slate-500">No accounts.</div>}
            </div>
          </div>

          <div className={`${theme.panel} rounded-2xl p-6`}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Recommended Next Actions</h3>
            <div className="space-y-2 text-xs text-slate-600">
              {recommendedPairs.map((p, idx) => (
                <div key={`${p.email}-${idx}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">{p.email}</span>
                  <span className="text-slate-500">→</span>
                  <span className="truncate">{p.hotel}</span>
                </div>
              ))}
              {recommendedPairs.length === 0 && <div className="text-slate-500">No eligible pairs yet.</div>}
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
          <h2 className="text-2xl font-bold text-slate-900">Database (Accounts)</h2>
          <p className="text-xs text-slate-500">
            Passwords приходят из <b>RawData</b>. Ручной статус <b>Блок</b> — global kill-switch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 flex items-center gap-2">
            <input type="checkbox" checked={dbOnlyMissing} onChange={(e) => setDbOnlyMissing((e.target as HTMLInputElement).checked)} />
            only emails without passwords
          </label>
          <button
            onClick={() => downloadCSV("database.csv", state.database)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold inline-flex items-center gap-2"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className={`${theme.panel} rounded-2xl overflow-hidden shadow-xl`}>
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-slate-500">
            <thead className="bg-white text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Password</th>
                <th className="px-6 py-4">Manual Status</th>
                <th className="px-6 py-4">Metrics</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {model.derivedAccounts
                .filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true))
                .filter((a: any) => (dbOnlyMissing ? !String(a.password || "").trim() : true))
                .map((a: any) => {
                  const missing = !String(a.password || "").trim();
                  return (
                    <tr key={a.emailKey} className={`hover:bg-slate-50 ${missing ? "bg-rose-500/5" : ""}`}>
                      <td className="px-6 py-4 align-top">
                        <div className="text-slate-900 font-bold">{a.email}</div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => copyToClipboard(a.email)} className="text-xs text-blue-400 hover:text-blue-300">Copy Email</button>
                          <button onClick={() => copyToClipboard(a.password || "")} className="text-xs text-blue-400 hover:text-blue-300">Copy Pass</button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!a.isBlocked ? <Badge themeMode={themeMode} kind="active">ACTIVE</Badge> : <Badge themeMode={themeMode} kind="block">BLOCK</Badge>}
                          {a.techBlocked && <Badge themeMode={themeMode} kind="tech">TECH</Badge>}
                          {a.tier === "Gold" && <Badge themeMode={themeMode} kind="gold">GOLD</Badge>}
                          {a.tier === "Platinum" && <Badge themeMode={themeMode} kind="plat">PLAT</Badge>}
                          {a.canAddBooking ? <Badge themeMode={themeMode} kind="active">READY</Badge> : <Badge themeMode={themeMode} kind="dim">NOT READY</Badge>}
                          {missing && <Badge themeMode={themeMode} kind="block">NO PASS</Badge>}
                        </div>
                        {a.blockReason && <div className="mt-2 text-xs text-rose-300">{a.blockReason}</div>}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <input
                          className={`bg-white border rounded px-2 py-1 text-slate-700 w-full text-xs font-mono ${
                            missing ? "border-rose-500/40" : "border-slate-200"
                          }`}
                          value={a.password || ""}
                          onChange={(e) => upsertDatabaseRow(a.email, { password: e.target.value })}
                          placeholder="password"
                        />
                        {missing && <div className="mt-2 text-xs text-rose-300">Password not found → add in RawData</div>}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <select
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-900 text-xs w-full"
                          value={a.manualStatus}
                          onChange={(e) => upsertDatabaseRow(a.email, { manualStatus: e.target.value })}
                        >
                          <option value="Активен">Активен</option>
                          <option value="Блок">Блок</option>
                        </select>
                      </td>

                      <td className="px-6 py-4 align-top text-xs text-slate-600">
                        <div className="flex justify-between"><span className="text-slate-500">Bookings</span><span className="font-bold">{a.totalBookings}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Confirmed</span><span>{a.confirmedBookings}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Cancelled</span><span>{a.cancelledBookings}</span></div>
                        <div className="flex justify-between mt-2"><span className="text-slate-500">Balance</span><span className="font-mono">{money(a.netBalance)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Active</span><span>{a.activeBookingsCount}/{state.settings.maxActiveBookings}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Cooldown</span><span>{a.cooldownOk ? "OK" : `${a.daysSinceLastBooking ?? "?"}d`}</span></div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <input
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-full text-xs"
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
    const isSheet = activeTab === "sheet";
    const missing = model.derivedAccounts.filter((a: any) => !String(a.password || "").trim());
    const rows = model.derivedAccounts
      .filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true))
      .filter((a: any) => (rawOnlyMissing ? !String(a.password || "").trim() : true));
    const cancelled = model.statusCounts.Cancelled || 0;
    const other = (model.statusCounts.Pending || 0) + (model.statusCounts.Confirmed || 0) + (model.statusCounts.Completed || 0);
    const duplicateMap = useMemo(() => {
      const map = new Map<string, any[]>();
      for (const a of state.database) {
        const key = safeLower(a.email);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
      }
      return map;
    }, [state.database]);

    const copyMissingEmails = async () => {
      const payload = missing.map((a: any) => a.email).join("\n");
      await copyToClipboard(payload);
      pushToast("ok", "Copied", `${missing.length} emails without passwords.`);
    };

    return (
      <div className="space-y-6">
        <div className={`${theme.panel} rounded-2xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-lg">Bookings Status (Cancelled vs Other)</h3>
            <div className="text-xs text-slate-500">{cancelled + other} total</div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[{ name: "Bookings", cancelled, other }]}
                margin={{ left: 0, right: 12 }}
                barSize={36}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis dataKey="name" stroke={theme.axis} axisLine={false} tickLine={false} />
                <YAxis stroke={theme.axis} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={theme.tooltip} />
                <Bar dataKey="other" stackId="a" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cancelled" stackId="a" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${theme.panel} rounded-2xl p-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Sheet size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Dashboard — RawData (accounts: email + password)
                </h3>
                <p className="text-xs text-slate-500">
                  Вставляй сюда все аккаунты: <span className="font-mono">email&lt;TAB&gt;password</span>. Пароли автоматически обновятся во всех бордах.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-500 flex items-center gap-2">
                <input type="checkbox" checked={rawOnlyMissing} onChange={(e) => setRawOnlyMissing((e.target as HTMLInputElement).checked)} />
                show emails without passwords
              </label>
              <button
                onClick={() => {
                  setState((prev: any) => {
                    const seen = new Set<string>();
                    const nextDb = [];
                    for (const row of prev.database) {
                      const key = safeLower(row.email);
                      if (seen.has(key)) continue;
                      seen.add(key);
                      nextDb.push(row);
                    }
                    return { ...prev, database: nextDb };
                  });
                  pushToast("ok", "Duplicates removed", "Kept the first entry per email.");
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold"
              >
                Delete duplicates
              </button>
              <button
                onClick={copyMissingEmails}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold"
              >
                Copy missing emails ({missing.length})
              </button>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:border-indigo-500 outline-none min-h-[120px]"
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
                <div className="text-slate-500">
                  Last raw import: <b className="text-slate-700">{new Date(state.lastRawImport.at).toLocaleString()}</b> • Rows{" "}
                  <b className="text-slate-700">{state.lastRawImport.rows}</b> • Updated{" "}
                  <b className="text-slate-700">{state.lastRawImport.updated}</b> • Created{" "}
                  <b className="text-slate-700">{state.lastRawImport.created}</b> • Errors{" "}
                  <b className="text-amber-300">{state.lastRawImport.errors}</b>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        <div className={`${theme.panel} rounded-2xl overflow-hidden shadow-xl`}>
          <div className="p-4 border-b border-slate-200 font-bold text-slate-900 flex justify-between items-center">
            <span>RawData — Accounts</span>
            <span className="text-slate-500 text-sm font-normal">{rows.length} rows</span>
          </div>

          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left text-sm text-slate-500">
              <thead className="bg-white text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Duplicate</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((a: any) => {
                  const missingPass = !String(a.password || "").trim();
                  const duplicates = duplicateMap.get(a.emailKey) || [];
                  const isDup = duplicates.length > 1;
                  const hasDifferentPass = isDup && new Set(duplicates.map((d) => String(d.password || ""))).size > 1;
                  return (
                    <tr key={a.emailKey} className={`hover:bg-slate-50 ${missingPass ? "bg-rose-500/5" : ""}`}>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-semibold">{a.email}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        <input
                          value={a.password || ""}
                          onChange={(e) => upsertDatabaseRow(a.email, { password: e.target.value })}
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs w-48"
                          placeholder="password"
                        />
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {isDup ? (
                          <span className={`px-2 py-1 rounded-full border ${hasDifferentPass ? "border-rose-300 text-rose-600" : "border-amber-300 text-amber-600"}`}>
                            {hasDifferentPass ? "DUPLICATE (diff pass)" : "DUPLICATE"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {missingPass ? <Badge themeMode={themeMode} kind="block">NO PASS</Badge> : <Badge themeMode={themeMode} kind="active">OK</Badge>}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => pushToast("ok", "Saved", "Password updated.")}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            Save
                          </button>
                          {isDup && (
                            <>
                              <button
                                onClick={() => {
                                  setState((prev: any) => ({
                                    ...prev,
                                    database: prev.database.filter((d: any, idx: number) => {
                                      if (safeLower(d.email) !== a.emailKey) return true;
                                      return idx === prev.database.findIndex((x: any) => safeLower(x.email) === a.emailKey);
                                    }),
                                  }));
                                }}
                                className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                Keep First
                              </button>
                              <button
                                onClick={() => {
                                  setState((prev: any) => ({
                                    ...prev,
                                    database: prev.database.filter((d: any) => {
                                      if (safeLower(d.email) !== a.emailKey) return true;
                                      return String(d.password || "").trim() === String(a.password || "").trim();
                                    }),
                                  }));
                                }}
                                className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                Keep This
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No rows.</td></tr>
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
          <h2 className="text-2xl font-bold text-slate-900">Hotels</h2>
          <p className="text-xs text-slate-500">Отели создаются автоматически из Smart Import. TECH block: cancelled ≥ {state.settings.hotelTechBlockTotal}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setHotelTopRatedOnly(true);
              setHotelCancelledMax("0");
            }}
            className="px-3 py-2 rounded-xl border border-emerald-200 text-emerald-600 text-xs font-bold hover:bg-emerald-50"
          >
            Top Rated
          </button>
          <button
            onClick={() => downloadCSV("hotels.csv", state.hotels)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold inline-flex items-center gap-2"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className={`${theme.panel} rounded-2xl overflow-hidden shadow-xl`}>
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Min Confirmed</span>
            <input
              value={hotelConfirmedMin}
              onChange={(e) => setHotelConfirmedMin((e.target as HTMLInputElement).value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Max Cancelled</span>
            <input
              value={hotelCancelledMax}
              onChange={(e) => setHotelCancelledMax((e.target as HTMLInputElement).value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-20"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hotelTopRatedOnly}
              onChange={(e) => setHotelTopRatedOnly((e.target as HTMLInputElement).checked)}
            />
            only 0 cancellations
          </label>
        </div>
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-slate-500">
            <thead className="bg-white text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Hotel</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Stats</th>
                <th className="px-6 py-4">Spent</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {model.derivedHotels
                .filter((h: any) =>
                  searchTerm
                    ? safeLower(h.name).includes(safeLower(searchTerm)) || String(h.hotelId).includes(searchTerm)
                    : true
                )
                .filter((h: any) => {
                  const minConfirmed = hotelConfirmedMin ? Number(hotelConfirmedMin) : null;
                  const maxCancelled = hotelCancelledMax ? Number(hotelCancelledMax) : null;
                  if (minConfirmed !== null && !Number.isNaN(minConfirmed) && (h.confirmed || 0) < minConfirmed) return false;
                  if (maxCancelled !== null && !Number.isNaN(maxCancelled) && (h.cancelled || 0) > maxCancelled) return false;
                  if (hotelTopRatedOnly && (h.cancelled || 0) > 0) return false;
                  return true;
                })
                .sort((a: any, b: any) => b.totalBookings - a.totalBookings)
                .map((h: any) => (
                  <tr key={h.hotelId} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-bold">{h.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{h.hotelId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {!h.isBlocked ? <Badge themeMode={themeMode} kind="active">OK</Badge> : <Badge themeMode={themeMode} kind="block">BLOCK</Badge>}
                        {h.techBlocked && <Badge themeMode={themeMode} kind="tech">TECH</Badge>}
                        {h.manualBlocked && <Badge themeMode={themeMode} kind="block">MANUAL</Badge>}
                      </div>
                      {h.blockReason && <div className="mt-2 text-xs text-rose-300">{h.blockReason}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">{h.totalBookings}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Confirmed</span><span>{h.confirmed}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Cancelled</span><span>{h.cancelled}</span></div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-700">{money(h.spent || 0)}</td>
                    <td className="px-6 py-4">
                      <input
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-full text-xs"
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

  const SpentView = () => {
    const [form, setForm] = useState({ date: todayISO(), email: "", amount: "", note: "" });
    const [amountFilter, setAmountFilter] = useState("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const addSpent = () => {
      if (!isISODateLike(form.date) || !form.email || !form.email.includes("@") || !isNumericLike(form.amount)) {
        pushToast("warn", "Invalid spend entry", "Use date/email/amount.");
        return;
      }
      setState((prev: any) => {
        const next = { ...prev, sales: [...prev.sales], audit: [...(prev.audit || [])] };
        next.sales.push({
          id: uid(),
          date: form.date,
          email: safeLower(form.email),
          amount: parseMoney(form.amount),
          note: form.note || "",
        });
        next.audit.push({ id: uid(), at: nowISO(), type: "SPENT_ADD", msg: `Spent added: ${form.email} / ${form.amount}` });
        next.audit = next.audit.slice(-400);
        return next;
      });
      setForm({ date: todayISO(), email: "", amount: "", note: "" });
      pushToast("ok", "Spent added");
    };

    const ingestSpent = (text: string) => {
      let summary: any = null;
      setState((prev: any) => {
        const { rows, errors } = parseSpentPaste(text);
        const next = { ...prev, sales: [...prev.sales], audit: [...(prev.audit || [])] };
        const now = nowISO();
        let added = 0;
        for (const r of rows) {
          next.sales.push({ id: uid(), date: r.date, email: r.email, amount: r.amount, note: r.note });
          added += 1;
          next.audit.push({ id: uid(), at: now, type: "SPENT_ADD", msg: `Spent added: ${r.email} / ${r.amount}` });
        }
        for (const e of errors) {
          next.audit.push({ id: uid(), at: now, type: "SPENT_PARSE_ERROR", msg: `Spent parse error line ${e.line}: ${e.raw}` });
        }
        next.audit = next.audit.slice(-400);
        summary = { added, errors: errors.length };
        return next;
      });
      if (summary) {
        pushToast(summary.errors ? "warn" : "ok", "Spent import", `Added ${summary.added}. Errors ${summary.errors}.`);
      }
    };

    const minAmount = amountFilter ? Number(amountFilter) : null;
    const rows = [...state.sales]
      .filter((s: any) => (minAmount === null || Number.isNaN(minAmount) ? true : Number(s.amount || 0) >= minAmount))
      .sort((a: any, b: any) => {
        const diff = Number(a.amount || 0) - Number(b.amount || 0);
        return sortDir === "asc" ? diff : -diff;
      });

    return (
      <div className="space-y-6">
        <div className={`${theme.panel} rounded-2xl p-6 space-y-4`}>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Dashboard — Spent</h3>
            <p className="text-xs text-slate-500">Добавляй траты: дата, email, сумма, заметка.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: (e.target as HTMLInputElement).value }))}
              className="bg-white border border-slate-200 rounded px-3 py-2 text-slate-700 text-xs"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: (e.target as HTMLInputElement).value }))}
              placeholder="email"
              className="bg-white border border-slate-200 rounded px-3 py-2 text-slate-700 text-xs"
            />
            <input
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: (e.target as HTMLInputElement).value }))}
              placeholder="amount"
              className="bg-white border border-slate-200 rounded px-3 py-2 text-slate-700 text-xs"
            />
            <input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: (e.target as HTMLInputElement).value }))}
              placeholder="note"
              className="bg-white border border-slate-200 rounded px-3 py-2 text-slate-700 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addSpent}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold"
            >
              Add Spent
            </button>
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              <span>Min amount</span>
              <input
                value={amountFilter}
                onChange={(e) => setAmountFilter((e.target as HTMLInputElement).value)}
                placeholder="0"
                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-24"
              />
              <button
                onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600"
              >
                Sort {sortDir === "asc" ? "▲" : "▼"}
              </button>
            </div>
          </div>

          <div>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:border-amber-500 outline-none min-h-[120px]"
              placeholder={"PASTE HERE (tab-separated):\n2025-03-01\temail@example.com\t25\tTaxi"}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                ingestSpent(text);
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  const t = (e.currentTarget as HTMLTextAreaElement).value;
                  if (t && t.trim()) ingestSpent(t);
                  (e.currentTarget as HTMLTextAreaElement).value = "";
                }
              }}
            />
          </div>
        </div>

        <div className={`${theme.panel} rounded-2xl overflow-hidden shadow-xl`}>
          <div className="p-4 border-b border-slate-200 font-bold text-slate-900 flex justify-between items-center">
            <span>Spent — Log</span>
            <span className="text-slate-500 text-sm font-normal">{rows.length} rows</span>
          </div>
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left text-sm text-slate-500">
              <thead className="bg-white text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        value={s.date || ""}
                        onChange={(e) => {
                          const date = (e.target as HTMLInputElement).value;
                          setState((prev: any) => {
                            const next = { ...prev, sales: [...prev.sales] };
                            const idx = next.sales.findIndex((x: any) => x.id === s.id);
                            if (idx >= 0) next.sales[idx] = { ...next.sales[idx], date };
                            return next;
                          });
                        }}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        value={s.email || ""}
                        onChange={(e) => {
                          const email = safeLower((e.target as HTMLInputElement).value);
                          setState((prev: any) => {
                            const next = { ...prev, sales: [...prev.sales] };
                            const idx = next.sales.findIndex((x: any) => x.id === s.id);
                            if (idx >= 0) next.sales[idx] = { ...next.sales[idx], email };
                            return next;
                          });
                        }}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs w-52"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        value={s.amount ?? ""}
                        onChange={(e) => {
                          const amount = parseMoney((e.target as HTMLInputElement).value);
                          setState((prev: any) => {
                            const next = { ...prev, sales: [...prev.sales] };
                            const idx = next.sales.findIndex((x: any) => x.id === s.id);
                            if (idx >= 0) next.sales[idx] = { ...next.sales[idx], amount };
                            return next;
                          });
                        }}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs w-24"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        value={s.note || ""}
                        onChange={(e) => {
                          const note = (e.target as HTMLInputElement).value;
                          setState((prev: any) => {
                            const next = { ...prev, sales: [...prev.sales] };
                            const idx = next.sales.findIndex((x: any) => x.id === s.id);
                            if (idx >= 0) next.sales[idx] = { ...next.sales[idx], note };
                            return next;
                          });
                        }}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs w-full"
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500">No spent entries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const BookingsView = () => {
    const accountByEmail = new Map(model.derivedAccounts.map((a: any) => [a.emailKey, a]));
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
      .filter((b: any) =>
        bookingTypeFilter === "ALL"
          ? true
          : normalizeRewardType(b.rewardType, getRewardTypes(state.settings)) === bookingTypeFilter
      )
      .filter((b: any) => (bookingMissingPaidFilter ? !String(b.rewardPaidOn || "").trim() : true))
      .filter((b: any) => {
        if (!bookingMissingPasswordFilter) return true;
        const account = accountByEmail.get(safeLower(b.email));
        return !String(account?.password || "").trim();
      });

    return (
      <div className="space-y-6">
        {/* SMART IMPORT — SINGLE ENTRY POINT */}
        <div className={`${theme.panel} rounded-2xl p-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <ClipboardList size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Bookings — Smart Import (paste = commit)</h3>
                <p className="text-xs text-slate-500">
                  Вставляешь строки из Google Sheets → они сразу попадают в лог, создают Account/Hotel при необходимости и запускают перерасчёт.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadCSV("bookings.csv", state.bookings)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold inline-flex items-center gap-2"
              >
                <Download size={16} /> Export
              </button>
              <button
                onClick={() => setAuditOpen(true)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold inline-flex items-center gap-2"
              >
                <History size={16} /> Audit
              </button>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:border-blue-500 outline-none min-h-[120px]"
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
                  Auto-create Accounts/Hotels: <b className="text-slate-600">{state.settings.autoCreateFromImport ? "ON" : "OFF"}</b> • Auto-write TECH blocks:{" "}
                  <b className="text-slate-600">{state.settings.autoWriteTechBlocks ? "ON" : "OFF"}</b>
                </span>
              </div>
              {state.lastImport ? (
                <div className="text-slate-500">
                  Last import: <b className="text-slate-700">{new Date(state.lastImport.at).toLocaleString()}</b> • Added{" "}
                  <b className="text-slate-700">{state.lastImport.added}</b> • New Acc{" "}
                  <b className="text-slate-700">{state.lastImport.accCreated}</b> • New Hotels{" "}
                  <b className="text-slate-700">{state.lastImport.hotelCreated}</b> • Dup{" "}
                  <b className="text-slate-700">{state.lastImport.dupSkipped}</b> • Errors{" "}
                  <b className="text-amber-300">{state.lastImport.errors}</b>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        {/* BOOKINGS TABLE */}
        <div className={`${theme.panel} rounded-2xl overflow-hidden shadow-xl`}>
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div className="font-bold text-slate-900">Bookings Log (Google-like columns)</div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="text-slate-500">{filtered.length} / {state.bookings.length}</div>
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter((e.target as HTMLSelectElement).value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
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
                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
              >
                <option value="ALL">Type: ALL</option>
                {getRewardTypes(state.settings).map((t: any) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>

              <label className="text-slate-500 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bookingMissingPaidFilter}
                  onChange={(e) => setBookingMissingPaidFilter((e.target as HTMLInputElement).checked)}
                />
                missing RewardPaidOn
              </label>
              <label className="text-slate-500 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bookingMissingPasswordFilter}
                  onChange={(e) => setBookingMissingPasswordFilter((e.target as HTMLInputElement).checked)}
                />
                missing password
              </label>
              <button
                onClick={() => setBookingEditMode((s) => !s)}
                className="px-3 py-2 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold"
              >
                Action: {bookingEditMode ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => {
                  const map = new Map<string, any[]>();
                  for (const b of state.bookings) {
                    const key = `${String(b.bookingNo)}::${String(b.pin || "").padStart(4, "0")}`;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(b);
                  }
                  const dup = Array.from(map.values()).filter((list) => list.length > 1);
                  setBookingDupRows(dup.flat());
                  setBookingDupOpen(true);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold"
              >
                Check duplicates
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[72vh]">
            <table className="w-full text-left text-sm text-slate-500">
              <thead className="bg-white text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">AccountID</th>
                  <th className="px-6 py-4">BookingNo</th>
                  <th className="px-6 py-4">PIN</th>
                  <th className="px-6 py-4">Hotel</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Cost</th>
                  <th className="px-6 py-4">CheckIn</th>
                  <th className="px-6 py-4">CheckOut</th>
                  <th className="px-6 py-4">Reward</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Airline</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Stat</th>
                  <th className="px-6 py-4">LEVEL</th>
                  <th className="px-6 py-4">Reward paid on</th>
                  <th className="px-6 py-4">Reward ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((b: any) => {
                  const eta = computeRewardETA(b, state.settings);
                  const paidMissing = !String(b.rewardPaidOn || "").trim();
                  const account = accountByEmail.get(safeLower(b.email));
                  const cancelled = account?.cancelledBookings || 0;
                  const positive = account?.positiveBookings || 0;
                  const missingPassword = !String(account?.password || "").trim();
                  return (
                    <tr
                      key={b.bookingId}
                      className={`hover:bg-slate-50 ${paidMissing ? "bg-amber-500/5" : ""} ${
                        missingPassword ? "ring-1 ring-rose-500/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4">{b.createdAt}</td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${missingPassword ? "text-rose-200" : "text-slate-900"}`}>{b.email}</div>
                        {missingPassword && <div className="text-xs text-rose-400 mt-1">no password</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700">{b.bookingNo}</td>
                      <td className="px-6 py-4 font-mono">{String(b.pin || "").padStart(4, "0")}</td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-medium">{b.hotelNameSnapshot}</div>
                        <div className="text-xs text-slate-500 font-mono">{b.hotelId}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {missingPassword ? <span className="text-rose-300">—</span> : account?.password}
                      </td>
                      <td className="px-6 py-4 font-mono">{money(b.cost)}</td>
                      <td className="px-6 py-4">{b.checkIn}</td>
                      <td className="px-6 py-4">{b.checkOut}</td>
                      <td className="px-6 py-4 font-mono text-slate-700">
                        {bookingEditMode ? (
                          <div className="flex items-center gap-2">
                            <input
                              defaultValue={b.rewardAmount}
                              onBlur={(e) => {
                                const rewardAmount = parseMoney((e.target as HTMLInputElement).value);
                                setState((prev: any) => {
                                  const next = { ...prev, bookings: [...prev.bookings], audit: [...(prev.audit || [])] };
                                  const idx = next.bookings.findIndex((x: any) => x.bookingId === b.bookingId);
                                  if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], rewardAmount };
                                  next.audit.push({ id: uid(), at: new Date().toISOString(), type: "BOOKING_UPDATE", msg: `Reward amount updated: ${b.email} / ${b.bookingNo} → ${rewardAmount}` });
                                  next.audit = next.audit.slice(-400);
                                  return next;
                                });
                              }}
                              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs w-24"
                            />
                            <select
                              defaultValue={b.rewardCurrency || "USD"}
                              onBlur={(e) => {
                                const rewardCurrency = (e.target as HTMLSelectElement).value;
                                setState((prev: any) => {
                                  const next = { ...prev, bookings: [...prev.bookings], audit: [...(prev.audit || [])] };
                                  const idx = next.bookings.findIndex((x: any) => x.bookingId === b.bookingId);
                                  if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], rewardCurrency };
                                  next.audit.push({ id: uid(), at: new Date().toISOString(), type: "BOOKING_UPDATE", msg: `Reward currency updated: ${b.email} / ${b.bookingNo} → ${rewardCurrency}` });
                                  next.audit = next.audit.slice(-400);
                                  return next;
                                });
                              }}
                              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs"
                            >
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="GBP">GBP</option>
                            </select>
                          </div>
                        ) : b.rewardAmount ? (
                          `${b.rewardCurrency || "USD"} ${Number(b.rewardAmount || 0).toFixed(2)}`
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {bookingEditMode ? (
                          <select
                            defaultValue={normalizeRewardType(b.rewardType || "Booking", getRewardTypes(state.settings))}
                            onBlur={(e) => {
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
                            className="bg-white border border-slate-200 rounded text-xs px-2 py-1 text-slate-600 outline-none"
                          >
                            {getRewardTypes(state.settings).map((t: any) => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-600">{normalizeRewardType(b.rewardType || "Booking", getRewardTypes(state.settings))}</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {bookingEditMode ? (
                          <input
                            defaultValue={b.airline || ""}
                            onBlur={(e) => {
                              const airline = (e.target as HTMLInputElement).value;
                              setState((prev: any) => {
                                const next = { ...prev, bookings: [...prev.bookings], audit: [...(prev.audit || [])] };
                                const idx = next.bookings.findIndex((x: any) => x.bookingId === b.bookingId);
                                if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], airline };
                                next.audit.push({ id: uid(), at: new Date().toISOString(), type: "BOOKING_UPDATE", msg: `Airline updated: ${b.email} / ${b.bookingNo} → ${airline || "CLEAR"}` });
                                next.audit = next.audit.slice(-400);
                                return next;
                              });
                            }}
                            placeholder="AA / Delta / Lufthansa"
                            className="bg-white border border-slate-200 rounded text-xs px-2 py-1 text-slate-600 outline-none w-40"
                          />
                        ) : (
                          <span className="text-slate-600">{b.airline || "—"}</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {bookingEditMode ? (
                          <select
                            defaultValue={b.status}
                            onBlur={(e) => {
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
                            className="bg-white border border-slate-200 rounded text-xs px-2 py-1 text-slate-600 outline-none"
                          >
                            <option>Pending</option>
                            <option>Confirmed</option>
                            <option>Completed</option>
                            <option>Cancelled</option>
                          </select>
                        ) : (
                          <div className="text-xs text-slate-600">{b.status}</div>
                        )}
                        <div className="mt-2">
                          {b.status === "Confirmed" ? (
                            <Badge themeMode={themeMode} kind="active">CONFIRMED</Badge>
                          ) : b.status === "Pending" ? (
                            <Badge themeMode={themeMode} kind="dim">PENDING</Badge>
                          ) : b.status === "Completed" ? (
                            <Badge themeMode={themeMode} kind="gold">COMPLETED</Badge>
                          ) : b.status === "Cancelled" ? (
                            <Badge themeMode={themeMode} kind="block">CANCELLED</Badge>
                          ) : (
                            <Badge themeMode={themeMode} kind="dim">{b.status}</Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono">
                        <span className="text-emerald-300">{positive}</span>
                        <span className="text-slate-600">/</span>
                        <span className={cancelled > 0 ? "text-rose-400" : "text-slate-500"}>{cancelled}</span>
                      </td>

                      <td className="px-6 py-4">{b.level || <span className="text-slate-600">—</span>}</td>

                      <td className="px-6 py-4">
                        {bookingEditMode ? (
                          <input
                            type="date"
                            defaultValue={b.rewardPaidOn || ""}
                            onBlur={(e) => {
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
                            className={`bg-white border rounded text-xs px-2 py-1 text-slate-600 outline-none ${
                              paidMissing ? "border-amber-500/40" : "border-slate-200"
                            }`}
                          />
                        ) : (
                          <span className="text-slate-600">{b.rewardPaidOn || "—"}</span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-slate-700">{eta || <span className="text-slate-600">—</span>}</td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-6 py-10 text-center text-slate-500">No bookings match current filters. Paste into Smart Import.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const RewardView = () => {
    const rows = rewardSummary.filter((r: any) =>
      searchTerm ? safeLower(r.email).includes(safeLower(searchTerm)) : true
    );

    return (
      <div className="space-y-6">
        <div className={`${theme.panel} rounded-2xl overflow-hidden shadow-xl`}>
          <div className="p-4 border-b border-slate-200 font-bold text-slate-900 flex justify-between items-center">
            <span>Reward — Accounts</span>
            <span className="text-slate-500 text-sm font-normal">{rows.length} rows</span>
          </div>
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-left text-sm text-slate-500">
              <thead className="bg-white text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Account</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Accumulated</th>
                  <th className="px-6 py-4">Last Reward</th>
                  <th className="px-6 py-4">Next Reward</th>
                  <th className="px-6 py-4">Days Left</th>
                  <th className="px-6 py-4">Potential</th>
                  <th className="px-6 py-4">Spent</th>
                  <th className="px-6 py-4">Rest</th>
                  <th className="px-6 py-4">Medal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r: any) => (
                  <tr key={r.email} className="hover:bg-slate-50 cursor-pointer" onClick={() => setRewardModalEmail(r.email)}>
                    <td className="px-6 py-4 text-slate-900 font-semibold">{r.email}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">{r.password || "—"}</td>
                    <td className="px-6 py-4 font-mono text-slate-700">{money(r.accumulated)}</td>
                    <td className="px-6 py-4 text-slate-700">{r.lastRewardAt || "—"}</td>
                    <td className="px-6 py-4 text-slate-700">{r.nextRewardAt || "—"}</td>
                    <td className="px-6 py-4 text-slate-700">{r.daysUntilNext ?? "—"}</td>
                    <td className="px-6 py-4 font-mono text-slate-700">{money(r.potential)}</td>
                    <td className="px-6 py-4 font-mono text-slate-700">{money(r.spent)}</td>
                    <td className="px-6 py-4 font-mono text-slate-700">{money(r.restAmount)}</td>
                    <td className="px-6 py-4 text-slate-700">{r.medal}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-slate-500">No reward data.</td>
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
    const minBalance = readyBalanceMin ? Number(readyBalanceMin) : null;
    const readyList = model.accountsReady
      .filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true))
      .filter((a: any) => (minBalance === null || Number.isNaN(minBalance) ? true : Number(a.netBalance || 0) >= minBalance));

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
        <div className={`${theme.panel} rounded-2xl overflow-hidden flex flex-col h-[78vh]`}>
          <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-start gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Accounts Ready</h3>
              <p className="text-xs text-slate-500">
                Active • Not Blocked • &lt; {state.settings.maxActiveBookings} active • Cooldown ≥ {state.settings.cooldownDays}d
              </p>
              <p className="text-[11px] text-slate-600 mt-1 font-mono">
                Quick export format: <span className="text-slate-500">email\tpassword</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNextActionMode("table")}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                    nextActionMode === "table"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  TABLE
                </button>
                <button
                  onClick={() => setNextActionMode("list")}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                    nextActionMode === "list"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                  className="px-3 py-2 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold"
                >
                  Copy Selected ({selectedCount})
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Min balance</span>
                <input
                  value={readyBalanceMin}
                  onChange={(e) => setReadyBalanceMin((e.target as HTMLInputElement).value)}
                  placeholder="0"
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-24"
                />
              </div>
            </div>
          </div>

          {nextActionMode === "table" ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-slate-500">
                <thead className="sticky top-0 bg-white text-xs uppercase font-medium text-slate-500">
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
                <tbody className="divide-y divide-slate-200">
                  {readyList.map((a: any) => {
                    const selected = !!readySelected[a.emailKey];
                    const canc = a.cancelledBookings || 0;
                    const pos = a.positiveBookings || 0;
                    return (
                      <tr
                        key={a.emailKey}
                        className={`hover:bg-slate-50 cursor-pointer ${selected ? "bg-blue-500/5" : ""}`}
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
                          <div className="text-slate-900 font-semibold">{a.email}</div>
                          <div className="text-[11px] text-slate-600">Bookings {a.totalBookings} • Tier {a.tier}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 text-xs">{a.password ? a.password : <span className="text-rose-300">—</span>}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{money(a.netBalance)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{a.activeBookingsCount}/{state.settings.maxActiveBookings}</td>
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
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl border border-slate-200"
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
              <table className="w-full text-left text-sm text-slate-500">
                <tbody className="divide-y divide-slate-200">
                  {readyList.map((a: any) => (
                    <tr key={a.emailKey} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-bold">{a.email}</div>
                        <div className="text-xs text-slate-500">Bookings {a.totalBookings} • Active {a.activeBookingsCount}/{state.settings.maxActiveBookings}</div>
                        <div className="text-xs text-slate-500">Balance {money(a.netBalance)} • Tier {a.tier} • Stat {a.positiveBookings}/{a.cancelledBookings}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => copyToClipboard(a.email)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl border border-slate-200">Copy Email</button>
                          <button onClick={() => copyToClipboard(a.password || "")} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl border border-slate-200">Copy Pass</button>
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

        <div className={`${theme.panel} rounded-2xl overflow-hidden flex flex-col h-[78vh]`}>
          <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Hotels Eligible</h3>
              <p className="text-xs text-slate-500">Confirmed &gt; 0 • Cancelled ≤ 2 • Not blocked</p>
            </div>
            <div className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20">
              {model.hotelsEligible.length} Eligible
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm text-slate-500">
              <tbody className="divide-y divide-slate-200">
                {model.hotelsEligible.map((h: any) => (
                  <tr key={h.hotelId} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-bold">{h.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{h.hotelId}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs">
                        <span className="text-emerald-400">{h.confirmed} Conf</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-rose-400">{h.cancelled} Canc</span>
                        <span className="text-slate-600 mx-1">•</span>
                        <span className="text-slate-700">{h.totalBookings} total</span>
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
    { id: "sheet", icon: Sheet, label: "Sheet" },
    { id: "hotels", icon: Building2, label: "Hotels" },
    { id: "spent", icon: Wallet, label: "Spent" },
    { id: "reward", icon: Wallet, label: "Reward" },
    { id: "next_action", icon: Activity, label: "Next Action" },
  ];

  return (
    <div className={`min-h-screen ${theme.bg} ${themeMode === "dark" ? "theme-dark" : "theme-light"} font-sans selection:bg-blue-500/30 flex`}>
      <style>{`
        .theme-dark .text-slate-900 { color: #E2E8F0; }
        .theme-dark .text-slate-700 { color: #CBD5F5; }
        .theme-dark .text-slate-600 { color: #94A3B8; }
        .theme-dark .text-slate-500 { color: #64748B; }
        .theme-dark .text-slate-400 { color: #94A3B8; }
        .theme-dark .text-slate-300 { color: #A8B3C7; }
        .theme-dark .bg-white { background-color: #121826; }
        .theme-dark .bg-slate-50 { background-color: #0F172A; }
        .theme-dark .border-slate-200 { border-color: #1E293B; }
        .theme-dark .hover\\:bg-slate-50:hover { background-color: #1E293B; }
      `}</style>
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-20 ${theme.sidebar} border-r flex flex-col items-center py-8 z-20`}>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mb-10 shadow-lg shadow-blue-500/20 flex items-center justify-center font-bold text-white text-xl">Ops</div>

        <nav className="flex flex-col gap-6 w-full">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 mx-auto rounded-xl transition-all duration-300 relative group ${
                activeTab === item.id
                  ? "bg-blue-600/10 text-blue-500"
                  : themeMode === "dark"
                  ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
              title={item.label}
            >
              <item.icon size={22} />
              {activeTab === item.id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-l-full" />}
              <div
                className={`absolute left-16 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border shadow-sm ml-2 ${
                  themeMode === "dark"
                    ? "bg-[#0B1220] border-slate-800 text-slate-200"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                {item.label}
              </div>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`p-3 mx-auto rounded-xl ${
              themeMode === "dark"
                ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Settings"
          >
            <Settings size={22} />
          </button>
          <button
            onClick={() => setAuditOpen(true)}
            className={`p-3 mx-auto rounded-xl ${
              themeMode === "dark"
                ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Audit"
          >
            <History size={22} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="pl-20 flex-1">
        <header className={`h-20 border-b ${theme.header} flex items-center justify-between px-8 backdrop-blur sticky top-0 z-10`}>
          <div>
            <h1 className={`text-xl font-bold flex items-center gap-2 uppercase tracking-wide ${theme.text}`}>{activeTab.replace("_", " ")}</h1>
            <p className={`text-xs font-mono mt-1 ${theme.textDim}`}>
              ACC: {state.database.length} • HOTELS: {state.hotels.length} • BOOKINGS: {state.bookings.length} • READY: {model.accountsReady.length}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${themeMode === "dark" ? "text-slate-500 group-focus-within:text-blue-400" : "text-slate-500 group-focus-within:text-blue-500"} transition-colors`} size={16} />
              <input
                type="text"
                placeholder="Global Search..."
                className={`rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-64 transition-all focus:w-96 shadow-sm ${theme.input}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
              />
            </div>

            <button
              onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
              className={`px-3 py-2 rounded-xl border text-sm font-bold inline-flex items-center gap-2 ${theme.button}`}
              title="Toggle theme"
            >
              {themeMode === "dark" ? "Light" : "Dark"}
            </button>
            <button
              onClick={handleExport}
              className={`px-3 py-2 rounded-xl border text-sm font-bold inline-flex items-center gap-2 shadow-sm ${theme.button}`}
            >
              <Download size={16} /> Export JSON
            </button>
            <button
              onClick={() => {
                setImportOpen(true);
                setImportError("");
                setImportPayload("");
              }}
              className={`px-3 py-2 rounded-xl border text-sm font-bold inline-flex items-center gap-2 shadow-sm ${theme.button}`}
            >
              Import JSON
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className={`px-3 py-2 rounded-xl border text-sm font-bold inline-flex items-center gap-2 shadow-sm ${theme.button}`}
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
          {activeTab === "sheet" && <RawDataView />}
          {activeTab === "hotels" && <HotelsView />}
          {activeTab === "spent" && <SpentView />}
          {activeTab === "reward" && <RewardView />}
          {activeTab === "next_action" && <NextActionView />}
        </div>
      </main>

      {/* Settings */}
      <Modal open={settingsOpen} title="Rules & Automation Settings" onClose={() => setSettingsOpen(false)} themeMode={themeMode}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { k: "goldThreshold", label: "Gold threshold ($)", type: "number" },
            { k: "platinumAfterDays", label: "Platinum after days", type: "number" },
            { k: "cooldownDays", label: "Cooldown days between bookings", type: "number" },
            { k: "maxActiveBookings", label: "Max active bookings per account", type: "number" },
            { k: "techBlockConsecutive", label: "Account TECH block streak", type: "number" },
            { k: "techBlockTotal", label: "Account TECH block total", type: "number" },
            { k: "hotelTechBlockTotal", label: "Hotel TECH block total", type: "number" },
          ].map((x: any) => (
            <div key={x.k} className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="text-xs text-slate-500 font-bold uppercase">{x.label}</div>
              <input
                type={x.type}
                className="mt-2 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-blue-500"
                value={state.settings[x.k]}
                onChange={(e) => setSettings({ [x.k]: Number((e.target as HTMLInputElement).value) })}
              />
            </div>
          ))}

          <div className="border border-slate-200 rounded-xl p-4 bg-white md:col-span-2">
            <div className="text-xs text-slate-500 font-bold uppercase mb-3">Booking Reward Types</div>
            <div className="space-y-2">
              {getRewardTypes(state.settings).map((t: any, idx: number) => (
                <div key={`${t.name}-${idx}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                  <input
                    value={t.name}
                    onChange={(e) => {
                      const name = (e.target as HTMLInputElement).value;
                      setSettings({
                        rewardTypes: getRewardTypes(state.settings).map((r: any, i: number) =>
                          i === idx ? { ...r, name } : r
                        ),
                      });
                    }}
                    placeholder="Type name"
                    className="md:col-span-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm"
                  />
                  <input
                    type="number"
                    value={t.days}
                    onChange={(e) => {
                      const days = Number((e.target as HTMLInputElement).value);
                      setSettings({
                        rewardTypes: getRewardTypes(state.settings).map((r: any, i: number) =>
                          i === idx ? { ...r, days } : r
                        ),
                      });
                    }}
                    placeholder="Days after CheckOut"
                    className="md:col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm"
                  />
                  <button
                    onClick={() => {
                      const next = getRewardTypes(state.settings).filter((_: any, i: number) => i !== idx);
                      setSettings({ rewardTypes: next.length ? next : DEFAULT_REWARD_TYPES.map((r) => ({ ...r })) });
                    }}
                    className="md:col-span-1 px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  setSettings({
                    rewardTypes: [...getRewardTypes(state.settings), { name: "NewType", days: 64 }],
                  });
                }}
                className="px-3 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm hover:bg-blue-50"
              >
                Add Type
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="text-xs text-slate-500 font-bold uppercase">Auto-create from import</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-700">Create missing accounts/hotels during paste</div>
              <input type="checkbox" checked={state.settings.autoCreateFromImport} onChange={(e) => setSettings({ autoCreateFromImport: (e.target as HTMLInputElement).checked })} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="text-xs text-slate-500 font-bold uppercase">Auto-write TECH blocks</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-700">When TECH triggers, force manual block</div>
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
            className="bg-blue-600 hover:bg-blue-500 text-slate-900 px-4 py-2 rounded-xl font-bold"
          >
            Done
          </button>
        </div>
      </Modal>

      <Modal open={importOpen} title="Import JSON (restore database)" onClose={() => setImportOpen(false)} themeMode={themeMode}>
        <div className="space-y-4">
          <div className="text-xs text-slate-500">
            Формат: экспорт из кнопки <b>Export JSON</b>. Можно вставить JSON или выбрать файл.
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setImportPayload(String(reader.result || ""));
                reader.readAsText(file);
              }}
              className="text-xs text-slate-500"
            />
            <button
              onClick={() => {
                try {
                  const parsed = JSON.parse(importPayload || "{}");
                  handleImport(parsed);
                  setImportOpen(false);
                } catch (err: any) {
                  setImportError(err?.message || "Import failed");
                }
              }}
              className="px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs font-bold"
            >
              Import now
            </button>
          </div>
          <textarea
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:border-indigo-500 outline-none min-h-[200px]"
            placeholder="Paste JSON export here..."
            value={importPayload}
            onChange={(e) => setImportPayload((e.target as HTMLTextAreaElement).value)}
          />
          {importError && <div className="text-xs text-rose-300">{importError}</div>}
        </div>
      </Modal>

      {/* Audit */}
      <Modal open={auditOpen} title="Audit Log (last 400 events)" onClose={() => setAuditOpen(false)} themeMode={themeMode}>
        <div className="text-xs text-slate-500 mb-3">Это твой “журнал операций”: импорты, RawData, автосоздания, дедупы, ошибки парсинга, авто-блоки.</div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-500">
              <thead className="sticky top-0 bg-white text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[...(state.audit || [])]
                  .slice()
                  .reverse()
                  .map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{new Date(e.at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{e.type}</td>
                      <td className="px-4 py-3 text-slate-700">{e.msg}</td>
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

      <Modal open={bookingDupOpen} title="Booking Duplicates (BookingNo + PIN)" onClose={() => setBookingDupOpen(false)} themeMode={themeMode}>
        <div className="text-xs text-slate-500 mb-3">Дубликаты по BookingNo и PIN (PIN приводится к 4 цифрам).</div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-500">
              <thead className="sticky top-0 bg-white text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">BookingNo</th>
                  <th className="px-4 py-3">PIN</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bookingDupRows.map((b: any) => (
                  <tr key={b.bookingId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{b.email}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{b.bookingNo}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{String(b.pin || "").padStart(4, "0")}</td>
                    <td className="px-4 py-3 text-slate-600">{b.status}</td>
                  </tr>
                ))}
                {bookingDupRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No duplicates found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal open={chainModalOpen} title={`Chain: ${chainModalName || ""}`} onClose={() => setChainModalOpen(false)} themeMode={themeMode}>
        <div className="text-xs text-slate-500 mb-3">Hotels ranked by lowest cancellation rate.</div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-500">
              <thead className="sticky top-0 bg-white text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Hotel</th>
                  <th className="px-4 py-3">Cancel rate</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(chainHotels[chainModalName] || []).map((h: any, idx: number) => (
                  <tr key={`${h.name}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{h.name}</td>
                    <td className="px-4 py-3 text-slate-700">{h.cancelRate}%</td>
                    <td className="px-4 py-3 text-slate-700">{h.total}</td>
                  </tr>
                ))}
                {(!chainModalName || (chainHotels[chainModalName] || []).length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No hotels found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!rewardModalEmail}
        title={`Account: ${rewardModalEmail || ""}`}
        onClose={() => setRewardModalEmail(null)}
        themeMode={themeMode}
      >
        {rewardModalEmail ? (
          <div className="space-y-6">
            <div className="text-xs text-slate-500">
              {(() => {
                const list = state.bookings.filter((b: any) => safeLower(b.email) === safeLower(rewardModalEmail));
                const total = list.length;
                const cancelled = list.filter((b: any) => b.status === "Cancelled").length;
                const confirmed = list.filter((b: any) => b.status === "Confirmed").length;
                const completed = list.filter((b: any) => b.status === "Completed").length;
                return `Bookings: ${total} • Confirmed ${confirmed} • Completed ${completed} • Cancelled ${cancelled}`;
              })()}
            </div>
            <div className="text-xs text-slate-500">Bookings</div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[40vh] overflow-auto">
                <table className="w-full text-left text-xs text-slate-500">
                  <thead className="sticky top-0 bg-white text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Hotel</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reward ETA</th>
                      <th className="px-4 py-3">Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {state.bookings
                      .filter((b: any) => safeLower(b.email) === safeLower(rewardModalEmail))
                      .map((b: any) => (
                        <tr key={b.bookingId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{b.createdAt}</td>
                          <td className="px-4 py-3 text-slate-700">{b.hotelNameSnapshot}</td>
                          <td className="px-4 py-3 text-slate-600">{b.status}</td>
                          <td className="px-4 py-3 text-slate-600">{computeRewardETA(b, state.settings) || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{b.rewardAmount ? money(b.rewardAmount) : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-slate-500">Spent</div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[30vh] overflow-auto">
                <table className="w-full text-left text-xs text-slate-500">
                  <thead className="sticky top-0 bg-white text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {state.sales
                      .filter((s: any) => safeLower(s.email) === safeLower(rewardModalEmail))
                      .map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{s.date}</td>
                          <td className="px-4 py-3 text-slate-700">{money(s.amount)}</td>
                          <td className="px-4 py-3 text-slate-600">{s.note || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <button
        onClick={() => setSettingsOpen(true)}
        className="fixed right-6 bottom-24 p-3 rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-500 z-40"
        title="Settings"
      >
        <Settings size={18} />
      </button>

      {/* Toasts */}
      <Toasts toasts={toasts} onDismiss={(id: string) => setToasts((p) => p.filter((t: any) => t.id !== id))} />
    </div>
  );
}

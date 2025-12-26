import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Building2,
  Wallet,
  AlertTriangle,
  Search,
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
  TrendingUp,
  PieChart as PieChartIcon,
  CreditCard,
  Copy,
  Save,
  Terminal,
  Edit3,
  Command,
  Target,
  Trophy,
  Ban,
  CheckSquare,
  Eye,
  EyeOff,
  Calendar,
  FileJson,
  Building,
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
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from "recharts";

/**
 * OPS DASH v5.6 — "Audi Command Edition"
 * REDESIGN: Premium Dark, Technical, High-Performance
 */

// --- COLORS & THEME CONSTANTS ---
const AUDI_COLORS = {
  black: "#000000",
  darkGray: "#0A0A0A",
  panel: "#111111",
  panelHover: "#161616",
  red: "#CC0000",
  brightRed: "#F40009", // The signature Audi red
  white: "#FFFFFF",
  silver: "#999999",
  text: "#E5E5E5",
  border: "#333333",
  borderActive: "#555555",
  grid: "#222222",
  success: "#10B981", // Emerald
  warning: "#F59E0B", // Amber
};

const DEFAULT_REWARD_TYPES = [
  { name: "Booking", days: 14 },
  { name: "Copa", days: 64 },
  { name: "AA", days: 64 },
  { name: "CC", days: 64 },
] as const;

// --- HELPERS ---
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
    specialRewards: state.specialRewards || [],
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
  const re = /genius\s*level\s*(1|2|3)/i;
  for (const c of cells) {
    const m = c.match(re);
    if (m) return `Genius Level ${m[1]}`;
  }
  const joined = cells.join(" ").trim();
  const mj = joined.match(re);
  if (mj) return `Genius Level ${mj[1]}`;
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

  const tail = parts.slice(statusIdx + 1).filter(Boolean);
  let rewardType: any = "Booking";
  let rewardPaidOn = "";

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

function parseAccountsPaste(text: string) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: Array<{ email: string; password: string }> = [];
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
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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

function tsvRow(email: string, password: string) {
  return `${email}\t${password ?? ""}`;
}

function accountsToTSV(rows: Array<{ email: string; password?: string }>) {
  return rows.map((a) => tsvRow(a.email, a.password || "")).join("\n");
}

// ----------------------- SEED DATA -----------------------
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
  ],
  hotels: [{ hotelId: "74", name: "The Bower Coronado", manualStatus: "OK", notes: "" }],
  bookings: [
    {
      bookingId: uid(), createdAt: "2025-02-10", email: "demo1@mail.com", bookingNo: "BK1001", pin: "1122",
      hotelId: "74", hotelNameSnapshot: "The Bower Coronado", cost: 320, checkIn: "2025-02-12", checkOut: "2025-02-13",
      promoCode: "", rewardAmount: 40, rewardType: "Booking", rewardPaidOn: "", status: "Confirmed", level: "Genius Level 1", note: "", _raw: "",
    },
    {
      bookingId: uid(), createdAt: "2025-02-11", email: "demo2@mail.com", bookingNo: "BK1002", pin: "2211",
      hotelId: "74", hotelNameSnapshot: "The Bower Coronado", cost: 540, checkIn: "2025-02-14", checkOut: "2025-02-16",
      promoCode: "", rewardAmount: 60, rewardType: "Copa", rewardPaidOn: "2025-04-21", status: "Completed", level: "Genius Level 2", note: "", _raw: "",
    },
    {
      bookingId: uid(), createdAt: "2025-02-12", email: "demo5@mail.com", bookingNo: "BK1003", pin: "3344",
      hotelId: "74", hotelNameSnapshot: "The Bower Coronado", cost: 280, checkIn: "2025-02-18", checkOut: "2025-02-19",
      promoCode: "", rewardAmount: 0, rewardType: "Booking", rewardPaidOn: "", status: "Cancelled", level: "Genius Level 1", note: "", _raw: "",
    },
  ],
  sales: [
    { id: uid(), date: "2025-02-12", email: "demo1@mail.com", amount: 15, note: "Taxi" },
    { id: uid(), date: "2025-02-15", email: "demo2@mail.com", amount: 25, note: "Support" },
    { id: uid(), date: "2025-02-20", email: "demo7@mail.com", amount: 10, note: "SIM" },
  ],
  specialRewards: [],
  audit: [],
  lastImport: null,
  lastRawImport: null,
};

// ----------------------- DERIVE MODEL -----------------------
function deriveModel(state: any) {
  const { database, hotels, bookings, sales, settings } = state;

  const bookingsByEmail = new Map<string, any[]>();
  for (const b of bookings) {
    const key = safeLower(b.email);
    if (!bookingsByEmail.has(key)) bookingsByEmail.set(key, []);
    bookingsByEmail.get(key)!.push(b);
  }
  for (const [, list] of bookingsByEmail.entries()) {
    list.sort((x, y) => (parseDate(y.createdAt)?.getTime() || 0) - (parseDate(x.createdAt)?.getTime() || 0));
  }

  const salesByEmail = new Map<string, any[]>();
  for (const s of sales) {
    const key = safeLower(s.email);
    if (!salesByEmail.has(key)) salesByEmail.set(key, []);
    salesByEmail.get(key)!.push(s);
  }

  const hotelStats = new Map<string, { total: number; confirmed: number; cancelled: number; spent: number; completed: number; lastBookingAt: string }>();
  for (const b of bookings) {
    const id = b.hotelId || "";
    if (!id) continue;
    if (!hotelStats.has(id)) hotelStats.set(id, { total: 0, confirmed: 0, cancelled: 0, spent: 0, completed: 0, lastBookingAt: "" });
    const st = hotelStats.get(id)!;
    st.total += 1;
    if (b.status === "Confirmed") st.confirmed += 1;
    if (b.status === "Cancelled") st.cancelled += 1;
    if (b.status === "Completed") st.completed += 1;
    st.spent += Number(b.cost || 0);
    if (!st.lastBookingAt || (parseDate(b.createdAt)?.getTime() || 0) > (parseDate(st.lastBookingAt)?.getTime() || 0)) {
      st.lastBookingAt = b.createdAt;
    }
  }

  const derivedHotels = hotels.map((h: any) => {
    const st = hotelStats.get(h.hotelId) || { total: 0, confirmed: 0, cancelled: 0, spent: 0, completed: 0, lastBookingAt: "" };
    const techBlocked = st.cancelled >= settings.hotelTechBlockTotal;
    const manualBlocked = h.manualStatus === "BLOCK";
    const isBlocked = manualBlocked || techBlocked;
    const reliability = st.total > 0 ? (1 - st.cancelled / st.total) * 100 : 100;
    // Rank Score: (Reliability * 2) + (Total Bookings * 0.5)
    const rankScore = (reliability * 2) + (st.total * 0.5);
    return {
      ...h,
      totalBookings: st.total,
      confirmed: st.confirmed,
      completed: st.completed,
      cancelled: st.cancelled,
      spent: st.spent,
      lastBookingAt: st.lastBookingAt,
      reliability,
      rankScore,
      techBlocked,
      manualBlocked,
      isBlocked,
      blockReason: manualBlocked ? "MANUAL" : techBlocked ? `TECH: hotel cancelled>=${settings.hotelTechBlockTotal}` : "",
    };
  }).sort((a: any, b: any) => b.rankScore - a.rankScore);

  const derivedAccounts = database.map((row: any) => {
    const emailKey = safeLower(row.email);
    const accBookings = bookingsByEmail.get(emailKey) || [];
    const accSales = salesByEmail.get(emailKey) || [];

    const totalBookings = accBookings.length;
    const confirmedBookings = accBookings.filter((b) => b.status === "Confirmed").length;
    const cancelledBookings = accBookings.filter((b) => b.status === "Cancelled").length;
    const positiveBookings = accBookings.filter((b) => b.status !== "Cancelled").length;

    const bonusEvents = accBookings.filter(
      (b) => ((b.status === "Completed" && Number(b.rewardAmount || 0) > 0) || (b.rewardPaidOn && Number(b.rewardAmount || 0) > 0)) && !b._void
    );

    const totalBonuses = bonusEvents.reduce((sum, b) => sum + Number(b.rewardAmount || 0), 0);
    const totalSales = accSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const netBalance = totalBonuses - totalSales;

    const lastBookingAt = accBookings[0]?.createdAt || "";
    const daysSinceLastBooking = lastBookingAt ? daysDiff(lastBookingAt) : null;
    const cooldownOk = lastBookingAt ? daysSinceLastBooking !== null && daysSinceLastBooking >= settings.cooldownDays : true;
    const activeBookingsCount = accBookings.filter((b) => b.status === "Pending" || b.status === "Confirmed").length;

    const totalCancelled = cancelledBookings;
    let consecutiveCancelled = 0;
    for (const b of accBookings) {
      if (b.status === "Cancelled") consecutiveCancelled += 1;
      else break;
    }

    const techBlocked = totalCancelled >= settings.techBlockTotal || consecutiveCancelled >= settings.techBlockConsecutive;
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
      if (daysSinceLastBonus !== null && daysSinceLastBonus > settings.platinumAfterDays) tier = "Platinum";
    }

    const canAddBooking = !isBlocked && activeBookingsCount < settings.maxActiveBookings && cooldownOk;
    const blockReason = manualBlocked ? "MANUAL" : techBlocked ? `TECH: cancelled (total=${totalCancelled}, streak=${consecutiveCancelled})` : "";
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
  const topHotels = [...derivedHotels].sort((a: any, b: any) => b.totalBookings - a.totalBookings).slice(0, 10);
  const topAccounts = [...derivedAccounts].sort((a: any, b: any) => b.totalBookings - a.totalBookings).slice(0, 10);

  const statusCounts: any = { Pending: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
  for (const b of bookings) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;

  const totalSpent = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalEarned = derivedAccounts.reduce((sum, a) => sum + Number(a.totalBonuses || 0), 0);
  const totalLeft = totalEarned - totalSpent;

  return { derivedAccounts, derivedHotels, accountsReady, hotelsEligible, premium, topHotels, topAccounts, statusCounts, totalSpent, totalEarned, totalLeft };
}

// ----------------------- UI COMPONENTS (AUDI STYLE) -----------------------
const Badge = ({ kind, children }: any) => {
  let style = "bg-zinc-800 text-zinc-400 border-zinc-700";
  if (kind === "active" || kind === "ok") style = "bg-green-900/30 text-green-400 border-green-800/50";
  else if (kind === "block" || kind === "cancelled") style = "bg-[#CC0000]/20 text-red-400 border-[#CC0000]/40";
  else if (kind === "tech" || kind === "warn") style = "bg-yellow-900/20 text-yellow-500 border-yellow-700/40";
  else if (kind === "gold") style = "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
  else if (kind === "plat") style = "bg-blue-300/10 text-blue-200 border-blue-300/30";

  return <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold border ${style}`}>{children}</span>;
};

const StatCard = ({ title, value, subValue, icon: Icon, onClick, isActive, color }: any) => (
  <div
    onClick={onClick}
    className={`relative overflow-hidden p-5 rounded-sm border transition-all cursor-pointer group bg-[#111111] hover:bg-[#161616] ${
      isActive ? `border-[${color || AUDI_COLORS.brightRed}] shadow-[0_0_15px_rgba(244,0,9,0.15)]` : "border-[#333333] hover:border-zinc-500"
    }`}
  >
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-white">
      <Icon size={80} strokeWidth={1} />
    </div>
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-1.5 rounded-sm bg-zinc-900 border border-zinc-800 ${color ? `text-[${color}]` : "text-[#F40009]"}`}>
        <Icon size={16} />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{title}</span>
    </div>
    <div className="flex items-end gap-3 relative z-10">
      <h3 className="text-3xl font-bold tracking-tight text-white font-[system-ui]">{value}</h3>
      {subValue && <span className="text-[10px] mb-1.5 text-zinc-500 font-mono">{subValue}</span>}
    </div>
    {isActive && <div className={`absolute bottom-0 left-0 w-full h-0.5 ${color ? `bg-[${color}]` : "bg-[#F40009]"}`} />}
  </div>
);

function Modal({ open, title, onClose, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl rounded-sm border border-[#333333] bg-[#0A0A0A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222]">
          <div className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <div className="w-1 h-4 bg-[#F40009]"/>
              {title}
          </div>
          <button onClick={onClose} className="p-2 rounded-sm hover:bg-[#222] text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 text-zinc-300 max-h-[85vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function Toasts({ toasts, onDismiss }: any) {
  return (
    <div className="fixed right-6 bottom-6 z-50 space-y-2 pointer-events-none">
      {toasts.map((t: any) => (
        <div
          key={t.id}
          className={`pointer-events-auto w-80 p-4 rounded-sm bg-[#111111] border shadow-2xl backdrop-blur-md flex items-start gap-4 animate-in slide-in-from-right-10 duration-300 ${
            t.kind === "ok" ? "border-green-900/50" : t.kind === "warn" ? "border-yellow-900/50" : "border-red-900/50"
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {t.kind === "ok" ? <CheckCircle2 size={18} className="text-green-500" /> : t.kind === "warn" ? <AlertTriangle size={18} className="text-yellow-500" /> : <ShieldAlert size={18} className="text-[#F40009]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white leading-tight">{t.title}</div>
            {t.msg && <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{t.msg}</div>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-zinc-600 hover:text-zinc-300">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const PanelHeader = ({ icon: Icon, title, subtitle, actions }: any) => (
  <div className="flex items-start justify-between gap-4 mb-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-sm text-[#F40009]">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-white font-bold uppercase tracking-wider text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

const DataPill = ({ label, value, color }: any) => (
  <div className="px-3 py-1 rounded-sm text-[10px] uppercase tracking-widest border" style={{ borderColor: color || "#333", color: color || "#999" }}>
    {label}: <span className="text-white font-bold ml-1">{value}</span>
  </div>
);

// ----------------------- MAIN APP -----------------------
export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [globalActionsOpen, setGlobalActionsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [trendDays, setTrendDays] = useState(30);
  const [editMode, setEditMode] = useState(false); // Global Table Edit Mode
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [auditOpen, setAuditOpen] = useState(false);
  const [rewardDetailOpen, setRewardDetailOpen] = useState(false);
  const [rewardDetailAccount, setRewardDetailAccount] = useState<string>("");
  const [rewardPasswordVisible, setRewardPasswordVisible] = useState<Record<string, boolean>>({});
  const [selectedNextAction, setSelectedNextAction] = useState<Set<string>>(new Set());
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({
    database: "",
    bookings: "",
    hotels: "",
    hotelIntel: "",
    spent: "",
    rewardsPaid: "",
    rewardsPending: "",
    sheet: "",
  });
  const [tableSorts, setTableSorts] = useState<Record<string, { key: string; dir: "asc" | "desc" }>>({
    database: { key: "email", dir: "asc" },
    bookings: { key: "createdAt", dir: "desc" },
    hotels: { key: "rankScore", dir: "desc" },
    hotelIntel: { key: "rankScore", dir: "desc" },
    spent: { key: "date", dir: "desc" },
    rewardsPaid: { key: "paidTotal", dir: "desc" },
    rewardsPending: { key: "eta", dir: "asc" },
    sheet: { key: "email", dir: "asc" },
  });

  // Command Center Selection
  const [selectedReady, setSelectedReady] = useState<Set<string>>(new Set());

  // RawData states
  const [rawAccountsInput, setRawAccountsInput] = useState("");
  const [rawSpentInput, setRawSpentInput] = useState("");
  const [rawBlockedInput, setRawBlockedInput] = useState("");
  const [rawPromoEmail, setRawPromoEmail] = useState("");
  const [rawPromoAmount, setRawPromoAmount] = useState("");
  const [rawPromoCode, setRawPromoCode] = useState("");

  const [toasts, setToasts] = useState<any[]>([]);
  const pushToast = (kind: "ok" | "warn" | "err", title: string, msg = "") => {
    const id = uid();
    setToasts((p) => [...p, { id, kind, title, msg }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  };

  const [state, setState] = useState<any>(() => {
    try {
      const raw = localStorage.getItem("ops_dash_audi_state");
      if (raw) return JSON.parse(raw);
    } catch {}
    return SEED;
  });

  useEffect(() => {
    try {
      localStorage.setItem("ops_dash_audi_state", JSON.stringify(state));
    } catch {}
  }, [state]);

  const model = useMemo(() => deriveModel(state), [state]);

  // Auto-write TECH blocks (FULL LOGIC RESTORED)
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
    const days = trendDays;
    const end = parseDate(todayISO())!;
    const map = new Map<string, { date: string; net: number; earned: number; spent: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, net: 0, earned: 0, spent: 0 });
    }
    for (const b of state.bookings) {
      const key = (b.rewardPaidOn || b.createdAt || "").slice(0, 10);
      if (map.has(key) && (b.status === "Completed" || b.rewardPaidOn) && Number(b.rewardAmount || 0) > 0) {
        map.get(key)!.net += Number(b.rewardAmount || 0);
        map.get(key)!.earned += Number(b.rewardAmount || 0);
      }
    }
    for (const s of state.sales) {
      const key = (s.date || "").slice(0, 10);
      if (map.has(key)) {
          map.get(key)!.net -= Number(s.amount || 0);
          map.get(key)!.spent += Number(s.amount || 0);
      }
    }
    return Array.from(map.values());
  }, [state.bookings, state.sales, trendDays]);

  const rewardAccumulation = useMemo(() => {
      let acc = 0;
      return netTrend.map(d => {
          acc += d.earned;
          return { ...d, acc };
      });
  }, [netTrend]);

  const setSettings = (patch: any) => setState((prev: any) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  // Ingestion Logic
  const ingestFromPaste = (text: string) => {
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
          continue;
        }

        if (!dbEmails.has(safeLower(row.email)) && prev.settings.autoCreateFromImport) {
          next.database.push({ email: row.email, password: "", manualStatus: "Активен", notes: "AUTO_CREATED_FROM_IMPORT", createdAt: todayISO() });
          dbEmails.add(safeLower(row.email));
          accCreated += 1;
          next.audit.push({ id: uid(), at: now, type: "ACCOUNT_CREATE", msg: `Account auto-created: ${row.email}` });
        }

        let hid = (row.hotelId || "").trim();
        const hname = (row.hotelName || "").trim();
        if (!hid) {
          const match = hotelIdByName.get(safeLower(hname));
          if (match) hid = match;
        }

        if (hid) {
          if (!hotelById.has(hid) && prev.settings.autoCreateFromImport) {
            const nh = { hotelId: hid, name: hname || hid, manualStatus: "OK", notes: "AUTO_CREATED_FROM_IMPORT" };
            next.hotels.push(nh);
            hotelById.set(hid, nh);
            hotelIdByName.set(safeLower(nh.name), hid);
            hotelCreated += 1;
          }
        } else if (prev.settings.autoCreateFromImport) {
          hid = stableHotelIdFromName(hname);
          if (!hotelById.has(hid)) {
            const nh = { hotelId: hid, name: hname || hid, manualStatus: "OK", notes: "AUTO_CREATED_FROM_IMPORT" };
            next.hotels.push(nh);
            hotelById.set(hid, nh);
            hotelCreated += 1;
          }
        }

        next.bookings.push({
          bookingId: uid(), createdAt: row.createdAt, email: row.email, bookingNo: row.bookingNo, pin: row.pin,
          hotelId: hid || row.hotelId || "", hotelNameSnapshot: hname || hid || "", cost: row.cost, checkIn: row.checkIn, checkOut: row.checkOut,
          promoCode: row.promoCode || "", rewardAmount: row.rewardAmount || 0, rewardCurrency: row.rewardCurrency || "USD",
          rewardType: row.rewardType || "Booking", airline: row.airline || "", rewardPaidOn: row.rewardPaidOn || "",
          status: row.status, level: row.level || "", note: row.note || "", _raw: row._raw || "",
        });
        existingBookingKeys.add(bookingKey);
        added += 1;
        next.audit.push({ id: uid(), at: now, type: "BOOKING_ADD", msg: `Booking added: ${row.email} / ${row.bookingNo} / ${row.status}` });
      }

      next.audit = next.audit.slice(-400);
      next.lastImport = { at: now, added, dupSkipped, accCreated, hotelCreated, errors: errors.length };
      return next;
    });
    pushToast("ok", "Import Processed");
  };

  const handleImport = (payload: any) => {
      try {
        if (!payload || !Array.isArray(payload.accounts)) throw new Error("Invalid format");
        setState({
            ...state,
            settings: payload.settings || state.settings,
            hotels: Array.isArray(payload.hotels) ? payload.hotels : state.hotels,
            database: payload.accounts.map((a: any) => { const { bookings, sales, ...r } = a; return r; }),
            bookings: payload.accounts.flatMap((a: any) => a.bookings || []),
            sales: payload.accounts.flatMap((a: any) => a.sales || []),
            specialRewards: Array.isArray(payload.specialRewards) ? payload.specialRewards : state.specialRewards
        });
        pushToast("ok", "Import Successful");
      } catch(e) {
          setImportError("Failed to parse JSON");
      }
  };

  const handleRawAccountsImport = () => {
      const { rows, errors } = parseAccountsPaste(rawAccountsInput);
      if (rows.length === 0) { pushToast("warn", "No valid rows found"); return; }
      setState((prev: any) => {
          const next = { ...prev, database: [...prev.database] };
          let updated = 0; let added = 0;
          for (const r of rows) {
              const idx = next.database.findIndex((x: any) => safeLower(x.email) === safeLower(r.email));
              if (idx >= 0) {
                  if (r.password) { next.database[idx].password = r.password; updated++; }
              } else {
                  next.database.push({ email: r.email, password: r.password, manualStatus: "Активен", notes: "RAW_IMPORT", createdAt: todayISO() });
                  added++;
              }
          }
          return next;
      });
      if (errors.length > 0) pushToast("warn", "Some rows were skipped", `${errors.length} invalid rows.`);
      setRawAccountsInput("");
      pushToast("ok", `Imported Accounts`, `Added: ${rows.length}`);
  };

  const handleRawSpentImport = () => {
      const { rows, errors } = parseSpentPaste(rawSpentInput);
      if (rows.length === 0) { pushToast("warn", "No valid rows found"); return; }
      setState((prev: any) => {
          const next = { ...prev, sales: [...prev.sales] };
          for (const r of rows) {
              next.sales.push({ id: uid(), date: r.date, email: r.email, amount: r.amount, note: r.note });
          }
          return next;
      });
      if (errors.length > 0) pushToast("warn", "Some rows were skipped", `${errors.length} invalid rows.`);
      setRawSpentInput("");
      pushToast("ok", `Imported Sales`, `Added: ${rows.length}`);
  };

  const handleRawBlockedImport = () => {
      const lines = (rawBlockedInput || "").split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) { pushToast("warn", "No valid emails found"); return; }

      setState((prev: any) => {
          const next = { ...prev, database: [...prev.database] };
          const now = todayISO();

          lines.forEach(email => {
              const clean = safeLower(email);
              if(!clean) return;
              const idx = next.database.findIndex((x:any) => safeLower(x.email) === clean);
              if (idx >= 0) {
                  next.database[idx] = { ...next.database[idx], manualStatus: "Блок" };
                  if (!next.database[idx].notes?.includes("MASS_BLOCK")) {
                       next.database[idx].notes = (next.database[idx].notes || "") + " MASS_BLOCK";
                  }
              } else {
                  next.database.push({ email: clean, password: "", manualStatus: "Блок", notes: "MASS_BLOCK_IMPORT", createdAt: now });
              }
          });
          return next;
      });

      setRawBlockedInput("");
      pushToast("ok", "Block List Processed", `Targeted: ${lines.length} emails`);
  };

  const handlePromoRewardAdd = () => {
    const email = safeLower(rawPromoEmail);
    const amount = parseMoney(rawPromoAmount);
    if (!email || !email.includes("@") || !Number.isFinite(amount) || amount <= 0) {
      pushToast("warn", "Invalid promo reward", "Use a valid email + amount.");
      return;
    }
    setState((prev: any) => ({
      ...prev,
      specialRewards: [
        ...(prev.specialRewards || []),
        { id: uid(), email, amount, promo: rawPromoCode.trim() || "PROMO", createdAt: todayISO() },
      ],
    }));
    setRawPromoEmail("");
    setRawPromoAmount("");
    setRawPromoCode("");
    pushToast("ok", "Promo reward added", `${email} • ${money(amount)}`);
  };

  const upsertDatabaseRow = (email: string, patch: any) => {
    setState((prev: any) => {
      const next = { ...prev, database: [...prev.database] };
      const idx = next.database.findIndex((x: any) => safeLower(x.email) === safeLower(email));
      if (idx >= 0) next.database[idx] = { ...next.database[idx], ...patch };
      return next;
    });
  };

  const upsertBookingRow = (bookingId: string, patch: any) => {
      setState((prev: any) => {
          const next = { ...prev, bookings: [...prev.bookings] };
          const idx = next.bookings.findIndex((x: any) => x.bookingId === bookingId);
          if (idx >= 0) next.bookings[idx] = { ...next.bookings[idx], ...patch };
          return next;
      });
  };

  const copyAllEmails = async (filter?: (a: any) => boolean) => {
      const emails = state.database.filter(filter || (() => true)).map((a: any) => a.email).join("\n");
      await copyToClipboard(emails);
      pushToast("ok", "Copied Emails", `${emails.split('\n').length} items copied.`);
  };

  const togglePassword = (bookingId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const handleExportJSON = () => {
    const payload = exportStateByEmail(state);
    downloadJSON(`ops-dash-export-${todayISO()}.json`, payload);
    pushToast("ok", "Export Complete", "JSON snapshot saved.");
  };

  const sortRows = (rows: any[], key: string, dir: "asc" | "desc") => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a?.[key];
      const bVal = b?.[key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
      return String(aVal).localeCompare(String(bVal));
    });
    return dir === "asc" ? sorted : sorted.reverse();
  };

  const theme = { grid: "#333333", axis: "#666666", tooltip: { backgroundColor: "#111111", borderColor: "#333333", color: "#FFFFFF" } };
  const rewardAccount = rewardDetailAccount
    ? model.derivedAccounts.find((a: any) => safeLower(a.email) === safeLower(rewardDetailAccount))
    : null;
  const rewardAccountBookings = rewardDetailAccount
    ? state.bookings.filter((b: any) => safeLower(b.email) === safeLower(rewardDetailAccount))
    : [];
  const rewardAccountPending = rewardAccountBookings
    .filter((b: any) => Number(b.rewardAmount || 0) > 0 && !b.rewardPaidOn)
    .map((b: any) => ({ ...b, eta: computeRewardETA(b, state.settings) }));
  const rewardAccountPendingTotal = rewardAccountPending.reduce((sum: number, b: any) => sum + Number(b.rewardAmount || 0), 0);
  const rewardAccountPositive = rewardAccountBookings.filter((b: any) => b.status !== "Cancelled");
  const rewardAccountNegative = rewardAccountBookings.filter((b: any) => b.status === "Cancelled");
  const rewardFutureBalance = rewardAccount ? Number(rewardAccount.netBalance || 0) + rewardAccountPendingTotal : rewardAccountPendingTotal;

  // --- VIEWS ---
  const OverviewView = () => {
    const statusData = [
      { name: "Pending", value: model.statusCounts.Pending || 0, fill: "#666666" },
      { name: "Confirmed", value: model.statusCounts.Confirmed || 0, fill: AUDI_COLORS.white },
      { name: "Completed", value: model.statusCounts.Completed || 0, fill: AUDI_COLORS.silver },
      { name: "Cancelled", value: model.statusCounts.Cancelled || 0, fill: AUDI_COLORS.brightRed },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard isActive={true} title="Net Balance" value={money(model.totalLeft)} subValue={`Profit (Earned ${money(model.totalEarned)})`} icon={Wallet} />
          <StatCard title="Total Spent" value={money(model.totalSpent)} subValue="Costs" icon={CreditCard} color="#FACC15" onClick={() => setActiveTab("spent")} />
          <StatCard title="Total Bookings" value={totals.totalBookings} subValue="All statuses" icon={BookOpen} onClick={() => setActiveTab("bookings")} />
          <StatCard title="Ready Accounts" value={model.accountsReady.length} subValue="Actionable" icon={Zap} onClick={() => setActiveTab("command_center")} />
          <StatCard title="Blocked" value={totals.blocked} subValue="Manual + TECH" icon={ShieldAlert} onClick={() => setActiveTab("database")} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-[#111111] border border-[#333333] rounded-sm p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-white uppercase tracking-wider flex items-center gap-2">
                 <Activity size={18} className="text-[#F40009]"/> Money Flow
              </h3>
              <div className="flex bg-[#222] rounded-sm p-1">
                {[30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTrendDays(d)}
                    className={`px-3 py-1 rounded-sm text-[10px] font-bold uppercase transition-all ${trendDays === d ? "bg-[#F40009] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={netTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} minTickGap={30} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                  <RechartsTooltip contentStyle={theme.tooltip} itemStyle={{color: '#fff'}} />
                  <Bar dataKey="earned" name="Earned" fill="#4ADE80" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#FACC15" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111111] border border-[#333333] rounded-sm p-6">
            <h3 className="font-bold text-lg text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <PieChartIcon size={18} className="text-zinc-500" /> Mix
            </h3>
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} stroke="none">
                    {statusData.map((x: any, i: number) => <Cell key={i} fill={x.fill} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={theme.tooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <div className="text-3xl font-bold text-white">{totals.totalBookings}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Total</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
             <div className="bg-[#111111] border border-[#333333] rounded-sm p-6">
                 <h3 className="font-bold text-lg text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                     <TrendingUp size={18} className="text-green-500" /> Reward Accumulation
                 </h3>
                 <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={rewardAccumulation}>
                             <defs>
                                 <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.3}/>
                                     <stop offset="95%" stopColor="#4ADE80" stopOpacity={0}/>
                                 </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                             <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} minTickGap={30} />
                             <YAxis stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                             <RechartsTooltip contentStyle={theme.tooltip} />
                             <Area type="monotone" dataKey="acc" stroke="#4ADE80" strokeWidth={2} fillOpacity={1} fill="url(#colorAcc)" />
                         </AreaChart>
                     </ResponsiveContainer>
                 </div>
             </div>
             <div className="bg-[#111111] border border-[#333333] rounded-sm p-6">
               <PanelHeader
                 icon={Target}
                 title="Command Highlights"
                 subtitle="Top ready accounts & best hotels"
               />
               <div className="space-y-4">
                 <div>
                   <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Top Ready Accounts</div>
                   <div className="space-y-2">
                     {model.accountsReady.slice(0, 4).map((a: any) => (
                       <div key={a.emailKey} className="flex items-center justify-between border border-[#222] rounded-sm px-3 py-2 bg-[#0F0F0F]">
                         <div className="text-xs text-white font-mono truncate">{a.email}</div>
                         <div className="text-[10px] text-zinc-500 font-mono">BAL {money(a.netBalance)}</div>
                       </div>
                     ))}
                     {model.accountsReady.length === 0 && <div className="text-xs text-zinc-600">No ready accounts yet.</div>}
                   </div>
                 </div>
                 <div>
                   <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Top Hotels</div>
                   <div className="space-y-2">
                     {model.topHotels.slice(0, 4).map((h: any) => (
                       <div key={h.hotelId} className="flex items-center justify-between border border-[#222] rounded-sm px-3 py-2 bg-[#0F0F0F]">
                         <div className="text-xs text-white truncate">{h.name}</div>
                         <div className="text-[10px] text-zinc-500 font-mono">{h.confirmed} CONF</div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
        </div>
      </div>
    );
  };

  const DatabaseView = () => {
    const filter = tableFilters.database;
    const sort = tableSorts.database;
    const filtered = model.derivedAccounts.filter((a: any) => {
      if (!filter) return searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true;
      const haystack = `${a.email} ${a.manualStatus} ${a.notes ?? ""}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    });
    const rows = sortRows(filtered, sort.key, sort.dir);

    return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                 <div className="p-2 bg-[#F40009] text-white rounded-sm">
                     <Users size={20} />
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white uppercase tracking-wider">Database</h2>
                     <p className="text-xs text-zinc-500">Account Registry & Status Control</p>
                 </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setTableFilters((prev) => ({ ...prev, database: e.target.value }))}
                placeholder="Filter accounts"
                className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
              />
              <select
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(":");
                  setTableSorts((prev) => ({ ...prev, database: { key, dir: dir as "asc" | "desc" } }));
                }}
                className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-2 text-xs text-white"
              >
                <option value="email:asc">Email A-Z</option>
                <option value="email:desc">Email Z-A</option>
                <option value="netBalance:desc">Net Balance ↓</option>
                <option value="netBalance:asc">Net Balance ↑</option>
                <option value="totalBookings:desc">Bookings ↓</option>
                <option value="totalBookings:asc">Bookings ↑</option>
              </select>
              <button onClick={() => downloadCSV("database.csv", state.database)} className="px-4 py-2 bg-[#222] hover:bg-[#333] text-white text-xs font-bold uppercase tracking-wider rounded-sm border border-[#333] transition-colors">Export CSV</button>
            </div>
       </div>

      <div className="border border-[#333333] bg-[#111111] rounded-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-[#1A1A1A] text-[10px] uppercase font-bold text-zinc-500 sticky top-0 z-10 tracking-widest border-b border-[#333]">
              <tr>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4">Security</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Performance</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {rows.map((a: any) => {
                  const missing = !String(a.password || "").trim();
                  return (
                    <tr key={a.emailKey} className="hover:bg-[#1A1A1A] transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <div className="text-white font-bold font-mono tracking-tight">{a.email}</div>
                        <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => copyToClipboard(a.email)} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-white">Copy</button>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <input className={`bg-[#000] border border-[#333] rounded-sm px-2 py-1 text-zinc-300 w-full text-xs font-mono focus:border-[#F40009] outline-none transition-colors ${missing ? "border-red-900/50" : ""}`}
                          value={a.password || ""} onChange={(e) => upsertDatabaseRow(a.email, { password: e.target.value })} placeholder={missing ? "MISSING" : "password"} />
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-2">
                            <select className="bg-[#000] border border-[#333] rounded-sm px-2 py-1 text-zinc-300 text-xs w-full focus:border-white outline-none" value={a.manualStatus} onChange={(e) => upsertDatabaseRow(a.email, { manualStatus: e.target.value })}>
                            <option value="Активен">Active</option>
                            <option value="Блок">Block</option>
                            </select>
                            <div className="flex flex-wrap gap-1">
                                {!a.isBlocked ? <Badge kind="active">ACTIVE</Badge> : <Badge kind="block">BLOCKED</Badge>}
                                {a.tier === "Gold" && <Badge kind="gold">GOLD</Badge>}
                                {a.tier === "Platinum" && <Badge kind="plat">PLAT</Badge>}
                            </div>
                            {a.blockReason && <div className="text-[10px] text-[#F40009] font-mono leading-tight">{a.blockReason}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-xs text-zinc-500 font-mono">
                        <div className="flex justify-between"><span className="text-zinc-600">Total</span><span className="text-white">{a.totalBookings}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-600">Conf</span><span className="text-white">{a.confirmedBookings}</span></div>
                        <div className="flex justify-between mt-1"><span className="text-zinc-600">Net</span><span className={`font-bold ${Number(a.netBalance)>0 ? "text-green-400" : "text-zinc-400"}`}>{money(a.netBalance)}</span></div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <input className="bg-transparent border-b border-[#333] focus:border-white w-full text-xs text-zinc-400 py-1 outline-none transition-colors" value={a.notes || ""} onChange={(e) => upsertDatabaseRow(a.email, { notes: e.target.value })} placeholder="Add note..." />
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <button className="text-[#F40009] hover:text-red-400 text-[10px] font-bold uppercase tracking-widest border border-[#333] px-2 py-1 rounded-sm hover:border-[#F40009] transition-all">Delete</button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  };

  const BookingsView = () => {
    const filter = tableFilters.bookings;
    const sort = tableSorts.bookings;
    const filtered = state.bookings.filter((b: any) => {
      if (!filter) return true;
      const haystack = `${b.email} ${b.bookingNo} ${b.hotelNameSnapshot} ${b.status}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    });
    const rows = sortRows(filtered, sort.key, sort.dir);
    return (
        <div className="space-y-6">
            <div className="bg-[#111111] border border-[#333333] rounded-sm p-6 relative group overflow-hidden">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                     <Terminal size={100} />
                 </div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-sm border border-blue-500/20">
                            <ClipboardList size={20} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold uppercase tracking-wider">Smart Import</h3>
                            <p className="text-xs text-zinc-500">Paste Google Sheets Rows (Tab Separated)</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-3 py-1 bg-[#222] rounded-sm text-[10px] text-zinc-400 font-mono flex items-center gap-2 border border-[#333]">
                            <span>AUTO-CREATE:</span>
                            <span className={state.settings.autoCreateFromImport ? "text-green-400" : "text-zinc-600"}>{state.settings.autoCreateFromImport ? "ON" : "OFF"}</span>
                        </div>
                    </div>
                </div>
                <textarea className="w-full bg-[#050505] border border-[#333] rounded-sm p-4 text-xs font-mono text-zinc-300 focus:border-blue-500 outline-none min-h-[120px] transition-colors custom-scrollbar relative z-10"
                    placeholder="PASTE DATA HERE..." onPaste={(e) => { e.preventDefault(); const text = e.clipboardData.getData("text/plain"); ingestFromPaste(text); }} />
            </div>

            <div className="border border-[#333333] bg-[#111111] rounded-sm overflow-hidden">
                <div className="px-6 py-3 border-b border-[#333] flex flex-wrap gap-3 justify-between items-center bg-[#1A1A1A]">
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Bookings Log</div>
                        <div className="text-xs text-zinc-600 font-mono">{rows.length} entries</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={filter}
                        onChange={(e) => setTableFilters((prev) => ({ ...prev, bookings: e.target.value }))}
                        placeholder="Filter bookings"
                        className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                      />
                      <select
                        value={`${sort.key}:${sort.dir}`}
                        onChange={(e) => {
                          const [key, dir] = e.target.value.split(":");
                          setTableSorts((prev) => ({ ...prev, bookings: { key, dir: dir as "asc" | "desc" } }));
                        }}
                        className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
                      >
                        <option value="createdAt:desc">Newest</option>
                        <option value="createdAt:asc">Oldest</option>
                        <option value="cost:desc">Cost ↓</option>
                        <option value="cost:asc">Cost ↑</option>
                        <option value="rewardAmount:desc">Reward ↓</option>
                        <option value="rewardAmount:asc">Reward ↑</option>
                      </select>
                      <button onClick={() => setEditMode(!editMode)} className={`flex items-center gap-2 px-3 py-1 rounded-sm text-[10px] font-bold uppercase border transition-all ${editMode ? "bg-[#F40009] border-[#F40009] text-white" : "bg-transparent border-[#333] text-zinc-500 hover:text-white"}`}>
                          <Edit3 size={12} /> {editMode ? "Edit Mode ON" : "Edit Mode OFF"}
                      </button>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[65vh]">
                    <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500 sticky top-0 z-10 tracking-widest">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Account Context</th>
                                <th className="px-6 py-3">Hotel & Stay</th>
                                <th className="px-6 py-3">Financials</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Reward Intel</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222]">
                            {rows.map((b: any) => {
                                const acc = model.derivedAccounts.find((a: any) => a.emailKey === safeLower(b.email));
                                const showPass = visiblePasswords[b.bookingId];
                                const eta = computeRewardETA(b, state.settings);
                                return (
                                <tr key={b.bookingId} className="hover:bg-[#1A1A1A] transition-colors">
                                    <td className="px-6 py-3 text-xs font-mono text-zinc-500 align-top">{b.createdAt}</td>
                                    <td className="px-6 py-3 align-top">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="text-white text-xs font-bold">{b.email}</div>
                                            <button onClick={() => togglePassword(b.bookingId)} className="text-zinc-500 hover:text-white transition-colors">
                                                {showPass ? <EyeOff size={12}/> : <Eye size={12}/>}
                                            </button>
                                        </div>
                                        {showPass && <div className="text-[10px] font-mono text-[#F40009] mb-1 bg-[#111] border border-[#333] px-2 py-0.5 rounded w-fit">{acc?.password || "NO_PASS"}</div>}
                                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                                            <span>ID: {b.bookingNo}</span>
                                            <span className="text-zinc-700">|</span>
                                            <span>PIN: {b.pin}</span>
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{b.level}</div>
                                    </td>
                                    <td className="px-6 py-3 align-top">
                                        <div className="text-zinc-300 text-xs truncate max-w-[150px] font-bold">{b.hotelNameSnapshot}</div>
                                        <div className="text-[10px] text-zinc-600 font-mono mb-1">ID: {b.hotelId}</div>
                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                                            <Calendar size={10} /> {b.checkIn} → {b.checkOut}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 align-top">
                                        <div className="text-xs text-white mb-1 flex justify-between w-24">
                                            <span className="text-zinc-500">Spent:</span>
                                            {editMode ? (
                                                <input className="w-12 bg-[#000] border border-[#333] text-zinc-300 px-1 text-right text-[10px]" value={b.cost} onChange={(e) => upsertBookingRow(b.bookingId, {cost: Number(e.target.value)})} />
                                            ) : (
                                                <span className="font-mono">{money(b.cost)}</span>
                                            )}
                                        </div>
                                        {b.promoCode && <div className="text-[10px] text-green-500 font-mono">PROMO: {b.promoCode}</div>}
                                    </td>
                                    <td className="px-6 py-3 align-top">
                                        {editMode ? (
                                            <select className="bg-[#000] border border-[#333] text-zinc-300 text-xs p-1" value={b.status} onChange={(e) => upsertBookingRow(b.bookingId, {status: e.target.value})}>
                                                {Array.from(KNOWN_STATUS).map(s => <option key={s} value={s.charAt(0).toUpperCase() + s.slice(1)}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                            </select>
                                        ) : (
                                            b.status === "Confirmed" ? <Badge kind="active">CNF</Badge> : b.status === "Cancelled" ? <Badge kind="cancelled">CXL</Badge> : <Badge>{b.status.substring(0,4).toUpperCase()}</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right align-top">
                                        <div className="flex flex-col items-end">
                                            <div className="text-xs text-white font-bold mb-0.5">
                                                {editMode ? (
                                                    <input className="w-16 bg-[#000] border border-[#333] text-white px-1 text-right" value={b.rewardAmount} onChange={(e) => upsertBookingRow(b.bookingId, {rewardAmount: Number(e.target.value)})} />
                                                ) : (
                                                    b.rewardAmount ? money(b.rewardAmount) : "—"
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 font-mono mb-0.5">{b.rewardType} {b.airline && `(${b.airline})`}</div>
                                            <div className={`text-[10px] font-mono ${b.rewardPaidOn ? "text-green-500" : "text-zinc-600"}`}>
                                                {b.rewardPaidOn ? `PAID: ${b.rewardPaidOn}` : `ETA: ${eta}`}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const RawDataView = () => (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[75vh]">
          {/* Accounts Panel */}
          <div className="flex flex-col border border-[#333] bg-[#111] rounded-sm overflow-hidden">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1A1A1A]">
                   <div className="flex items-center gap-2">
                       <Database size={16} className="text-zinc-500" />
                       <span className="text-xs font-bold text-white uppercase tracking-widest">Accounts Import</span>
                   </div>
                   <div className="text-[10px] text-zinc-500 font-mono">FORMAT: EMAIL \t PASSWORD</div>
              </div>
              <textarea 
                value={rawAccountsInput} onChange={(e) => setRawAccountsInput(e.target.value)}
                className="flex-1 bg-[#0A0A0A] p-4 text-xs font-mono text-zinc-300 outline-none resize-none focus:bg-black transition-colors custom-scrollbar"
                placeholder={`user@example.com\tpassword123\nuser2@example.com\tpass456`}
              />
              <div className="p-4 border-t border-[#333] bg-[#1A1A1A]">
                  <button onClick={handleRawAccountsImport} className="w-full py-2 bg-[#222] hover:bg-[#F40009] text-white text-xs font-bold uppercase tracking-widest rounded-sm border border-[#333] hover:border-[#F40009] transition-all flex items-center justify-center gap-2 group">
                      <Save size={14} className="group-hover:scale-110 transition-transform" /> Execute Import
                  </button>
              </div>
          </div>

          {/* Sales Panel */}
          <div className="flex flex-col border border-[#333] bg-[#111] rounded-sm overflow-hidden">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1A1A1A]">
                   <div className="flex items-center gap-2">
                       <CreditCard size={16} className="text-zinc-500" />
                       <span className="text-xs font-bold text-white uppercase tracking-widest">Sales Import</span>
                   </div>
                   <div className="text-[10px] text-zinc-500 font-mono">FORMAT: DATE \t EMAIL \t AMT \t NOTE</div>
              </div>
              <textarea 
                value={rawSpentInput} onChange={(e) => setRawSpentInput(e.target.value)}
                className="flex-1 bg-[#0A0A0A] p-4 text-xs font-mono text-zinc-300 outline-none resize-none focus:bg-black transition-colors custom-scrollbar"
                placeholder={`2025-02-10\tuser@example.com\t15\tTaxi\n2025-02-12\tuser2@example.com\t50\tFlight`}
              />
              <div className="p-4 border-t border-[#333] bg-[#1A1A1A]">
                  <button onClick={handleRawSpentImport} className="w-full py-2 bg-[#222] hover:bg-[#F40009] text-white text-xs font-bold uppercase tracking-widest rounded-sm border border-[#333] hover:border-[#F40009] transition-all flex items-center justify-center gap-2 group">
                      <Save size={14} className="group-hover:scale-110 transition-transform" /> Execute Import
                  </button>
              </div>
          </div>

          {/* Mass Block Panel */}
          <div className="flex flex-col border border-[#333] bg-[#111] rounded-sm overflow-hidden">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1A1A1A]">
                   <div className="flex items-center gap-2">
                       <ShieldAlert size={16} className="text-[#F40009]" />
                       <span className="text-xs font-bold text-white uppercase tracking-widest">Mass Block</span>
                   </div>
                   <div className="text-[10px] text-zinc-500 font-mono">FORMAT: EMAIL_ONLY</div>
              </div>
              <textarea 
                value={rawBlockedInput} onChange={(e) => setRawBlockedInput(e.target.value)}
                className="flex-1 bg-[#0A0A0A] p-4 text-xs font-mono text-zinc-300 outline-none resize-none focus:bg-black transition-colors custom-scrollbar"
                placeholder={`bad_actor@example.com\nfraudster@test.com`}
              />
              <div className="p-4 border-t border-[#333] bg-[#1A1A1A]">
                  <button onClick={handleRawBlockedImport} className="w-full py-2 bg-[#222] hover:bg-[#F40009] text-white text-xs font-bold uppercase tracking-widest rounded-sm border border-[#333] hover:border-[#F40009] transition-all flex items-center justify-center gap-2 group">
                      <Ban size={14} className="group-hover:scale-110 transition-transform" /> Block Emails
                  </button>
              </div>
          </div>

          {/* Promo Reward Panel */}
          <div className="flex flex-col border border-[#333] bg-[#111] rounded-sm overflow-hidden">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1A1A1A]">
                   <div className="flex items-center gap-2">
                       <Zap size={16} className="text-blue-400" />
                       <span className="text-xs font-bold text-white uppercase tracking-widest">Promo Rewards</span>
                   </div>
                   <div className="text-[10px] text-zinc-500 font-mono">EMAIL + AMOUNT + PROMO</div>
              </div>
              <div className="flex-1 p-4 space-y-3">
                <input
                  value={rawPromoEmail}
                  onChange={(e) => setRawPromoEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                />
                <input
                  value={rawPromoAmount}
                  onChange={(e) => setRawPromoAmount(e.target.value)}
                  placeholder="Reward amount"
                  className="w-full bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                />
                <input
                  value={rawPromoCode}
                  onChange={(e) => setRawPromoCode(e.target.value)}
                  placeholder="Promo label (optional)"
                  className="w-full bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                />
                <div className="text-[10px] text-zinc-600 font-mono">
                  These rewards will appear in Rewards as Promo totals (blue).
                </div>
              </div>
              <div className="p-4 border-t border-[#333] bg-[#1A1A1A]">
                  <button onClick={handlePromoRewardAdd} className="w-full py-2 bg-[#222] hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-sm border border-[#333] hover:border-blue-500 transition-all flex items-center justify-center gap-2 group">
                      <Save size={14} className="group-hover:scale-110 transition-transform" /> Add Promo Reward
                  </button>
              </div>
          </div>
      </div>
  );

  const CommandCenterView = () => {
      const ready = model.accountsReady.filter((a: any) => (searchTerm ? a.emailKey.includes(safeLower(searchTerm)) : true));

      const toggleSelection = (emailKey: string) => {
          setSelectedReady(prev => {
              const next = new Set(prev);
              if (next.has(emailKey)) next.delete(emailKey);
              else next.add(emailKey);
              return next;
          });
      };

      const selectTop = (count: number) => {
          const top = ready.slice(0, count).map(a => a.emailKey);
          setSelectedReady(new Set(top));
      };

      const copySelected = () => {
          if (selectedReady.size === 0) {
              pushToast("warn", "No accounts selected");
              return;
          }
          const selectedRows = ready.filter(a => selectedReady.has(a.emailKey));
          const text = accountsToTSV(selectedRows);
          copyToClipboard(text);
          pushToast("ok", "Copied to Clipboard", `${selectedRows.length} accounts ready for paste`);
      };

      return (
          <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between bg-[#111] p-4 rounded-sm border border-[#333]">
                  <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                          <h2 className="text-white font-bold uppercase tracking-wider flex items-center gap-2">
                              <Target size={20} className="text-[#F40009]"/> Command Center
                          </h2>
                          <span className="text-xs text-zinc-500">{ready.length} AVAILABLE ACCOUNTS</span>
                      </div>
                      <div className="h-8 w-[1px] bg-[#333]" />
                      <div className="flex gap-2">
                          <button onClick={() => selectTop(10)} className="px-3 py-1.5 bg-[#222] hover:bg-[#333] text-white text-[10px] font-bold uppercase tracking-widest rounded-sm border border-[#333] transition-colors">Select Top 10</button>
                          <button onClick={() => selectTop(25)} className="px-3 py-1.5 bg-[#222] hover:bg-[#333] text-white text-[10px] font-bold uppercase tracking-widest rounded-sm border border-[#333] transition-colors">Select Top 25</button>
                          <button onClick={() => selectTop(50)} className="px-3 py-1.5 bg-[#222] hover:bg-[#333] text-white text-[10px] font-bold uppercase tracking-widest rounded-sm border border-[#333] transition-colors">Select Top 50</button>
                          <button onClick={() => setSelectedReady(new Set())} className="px-3 py-1.5 bg-transparent hover:bg-[#222] text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-sm transition-colors">Clear</button>
                      </div>
                  </div>
                  <button onClick={copySelected} className="flex items-center gap-2 px-6 py-2 bg-[#F40009] hover:bg-red-600 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-all shadow-[0_0_15px_rgba(244,0,9,0.3)] hover:shadow-[0_0_25px_rgba(244,0,9,0.5)]">
                      <Copy size={14} /> Copy Selected ({selectedReady.size})
                  </button>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {ready.map((a: any) => {
                      const isSelected = selectedReady.has(a.emailKey);
                      return (
                          <div 
                              key={a.emailKey} 
                              onClick={() => toggleSelection(a.emailKey)}
                              className={`relative p-4 border rounded-sm cursor-pointer transition-all group ${isSelected ? "bg-[#1A1A1A] border-[#F40009]" : "bg-[#111] border-[#333] hover:border-zinc-500"}`}
                          >
                              <div className="flex justify-between items-start mb-2">
                                  <div className={`w-3 h-3 rounded-sm border ${isSelected ? "bg-[#F40009] border-[#F40009]" : "border-zinc-600"}`}>
                                      {isSelected && <CheckSquare size={10} className="text-white" />}
                                  </div>
                                  {a.tier === "Gold" && <Badge kind="gold">GOLD</Badge>}
                                  {a.tier === "Platinum" && <Badge kind="plat">PLAT</Badge>}
                              </div>
                              <div className="font-mono text-xs text-white truncate mb-1">{a.email}</div>
                              <div className="flex justify-between items-end">
                                  <div className="text-[10px] text-zinc-500 font-mono">
                                      <div>BAL: <span className="text-zinc-300">{money(a.netBalance)}</span></div>
                                      <div>CONF: {a.confirmedBookings}</div>
                                  </div>
                                  <div className="text-[10px] text-zinc-600 font-mono">
                                      PASS: {a.password ? "YES" : "NO"}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const HotelIntelligenceView = () => {
      const top = model.derivedHotels.slice(0, 50);
      const badActors = model.derivedHotels.filter((h: any) => h.cancelled >= 3 && h.reliability < 50);
      const filter = tableFilters.hotelIntel;
      const sort = tableSorts.hotelIntel;
      const filtered = top.filter((h: any) => {
        if (!filter) return true;
        const haystack = `${h.name} ${h.hotelId}`.toLowerCase();
        return haystack.includes(filter.toLowerCase());
      });
      const ranked = sortRows(filtered, sort.key, sort.dir);

      return (
          <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Scatter Plot */}
                  <div className="bg-[#111] border border-[#333] rounded-sm p-6">
                      <h3 className="text-white font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                          <ScatterChart size={18} className="text-blue-500" /> Reliability Matrix
                      </h3>
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart>
                                  <CartesianGrid strokeDasharray="3 3" stroke={AUDI_COLORS.grid} />
                                  <XAxis type="number" dataKey="totalBookings" name="Volume" stroke="#666" tick={{fontSize: 10}} label={{ value: 'Volume', position: 'insideBottomRight', offset: -5, fill: '#666', fontSize: 10 }} />
                                  <YAxis type="number" dataKey="reliability" name="Reliability" stroke="#666" tick={{fontSize: 10}} unit="%" />
                                  <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={theme.tooltip} />
                                  <Scatter name="Hotels" data={top} fill="#3B82F6" />
                              </ScatterChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Bad Actors */}
                  <div className="bg-[#111] border border-[#333] rounded-sm p-6 overflow-hidden flex flex-col">
                      <h3 className="text-white font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-red-500">
                          <Ban size={18} /> High Risk Hotels
                      </h3>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                          {badActors.length === 0 ? <div className="text-zinc-600 text-xs italic">No high-risk hotels detected.</div> : 
                              badActors.map((h: any) => (
                                  <div key={h.hotelId} className="flex justify-between items-center p-3 bg-[#1A0505] border border-red-900/30 rounded-sm">
                                      <div className="truncate pr-4">
                                          <div className="text-red-200 text-xs font-bold truncate">{h.name}</div>
                                          <div className="text-[10px] text-red-400/60 font-mono">{h.hotelId}</div>
                                      </div>
                                      <div className="text-right shrink-0">
                                          <div className="text-red-500 font-bold text-xs">{h.reliability.toFixed(0)}% REL</div>
                                          <div className="text-[10px] text-red-400">{h.cancelled} CANC</div>
                                      </div>
                                  </div>
                              ))
                          }
                      </div>
                  </div>
              </div>

              {/* Main Ranking Table */}
              <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
                  <div className="p-4 border-b border-[#333] bg-[#1A1A1A] flex flex-wrap gap-3 justify-between items-center">
                      <div className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                          <Trophy size={16} className="text-yellow-500" /> Hotel Ranking (Top 50)
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={filter}
                          onChange={(e) => setTableFilters((prev) => ({ ...prev, hotelIntel: e.target.value }))}
                          placeholder="Filter hotels"
                          className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                        />
                        <select
                          value={`${sort.key}:${sort.dir}`}
                          onChange={(e) => {
                            const [key, dir] = e.target.value.split(":");
                            setTableSorts((prev) => ({ ...prev, hotelIntel: { key, dir: dir as "asc" | "desc" } }));
                          }}
                          className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
                        >
                          <option value="rankScore:desc">Score ↓</option>
                          <option value="rankScore:asc">Score ↑</option>
                          <option value="reliability:desc">Reliability ↓</option>
                          <option value="reliability:asc">Reliability ↑</option>
                          <option value="totalBookings:desc">Bookings ↓</option>
                          <option value="totalBookings:asc">Bookings ↑</option>
                        </select>
                      </div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-zinc-400">
                          <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500">
                              <tr>
                                  <th className="px-6 py-3">Rank</th>
                                  <th className="px-6 py-3">Hotel</th>
                                  <th className="px-6 py-3">Score</th>
                                  <th className="px-6 py-3">Reliability</th>
                                  <th className="px-6 py-3">Volume</th>
                                  <th className="px-6 py-3 text-right">Spend</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222]">
                              {ranked.map((h: any, idx: number) => (
                                  <tr key={h.hotelId} className="hover:bg-[#1A1A1A] transition-colors">
                                      <td className="px-6 py-3 font-mono text-white">#{idx + 1}</td>
                                      <td className="px-6 py-3">
                                          <div className="text-white text-xs font-bold truncate max-w-[200px]">{h.name}</div>
                                          <div className="text-[10px] text-zinc-600 font-mono">{h.hotelId}</div>
                                      </td>
                                      <td className="px-6 py-3 font-mono text-[#F40009] font-bold">{h.rankScore.toFixed(1)}</td>
                                      <td className="px-6 py-3">
                                          <div className="flex items-center gap-2">
                                              <div className="w-12 h-1.5 bg-[#222] rounded-full overflow-hidden">
                                                  <div className="h-full bg-blue-500" style={{width: `${h.reliability}%`}}/>
                                              </div>
                                              <span className="text-xs">{h.reliability.toFixed(0)}%</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-3 text-xs font-mono">
                                          <span className="text-white">{h.totalBookings}</span>
                                          <span className="text-zinc-600 mx-1">/</span>
                                          <span className="text-green-500">{h.confirmed}</span>
                                      </td>
                                      <td className="px-6 py-3 text-right font-mono text-zinc-300">{money(h.spent)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const HotelsView = () => {
    const filter = tableFilters.hotels;
    const sort = tableSorts.hotels;
    const filtered = model.derivedHotels.filter((h: any) => {
      if (!filter) return true;
      const haystack = `${h.name} ${h.hotelId}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    });
    const rows = sortRows(filtered, sort.key, sort.dir);

    return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[#111] border border-[#333] rounded-sm p-6">
          <PanelHeader
            icon={Building}
            title="Hotel Operations"
            subtitle="Live status, reliability, and booking performance"
            actions={
              <button onClick={() => downloadCSV("hotels.csv", model.derivedHotels)} className="px-3 py-1.5 bg-[#222] border border-[#333] rounded-sm text-[10px] uppercase tracking-widest text-zinc-300 hover:text-white">
                Export
              </button>
            }
          />
          <div className="flex flex-wrap gap-2">
            <DataPill label="Total" value={model.derivedHotels.length} />
            <DataPill label="Eligible" value={model.hotelsEligible.length} color="#4ADE80" />
            <DataPill label="Blocked" value={model.derivedHotels.filter((h: any) => h.isBlocked).length} color="#F40009" />
          </div>
        </div>
        <div className="bg-[#111] border border-[#333] rounded-sm p-6">
          <PanelHeader icon={ShieldAlert} title="Risk Summary" subtitle="Auto and manual block coverage" />
          <div className="space-y-3 text-xs text-zinc-500">
            {model.derivedHotels.slice(0, 4).map((h: any) => (
              <div key={h.hotelId} className="flex items-center justify-between">
                <span className="text-zinc-400 truncate max-w-[180px]">{h.name}</span>
                <span className={h.isBlocked ? "text-[#F40009]" : "text-zinc-600"}>{h.isBlocked ? "BLOCKED" : `${h.reliability.toFixed(0)}%`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
        <div className="bg-[#1A1A1A] border-b border-[#333] px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="text-xs text-zinc-500 uppercase tracking-widest">Hotel Registry</div>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setTableFilters((prev) => ({ ...prev, hotels: e.target.value }))}
              placeholder="Filter hotels"
              className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
            />
            <select
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setTableSorts((prev) => ({ ...prev, hotels: { key, dir: dir as "asc" | "desc" } }));
              }}
              className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
            >
              <option value="rankScore:desc">Rank Score ↓</option>
              <option value="rankScore:asc">Rank Score ↑</option>
              <option value="reliability:desc">Reliability ↓</option>
              <option value="reliability:asc">Reliability ↑</option>
              <option value="totalBookings:desc">Bookings ↓</option>
              <option value="totalBookings:asc">Bookings ↑</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500 sticky top-0">
              <tr>
                <th className="px-6 py-3">Hotel</th>
                <th className="px-6 py-3">Reliability</th>
                <th className="px-6 py-3">Bookings</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {rows.map((h: any) => (
                <tr key={h.hotelId} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="px-6 py-3">
                    <div className="text-white font-bold text-xs truncate max-w-[220px]">{h.name}</div>
                    <div className="text-[10px] text-zinc-600 font-mono">{h.hotelId}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div className={`h-full ${h.reliability > 80 ? "bg-green-500" : h.reliability > 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${h.reliability}%` }} />
                      </div>
                      <span className="text-xs">{h.reliability.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-xs font-mono">
                    <span className="text-white">{h.totalBookings}</span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className="text-green-500">{h.confirmed}</span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className="text-blue-400">{h.completed}</span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className="text-red-400">{h.cancelled}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {h.isBlocked ? <Badge kind="block">BLOCK</Badge> : <Badge kind="active">OK</Badge>}
                      {h.techBlocked && <Badge kind="tech">TECH</Badge>}
                    </div>
                    {h.blockReason && <div className="text-[10px] text-red-400 mt-1">{h.blockReason}</div>}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-zinc-300">{money(h.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  };

  const SpentView = () => {
    const filter = tableFilters.spent;
    const sort = tableSorts.spent;
    const filtered = state.sales.filter((s: any) => {
      if (!filter) return true;
      const haystack = `${s.email} ${s.note ?? ""} ${s.date}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    });
    const sorted = sortRows(filtered, sort.key, sort.dir);
    const totalSpent = sorted.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-[#111] border border-[#333] rounded-sm p-6">
            <PanelHeader
              icon={Wallet}
              title="Spend Ledger"
              subtitle="Expense tracking and reimbursements"
              actions={
                <button onClick={() => downloadCSV("spent.csv", state.sales)} className="px-3 py-1.5 bg-[#222] border border-[#333] rounded-sm text-[10px] uppercase tracking-widest text-zinc-300 hover:text-white">
                  Export CSV
                </button>
              }
            />
            <div className="flex flex-wrap gap-2">
              <DataPill label="Total Spent" value={money(totalSpent)} color="#FACC15" />
              <DataPill label="Entries" value={sorted.length} />
            </div>
          </div>
          <div className="bg-[#111] border border-[#333] rounded-sm p-6">
            <PanelHeader icon={CreditCard} title="Latest Charges" subtitle="Most recent 4 entries" />
            <div className="space-y-2">
              {sorted.slice(0, 4).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between border border-[#222] rounded-sm px-3 py-2 bg-[#0F0F0F]">
                  <div>
                    <div className="text-xs text-white font-mono truncate max-w-[160px]">{s.email}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{s.date}</div>
                  </div>
                  <div className="text-xs text-yellow-300 font-mono">{money(s.amount)}</div>
                </div>
              ))}
              {sorted.length === 0 && <div className="text-xs text-zinc-600">No spending logged.</div>}
            </div>
          </div>
        </div>

        <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
          <div className="bg-[#1A1A1A] border-b border-[#333] px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
            <div className="text-xs text-zinc-500 uppercase tracking-widest">Spend Entries</div>
            <div className="flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setTableFilters((prev) => ({ ...prev, spent: e.target.value }))}
                placeholder="Filter spend"
                className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
              />
              <select
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(":");
                  setTableSorts((prev) => ({ ...prev, spent: { key, dir: dir as "asc" | "desc" } }));
                }}
                className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
              >
                <option value="date:desc">Newest</option>
                <option value="date:asc">Oldest</option>
                <option value="amount:desc">Amount ↓</option>
                <option value="amount:asc">Amount ↑</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500 sticky top-0">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Account</th>
                  <th className="px-6 py-3">Note</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {sorted.map((s: any) => (
                  <tr key={s.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="px-6 py-3 text-xs font-mono text-zinc-500">{s.date}</td>
                    <td className="px-6 py-3 text-xs text-white font-mono">{s.email}</td>
                    <td className="px-6 py-3 text-xs text-zinc-500">{s.note || "—"}</td>
                    <td className="px-6 py-3 text-right text-xs font-mono text-yellow-300">{money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const RewardView = () => {
    const rewardRows = state.bookings.filter((b: any) => Number(b.rewardAmount || 0) > 0 || b.rewardPaidOn);
    const paidRows = rewardRows.filter((b: any) => b.rewardPaidOn);
    const pendingRows = rewardRows
      .filter((b: any) => !b.rewardPaidOn)
      .map((b: any) => ({ ...b, eta: computeRewardETA(b, state.settings) }));
    const totalRewards = rewardRows.reduce((sum: number, b: any) => sum + Number(b.rewardAmount || 0), 0);
    const paidTotal = paidRows.reduce((sum: number, b: any) => sum + Number(b.rewardAmount || 0), 0);
    const pendingTotal = totalRewards - paidTotal;
    const pendingCount = pendingRows.length;
    const spentAll = state.sales.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
    const promoAll = (state.specialRewards || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    const filterPaid = tableFilters.rewardsPaid;
    const filterPending = tableFilters.rewardsPending;
    const sortPaid = tableSorts.rewardsPaid;
    const sortPending = tableSorts.rewardsPending;
    const salesByEmail = new Map<string, number>();
    for (const s of state.sales) {
      const key = safeLower(s.email);
      salesByEmail.set(key, (salesByEmail.get(key) || 0) + Number(s.amount || 0));
    }
    const promoByEmail = new Map<string, number>();
    for (const r of state.specialRewards || []) {
      const key = safeLower(r.email);
      promoByEmail.set(key, (promoByEmail.get(key) || 0) + Number(r.amount || 0));
    }

    const rewardSummary = model.derivedAccounts
      .map((acc: any) => {
        const accountPaid = paidRows.filter((b: any) => safeLower(b.email) === acc.emailKey);
        const accountPending = pendingRows.filter((b: any) => safeLower(b.email) === acc.emailKey);
        const paidTotalAcc = accountPaid.reduce((sum: number, b: any) => sum + Number(b.rewardAmount || 0), 0);
        const pendingTotalAcc = accountPending.reduce((sum: number, b: any) => sum + Number(b.rewardAmount || 0), 0);
        const lastPaidOn = accountPaid
          .map((b: any) => b.rewardPaidOn)
          .filter(Boolean)
          .sort((a: string, b: string) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))[0] || "";
        const daysSinceLast = lastPaidOn ? daysDiff(lastPaidOn) : null;
        const spentTotal = salesByEmail.get(acc.emailKey) || 0;
        const promoTotal = promoByEmail.get(acc.emailKey) || 0;
        let medal = "—";
        if (paidTotalAcc > 300 && pendingTotalAcc === 0 && daysSinceLast !== null) {
          if (daysSinceLast >= 40) medal = "Platinum";
          else if (daysSinceLast >= 20) medal = "Gold";
        } else if (paidTotalAcc >= 200 && paidTotalAcc <= 300 && daysSinceLast !== null) {
          medal = daysSinceLast <= 20 ? "Bronze/Silver" : "Silver";
        } else if (paidTotalAcc >= 50 && paidTotalAcc < 200) {
          medal = "Bronze";
        }
        return {
          email: acc.email,
          emailKey: acc.emailKey,
          paidTotal: paidTotalAcc,
          pendingTotal: pendingTotalAcc,
          promoTotal,
          spentTotal,
          lastPaidOn,
          daysSinceLast,
          medal,
          currentBalance: acc.netBalance,
        };
      })
      .filter((row) => row.paidTotal > 0 || row.pendingTotal > 0 || row.spentTotal > 0 || row.promoTotal > 0);

    const paidFiltered = rewardSummary.filter((row: any) => {
      if (!filterPaid) return true;
      const haystack = `${row.email} ${row.medal} ${row.lastPaidOn}`.toLowerCase();
      return haystack.includes(filterPaid.toLowerCase());
    });
    const pendingFiltered = pendingRows.filter((b: any) => {
      if (!filterPending) return true;
      const haystack = `${b.email} ${b.bookingNo} ${b.rewardType} ${b.eta}`.toLowerCase();
      return haystack.includes(filterPending.toLowerCase());
    });
    const paidSorted = sortRows(paidFiltered, sortPaid.key, sortPaid.dir);
    const pendingSorted = sortRows(pendingFiltered, sortPending.key, sortPending.dir);

    const trend = netTrend.map((d) => ({ date: d.date, earned: d.earned }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-[#111] border border-[#333] rounded-sm p-6">
            <PanelHeader
              icon={Zap}
              title="Reward Operations"
              subtitle="Paid vs upcoming reward pipeline"
              actions={
                <button onClick={() => downloadCSV("rewards.csv", rewardRows)} className="px-3 py-1.5 bg-[#222] border border-[#333] rounded-sm text-[10px] uppercase tracking-widest text-zinc-300 hover:text-white">
                  Export CSV
                </button>
              }
            />
            <div className="flex flex-wrap gap-2">
              <DataPill label="Total" value={money(totalRewards)} color="#4ADE80" />
              <DataPill label="Paid" value={money(paidTotal)} color="#4ADE80" />
              <DataPill label="Pending" value={money(pendingTotal)} color="#FACC15" />
              <DataPill label="Promo" value={money(promoAll)} color="#60A5FA" />
              <DataPill label="Spent" value={money(spentAll)} color="#FCA5A5" />
              <DataPill label="Balance Now" value={money(model.totalLeft)} color="#FFFFFF" />
              <DataPill label="Waiting" value={pendingCount} color="#FACC15" />
            </div>
          </div>
          <div className="bg-[#111] border border-[#333] rounded-sm p-6">
            <PanelHeader icon={TrendingUp} title="Reward Trend" subtitle="Last 30/90 days" />
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} minTickGap={30} />
                  <YAxis stroke={theme.axis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                  <RechartsTooltip contentStyle={theme.tooltip} />
                  <Line type="monotone" dataKey="earned" stroke="#4ADE80" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
            <div className="bg-[#1A1A1A] border-b border-[#333] px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
              <div className="text-xs text-zinc-500 uppercase tracking-widest">Paid Rewards (Primary)</div>
              <div className="flex items-center gap-2">
                <input
                  value={filterPaid}
                  onChange={(e) => setTableFilters((prev) => ({ ...prev, rewardsPaid: e.target.value }))}
                  placeholder="Filter paid"
                  className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                />
                <select
                  value={`${sortPaid.key}:${sortPaid.dir}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(":");
                    setTableSorts((prev) => ({ ...prev, rewardsPaid: { key, dir: dir as "asc" | "desc" } }));
                  }}
                  className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
                >
                  <option value="paidTotal:desc">Paid Total ↓</option>
                  <option value="paidTotal:asc">Paid Total ↑</option>
                  <option value="pendingTotal:desc">Pending ↓</option>
                  <option value="pendingTotal:asc">Pending ↑</option>
                  <option value="promoTotal:desc">Promo ↓</option>
                  <option value="promoTotal:asc">Promo ↑</option>
                  <option value="spentTotal:desc">Spent ↓</option>
                  <option value="spentTotal:asc">Spent ↑</option>
                  <option value="daysSinceLast:asc">Days Since Last ↑</option>
                  <option value="daysSinceLast:desc">Days Since Last ↓</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Account</th>
                    <th className="px-6 py-3">Medal Score</th>
                    <th className="px-6 py-3 text-right">Paid</th>
                    <th className="px-6 py-3 text-right">Pending</th>
                    <th className="px-6 py-3 text-right">Promo</th>
                    <th className="px-6 py-3 text-right">Spent</th>
                    <th className="px-6 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {paidSorted.map((row: any) => (
                    (() => {
                      const acc = model.derivedAccounts.find((a: any) => a.emailKey === row.emailKey);
                      const showPass = rewardPasswordVisible[row.emailKey];
                      return (
                    <tr key={row.emailKey} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-6 py-3 text-xs text-white font-mono">
                        <button
                          onClick={() => {
                            setRewardDetailAccount(row.email);
                            setRewardDetailOpen(true);
                          }}
                          className="hover:text-[#F40009] transition-colors text-left"
                        >
                          <div>{row.email}</div>
                          <div className="text-[10px] text-zinc-500">
                            Last paid {row.lastPaidOn || "—"} {row.daysSinceLast !== null ? `• ${row.daysSinceLast}d ago` : ""}
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => setRewardPasswordVisible((prev) => ({ ...prev, [row.emailKey]: !prev[row.emailKey] }))}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title="Show password"
                          >
                            {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          {showPass && <span className="text-[10px] text-blue-300 font-mono">{acc?.password || "NO_PASS"}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs text-zinc-300 font-mono">{row.medal}</td>
                      <td className="px-6 py-3 text-right text-xs font-mono text-green-400">{money(row.paidTotal)}</td>
                      <td className="px-6 py-3 text-right text-xs font-mono text-yellow-300">{money(row.pendingTotal)}</td>
                      <td className="px-6 py-3 text-right text-xs font-mono text-blue-400">{money(row.promoTotal)}</td>
                      <td className="px-6 py-3 text-right text-xs font-mono text-rose-300">{money(row.spentTotal)}</td>
                      <td className="px-6 py-3 text-right text-xs font-mono text-white">{money(row.currentBalance)}</td>
                    </tr>
                      );
                    })()
                  ))}
                  {paidSorted.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-6 text-center text-xs text-zinc-600">No reward activity yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
            <div className="bg-[#1A1A1A] border-b border-[#333] px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
              <div className="text-xs text-zinc-500 uppercase tracking-widest">Pending Rewards</div>
              <div className="flex items-center gap-2">
                <input
                  value={filterPending}
                  onChange={(e) => setTableFilters((prev) => ({ ...prev, rewardsPending: e.target.value }))}
                  placeholder="Filter pending"
                  className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
                />
                <select
                  value={`${sortPending.key}:${sortPending.dir}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(":");
                    setTableSorts((prev) => ({ ...prev, rewardsPending: { key, dir: dir as "asc" | "desc" } }));
                  }}
                  className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
                >
                  <option value="eta:asc">ETA Soonest</option>
                  <option value="eta:desc">ETA Latest</option>
                  <option value="rewardAmount:desc">Amount ↓</option>
                  <option value="rewardAmount:asc">Amount ↑</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Account</th>
                    <th className="px-6 py-3">Booking</th>
                    <th className="px-6 py-3">ETA</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {pendingSorted.map((b: any) => (
                    <tr key={b.bookingId} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-6 py-3 text-xs text-white font-mono">
                        <button
                          onClick={() => {
                            setRewardDetailAccount(b.email);
                            setRewardDetailOpen(true);
                          }}
                          className="hover:text-[#F40009] transition-colors"
                        >
                          {b.email}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-xs text-zinc-500 font-mono">{b.bookingNo}</td>
                      <td className="px-6 py-3 text-xs text-zinc-400 font-mono">{b.eta}</td>
                      <td className="px-6 py-3 text-right text-xs font-mono text-green-400">{money(b.rewardAmount)}</td>
                    </tr>
                  ))}
                  {pendingSorted.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-center text-xs text-zinc-600">No pending rewards.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const NextActionView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-[#333] rounded-sm p-6">
          <PanelHeader
            icon={Target}
            title="Accounts Ready"
            subtitle="Select accounts for fast copy"
            actions={(
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedNextAction(new Set(model.accountsReady.map((a: any) => a.emailKey)))}
                  className="px-2 py-1 text-[10px] uppercase rounded-sm border border-[#333] text-zinc-400 hover:text-white"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedNextAction(new Set())}
                  className="px-2 py-1 text-[10px] uppercase rounded-sm border border-[#333] text-zinc-400 hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    const selected = model.accountsReady.filter((a: any) => selectedNextAction.has(a.emailKey));
                    if (selected.length === 0) {
                      pushToast("warn", "No accounts selected");
                      return;
                    }
                    const text = accountsToTSV(selected);
                    copyToClipboard(text);
                    pushToast("ok", "Copied accounts", `${selected.length} rows`);
                  }}
                  className="px-3 py-1 text-[10px] uppercase rounded-sm border border-[#F40009] text-white bg-[#F40009]/80 hover:bg-[#F40009]"
                >
                  Copy Selected
                </button>
              </div>
            )}
          />
          <div className="space-y-2">
            {model.accountsReady.slice(0, 16).map((a: any) => {
              const selected = selectedNextAction.has(a.emailKey);
              return (
                <div
                  key={a.emailKey}
                  onClick={() => {
                    setSelectedNextAction((prev) => {
                      const next = new Set(prev);
                      if (next.has(a.emailKey)) next.delete(a.emailKey);
                      else next.add(a.emailKey);
                      return next;
                    });
                  }}
                  className={`flex items-center justify-between border rounded-sm px-3 py-2 cursor-pointer transition-colors ${
                    selected ? "bg-[#1A1A1A] border-[#F40009]" : "bg-[#0F0F0F] border-[#222]"
                  }`}
                >
                  <div>
                    <div className="text-xs text-white font-mono">{a.email}</div>
                    <div className="text-[10px] text-zinc-500">{a.confirmedBookings} confirmed • {a.activeBookingsCount} active</div>
                  </div>
                  <div className="text-xs text-green-400 font-mono">{money(a.netBalance)}</div>
                </div>
              );
            })}
            {model.accountsReady.length === 0 && <div className="text-xs text-zinc-600">No ready accounts available.</div>}
          </div>
        </div>
        <div className="bg-[#111] border border-[#333] rounded-sm p-6">
          <PanelHeader icon={Building2} title="Eligible Hotels" subtitle="Confirmed > 0, cancel ≤ 2, not blocked" />
          <div className="space-y-2">
            {model.hotelsEligible.slice(0, 12).map((h: any) => {
              const daysSince = h.lastBookingAt ? daysDiff(h.lastBookingAt) : null;
              return (
                <div key={h.hotelId} className="flex items-center justify-between border border-[#222] rounded-sm px-3 py-2 bg-[#0F0F0F]">
                  <div>
                    <div className="text-xs text-white font-mono truncate max-w-[220px]">{h.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {h.confirmed} conf • {h.cancelled} canc • {money(h.spent)}
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      Last booking {h.lastBookingAt || "—"} {daysSince !== null ? `• ${daysSince}d ago` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-blue-300 font-mono">{h.reliability.toFixed(0)}%</div>
                </div>
              );
            })}
            {model.hotelsEligible.length === 0 && <div className="text-xs text-zinc-600">No eligible hotels right now.</div>}
          </div>
        </div>
      </div>

      <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
        <div className="bg-[#1A1A1A] border-b border-[#333] px-6 py-3 text-xs text-zinc-500 uppercase tracking-widest">Action Playbook</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {[
            { title: "Select accounts", body: "Use Command Center to select the highest balance accounts for new bookings." },
            { title: "Pick hotels", body: "Prioritize hotels with high reliability and low cancellation rates." },
            { title: "Track rewards", body: "Monitor ETA and paid rewards in Reward Ops dashboard." },
          ].map((card) => (
            <div key={card.title} className="border border-[#222] rounded-sm p-4 bg-[#0F0F0F]">
              <div className="text-xs text-white font-bold uppercase tracking-widest mb-2">{card.title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{card.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const SheetView = () => {
    const filter = tableFilters.sheet;
    const sort = tableSorts.sheet;
    const filtered = model.derivedAccounts.filter((a: any) => {
      if (!filter) return true;
      const haystack = `${a.email} ${a.tier} ${a.password ?? ""}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    });
    const rows = sortRows(filtered, sort.key, sort.dir);

    return (
    <div className="space-y-6">
      <div className="bg-[#111] border border-[#333] rounded-sm p-6">
        <PanelHeader
          icon={Sheet}
          title="Sheet Mode"
          subtitle="Tabular export view for quick copy/paste"
          actions={
            <button onClick={() => downloadCSV("accounts_sheet.csv", model.derivedAccounts)} className="px-3 py-1.5 bg-[#222] border border-[#333] rounded-sm text-[10px] uppercase tracking-widest text-zinc-300 hover:text-white">
              Export CSV
            </button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <DataPill label="Accounts" value={model.derivedAccounts.length} />
          <DataPill label="Missing Pass" value={totals.missingPasswords} color="#FACC15" />
          <DataPill label="Gold/Plat" value={model.premium.length} color="#FACC15" />
        </div>
      </div>

      <div className="border border-[#333] bg-[#111] rounded-sm overflow-hidden">
        <div className="bg-[#1A1A1A] border-b border-[#333] px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="text-xs text-zinc-500 uppercase tracking-widest">Account Sheet</div>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setTableFilters((prev) => ({ ...prev, sheet: e.target.value }))}
              placeholder="Filter accounts"
              className="bg-[#0A0A0A] border border-[#333] rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#F40009] outline-none"
            />
            <select
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setTableSorts((prev) => ({ ...prev, sheet: { key, dir: dir as "asc" | "desc" } }));
              }}
              className="bg-[#0A0A0A] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white"
            >
              <option value="email:asc">Email A-Z</option>
              <option value="email:desc">Email Z-A</option>
              <option value="netBalance:desc">Net Balance ↓</option>
              <option value="netBalance:asc">Net Balance ↑</option>
              <option value="totalBookings:desc">Bookings ↓</option>
              <option value="totalBookings:asc">Bookings ↑</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-[#151515] text-[10px] uppercase font-bold text-zinc-500 sticky top-0">
              <tr>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Password</th>
                <th className="px-6 py-3">Tier</th>
                <th className="px-6 py-3">Net</th>
                <th className="px-6 py-3">Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {rows.map((a: any) => (
                <tr key={a.emailKey} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="px-6 py-3 text-xs text-white font-mono">{a.email}</td>
                  <td className="px-6 py-3 text-xs text-zinc-500 font-mono">{a.password || "—"}</td>
                  <td className="px-6 py-3 text-xs">
                    {a.tier === "Gold" && <Badge kind="gold">GOLD</Badge>}
                    {a.tier === "Platinum" && <Badge kind="plat">PLAT</Badge>}
                    {a.tier === "Standard" && <Badge>STD</Badge>}
                  </td>
                  <td className="px-6 py-3 text-xs text-zinc-300 font-mono">{money(a.netBalance)}</td>
                  <td className="px-6 py-3 text-xs text-zinc-500 font-mono">{a.totalBookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const NAV_ITEMS = [
    { id: "overview", icon: LayoutDashboard, label: "Overview" },
    { id: "command_center", icon: Target, label: "Command Center" },
    { id: "hotel_intel", icon: Building2, label: "Hotel Intel" },
    { id: "hotels", icon: Building, label: "Hotels" },
    { id: "bookings", icon: BookOpen, label: "Bookings" },
    { id: "database", icon: Users, label: "Database" },
    { id: "rawdata", icon: Database, label: "RawData" },
    { id: "sheet", icon: Sheet, label: "Sheet" },
    { id: "spent", icon: Wallet, label: "Spent" },
    { id: "reward", icon: Zap, label: "Rewards" },
    { id: "next_action", icon: Activity, label: "Next Action" },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-[#F40009] selection:text-white flex overflow-hidden">
      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
        body { background-color: #000; }
      `}</style>

      {/* SIDEBAR */}
      <aside className="w-20 bg-[#050505] border-r border-[#222] flex flex-col items-center py-6 z-20 shrink-0">
        <div className="w-10 h-10 bg-[#F40009] text-white flex items-center justify-center font-bold text-xl tracking-tighter rounded-sm mb-12 shadow-[0_0_20px_rgba(244,0,9,0.4)]">//</div>
        <nav className="flex flex-col gap-6 w-full items-center">
          {NAV_ITEMS.map((item) => {
             const active = activeTab === item.id;
             return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative group flex items-center justify-center w-12 h-12 rounded-sm transition-all duration-300 ${active ? "bg-[#111] text-white" : "text-zinc-600 hover:text-zinc-300 hover:bg-[#111]"}`}>
                <item.icon size={22} strokeWidth={active ? 2 : 1.5} />
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#F40009]" />}
                <div className="absolute left-14 bg-[#222] text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-[#333] z-50">{item.label}</div>
              </button>
             );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-4">
             <button onClick={() => setGlobalActionsOpen(true)} className="text-zinc-600 hover:text-white transition-colors"><Command size={20} /></button>
             <button onClick={() => setSettingsOpen(true)} className="text-zinc-600 hover:text-white transition-colors"><Settings size={20} /></button>
             <button onClick={() => setAuditOpen(true)} className="text-zinc-600 hover:text-white transition-colors"><History size={20} /></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-black relative">
         <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-[#111] to-transparent pointer-events-none opacity-50" />
         <header className="h-16 flex items-center justify-between px-8 border-b border-[#222] bg-black/80 backdrop-blur-md z-10 shrink-0">
             <div className="flex items-center gap-4">
                 <h1 className="text-lg font-bold text-white uppercase tracking-[0.2em]">{activeTab.replace("_", " ")}</h1>
                 <div className="h-4 w-[1px] bg-[#333]" />
                 <div className="flex gap-4 text-[10px] text-zinc-500 font-mono">
                     <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>ONLINE</span>
                     <span>v5.6.0</span>
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <div className="relative group">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#F40009] transition-colors" size={14} />
                     <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="SEARCH DATABASE" 
                       className="bg-[#111] border border-[#333] rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-zinc-700 focus:border-[#F40009] focus:w-64 w-48 transition-all outline-none" />
                 </div>
                 <button onClick={handleExportJSON} className="p-2 hover:bg-[#222] rounded-sm text-zinc-400 hover:text-white transition-colors" title="Export JSON"><FileJson size={18}/></button>
                 <button onClick={() => setImportOpen(true)} className="p-2 hover:bg-[#222] rounded-sm text-zinc-400 hover:text-white transition-colors" title="Import JSON"><Download size={18}/></button>
             </div>
         </header>

         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
             <div className="max-w-[1600px] mx-auto pb-20">
                {activeTab === "overview" && <OverviewView />}
                {activeTab === "database" && <DatabaseView />}
                {activeTab === "bookings" && <BookingsView />}
                {activeTab === "rawdata" && <RawDataView />}
                {activeTab === "sheet" && <SheetView />}
                {activeTab === "command_center" && <CommandCenterView />}
                {activeTab === "hotel_intel" && <HotelIntelligenceView />}
                {activeTab === "hotels" && <HotelsView />}
                {activeTab === "spent" && <SpentView />}
                {activeTab === "reward" && <RewardView />}
                {activeTab === "next_action" && <NextActionView />}
             </div>
         </div>
      </main>

      <Toasts toasts={toasts} onDismiss={(id: string) => setToasts((p) => p.filter((t: any) => t.id !== id))} />

      <Modal open={settingsOpen} title="System Configuration" onClose={() => setSettingsOpen(false)}>
           <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-[#050505] p-4 rounded-sm border border-[#222]">
                         <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Gold Threshold</label>
                         <input type="number" value={state.settings.goldThreshold} onChange={(e) => setSettings({goldThreshold: Number(e.target.value)})} className="w-full bg-black border border-[#333] p-2 text-white font-mono text-sm focus:border-[#F40009] outline-none" />
                     </div>
                     <div className="bg-[#050505] p-4 rounded-sm border border-[#222]">
                         <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Max Active Bookings</label>
                         <input type="number" value={state.settings.maxActiveBookings} onChange={(e) => setSettings({maxActiveBookings: Number(e.target.value)})} className="w-full bg-black border border-[#333] p-2 text-white font-mono text-sm focus:border-[#F40009] outline-none" />
                     </div>
                     <div className="bg-[#050505] p-4 rounded-sm border border-[#222]">
                         <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Cooldown Days</label>
                         <input type="number" value={state.settings.cooldownDays} onChange={(e) => setSettings({cooldownDays: Number(e.target.value)})} className="w-full bg-black border border-[#333] p-2 text-white font-mono text-sm focus:border-[#F40009] outline-none" />
                     </div>
                     <div className="bg-[#050505] p-4 rounded-sm border border-[#222]">
                         <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Platinum After Days</label>
                         <input type="number" value={state.settings.platinumAfterDays} onChange={(e) => setSettings({platinumAfterDays: Number(e.target.value)})} className="w-full bg-black border border-[#333] p-2 text-white font-mono text-sm focus:border-[#F40009] outline-none" />
                     </div>
                </div>
                <div className="bg-[#050505] p-4 rounded-sm border border-[#222] flex justify-between items-center">
                    <div>
                        <div className="text-sm font-bold text-white">Auto-Create Entities</div>
                        <div className="text-xs text-zinc-500">Create missing accounts during paste import</div>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${state.settings.autoCreateFromImport ? "bg-[#F40009]" : "bg-[#333]"}`} onClick={() => setSettings({autoCreateFromImport: !state.settings.autoCreateFromImport})}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${state.settings.autoCreateFromImport ? "left-6" : "left-1"}`} />
                    </div>
                </div>
                <div className="bg-[#050505] p-4 rounded-sm border border-[#222] flex justify-between items-center">
                    <div>
                        <div className="text-sm font-bold text-white">Auto-Write TECH Blocks</div>
                        <div className="text-xs text-zinc-500">Auto-flag accounts/hotels after TECH threshold</div>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${state.settings.autoWriteTechBlocks ? "bg-[#F40009]" : "bg-[#333]"}`} onClick={() => setSettings({autoWriteTechBlocks: !state.settings.autoWriteTechBlocks})}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${state.settings.autoWriteTechBlocks ? "left-6" : "left-1"}`} />
                    </div>
                </div>
           </div>
      </Modal>

      <Modal open={globalActionsOpen} title="Global Command Center" onClose={() => setGlobalActionsOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => copyAllEmails()} className="p-4 bg-[#111] border border-[#333] hover:border-[#F40009] rounded-sm text-left group transition-all">
                  <div className="text-white font-bold uppercase text-sm mb-1 group-hover:text-[#F40009]">Copy All Emails</div>
                  <div className="text-xs text-zinc-500">Copy entire database email list to clipboard</div>
              </button>
              <button onClick={() => copyAllEmails((a) => a.tier === "Gold" || a.tier === "Platinum")} className="p-4 bg-[#111] border border-[#333] hover:border-[#F40009] rounded-sm text-left group transition-all">
                  <div className="text-white font-bold uppercase text-sm mb-1 group-hover:text-[#F40009]">Copy Gold/Plat</div>
                  <div className="text-xs text-zinc-500">Filter and copy premium accounts only</div>
              </button>
              <button onClick={() => downloadCSV("database_export.csv", state.database)} className="p-4 bg-[#111] border border-[#333] hover:border-[#F40009] rounded-sm text-left group transition-all">
                  <div className="text-white font-bold uppercase text-sm mb-1 group-hover:text-[#F40009]">Export Full CSV</div>
                  <div className="text-xs text-zinc-500">Download complete database backup</div>
              </button>
              <button onClick={() => downloadCSV("bookings_export.csv", state.bookings)} className="p-4 bg-[#111] border border-[#333] hover:border-[#F40009] rounded-sm text-left group transition-all">
                  <div className="text-white font-bold uppercase text-sm mb-1 group-hover:text-[#F40009]">Export Bookings</div>
                  <div className="text-xs text-zinc-500">Download booking history</div>
              </button>
              <button onClick={handleExportJSON} className="p-4 bg-[#111] border border-[#333] hover:border-[#F40009] rounded-sm text-left group transition-all">
                  <div className="text-white font-bold uppercase text-sm mb-1 group-hover:text-[#F40009]">Export JSON</div>
                  <div className="text-xs text-zinc-500">Snapshot settings + per-account data</div>
              </button>
          </div>
      </Modal>

      <Modal open={importOpen} title="JSON Import" onClose={() => setImportOpen(false)}>
          <div className="space-y-4">
              <div className="p-4 bg-[#220000] border border-red-900/30 rounded-sm text-red-200 text-xs">
                  <AlertTriangle size={14} className="inline mr-2" />
                  Warning: Importing will overwrite current state database.
              </div>
              <textarea value={importPayload} onChange={(e) => setImportPayload(e.target.value)} className="w-full h-64 bg-black border border-[#333] p-4 font-mono text-xs text-zinc-300 outline-none focus:border-[#F40009]" placeholder="{ JSON PAYLOAD }" />
              {importError && <div className="text-xs text-red-400">{importError}</div>}
              <button onClick={() => handleImport(JSON.parse(importPayload))} className="w-full py-3 bg-[#F40009] text-white font-bold uppercase tracking-widest hover:bg-red-600 transition-colors">Execute Restore</button>
          </div>
      </Modal>

      <Modal open={auditOpen} title="Audit Log (last 400 events)" onClose={() => setAuditOpen(false)}>
        <div className="space-y-3">
          {(state.audit || []).slice().reverse().map((entry: any) => (
            <div key={entry.id} className="border border-[#222] rounded-sm p-3 bg-[#0F0F0F]">
              <div className="text-xs text-zinc-500 font-mono">{entry.at}</div>
              <div className="text-xs text-white font-bold uppercase tracking-widest mt-1">{entry.type}</div>
              <div className="text-xs text-zinc-400 mt-1">{entry.msg}</div>
            </div>
          ))}
          {(!state.audit || state.audit.length === 0) && <div className="text-xs text-zinc-600">No audit events yet.</div>}
        </div>
      </Modal>

      <Modal open={rewardDetailOpen} title="Reward Detail Console" onClose={() => setRewardDetailOpen(false)}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0F0F0F] border border-[#222] rounded-sm p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest">Account</div>
              <div className="text-sm text-white font-mono mt-1">{rewardDetailAccount || "—"}</div>
              <div className="text-xs text-zinc-500 mt-2">
                Status: <span className={rewardAccount?.isBlocked ? "text-red-400" : "text-green-400"}>{rewardAccount?.isBlocked ? "BLOCKED" : "ACTIVE"}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Tier: <span className="text-white">{rewardAccount?.tier || "Standard"}</span></div>
            </div>
            <div className="bg-[#0F0F0F] border border-[#222] rounded-sm p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest">Pending Rewards</div>
              <div className="text-2xl text-green-400 font-bold mt-1">{money(rewardAccountPendingTotal)}</div>
              <div className="text-xs text-zinc-500 mt-1">{rewardAccountPending.length} upcoming rewards</div>
            </div>
            <div className="bg-[#0F0F0F] border border-[#222] rounded-sm p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest">Future Balance</div>
              <div className="text-2xl text-white font-bold mt-1">{money(rewardFutureBalance)}</div>
              <div className="text-xs text-zinc-500 mt-1">Current {money(rewardAccount?.netBalance || 0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[#0F0F0F] border border-[#222] rounded-sm p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Pending Rewards</div>
              <div className="space-y-2">
                {rewardAccountPending.map((b: any) => (
                  <div key={b.bookingId} className="flex items-center justify-between border border-[#222] rounded-sm px-3 py-2">
                    <div>
                      <div className="text-xs text-white font-mono">{b.bookingNo}</div>
                      <div className="text-[10px] text-zinc-500">ETA {b.eta}</div>
                    </div>
                    <div className="text-xs text-green-400 font-mono">{money(b.rewardAmount)}</div>
                  </div>
                ))}
                {rewardAccountPending.length === 0 && <div className="text-xs text-zinc-600">No pending rewards.</div>}
              </div>
            </div>
            <div className="bg-[#0F0F0F] border border-[#222] rounded-sm p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Account Booking Health</div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="text-green-400">Positive: {rewardAccountPositive.length}</span>
                <span className="text-red-400">Negative: {rewardAccountNegative.length}</span>
              </div>
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {rewardAccountBookings.map((b: any) => (
                  <div key={b.bookingId} className="flex items-center justify-between text-[10px] text-zinc-400 border border-[#222] rounded-sm px-3 py-2">
                    <span>{b.bookingNo} • {b.status}</span>
                    <span>{money(b.rewardAmount)}</span>
                  </div>
                ))}
                {rewardAccountBookings.length === 0 && <div className="text-xs text-zinc-600">No bookings for this account.</div>}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

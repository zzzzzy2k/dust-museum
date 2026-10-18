export type Status = "active" | "idle" | "disposal";
export type Filter = "all" | "active" | "idle" | "disposal";
export type SortKey = "idle" | "value" | "release" | "category";
export type Theme = "light" | "dark";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Device {
  id: string;
  name: string;
  categoryId: string;
  purchaseDate: string | null;
  price: number | null;
  releaseDate: string | null;
  releasePrice: number | null;
  lastUsedDate: string;
  note: string;
  createdAt: string;
  sample?: boolean;
}

export interface Settings {
  idleThreshold: number;
  disposeThreshold: number;
  categories: Category[];
}

export interface LedgerStore {
  version: 1;
  devices: Device[];
  settings: Settings;
}

export interface DeviceEntry extends Device {
  idleDays: number;
  status: Status;
  category: Category;
}

export interface LedgerStats {
  total: number;
  active: number;
  idle: number;
  disposal: number;
  idleDays: number;
  idleValue: number;
}

export const STORAGE_KEY = "chixia-ledger.v1";
export const THEME_KEY = "chixia-theme";
export const MAX_IDLE_THRESHOLD = 3650;
export const MAX_PRICE = 100_000_000;

export const CATEGORY_COLORS = [
  "#7f8fa3",
  "#8e9c95",
  "#a09181",
  "#948b9f",
  "#a28b8b",
  "#88939c",
  "#9c997f",
  "#9aa1a6",
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "phone", name: "手机平板", color: CATEGORY_COLORS[0] },
  { id: "computer", name: "电脑办公", color: CATEGORY_COLORS[1] },
  { id: "media", name: "影音阅读", color: CATEGORY_COLORS[2] },
  { id: "camera", name: "摄影器材", color: CATEGORY_COLORS[3] },
  { id: "gaming", name: "游戏设备", color: CATEGORY_COLORS[4] },
  { id: "home", name: "智能家居", color: CATEGORY_COLORS[5] },
  { id: "wearable", name: "穿戴设备", color: CATEGORY_COLORS[6] },
  { id: "other", name: "其他", color: CATEGORY_COLORS[7] },
];

export const STATUS_LABELS: Record<Status, string> = {
  active: "活跃",
  idle: "吃灰",
  disposal: "待处置",
};

const DAY_MS = 86_400_000;
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const integerFormatter = new Intl.NumberFormat("zh-CN");
const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isoToDayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / DAY_MS);
}

export function isValidDateISO(value: string): boolean {
  return isoToDayNumber(value) !== null;
}

export function normalizeDateInput(value: string): string | null {
  const match = /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
  return isValidDateISO(iso) ? iso : null;
}

export function daysSince(lastUsedDate: string, today = todayISO()): number {
  const start = isoToDayNumber(lastUsedDate);
  const end = isoToDayNumber(today);
  if (start === null || end === null) return 0;
  return Math.max(0, end - start);
}

export function shiftISO(value: string, days: number): string {
  const dayNumber = isoToDayNumber(value);
  if (dayNumber === null) return value;
  const date = new Date((dayNumber + days) * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatDate(value: string | null): string {
  return value ? value.replaceAll("-", ".") : "未记录";
}

export function formatMonthDay(value: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[1])} 月 ${Number(match[2])} 日`;
}

export function todayLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  return `${formatMonthDay(value)} · ${weekday}`;
}

export function formatInteger(value: number): string {
  return integerFormatter.format(Math.round(value));
}

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

export function getStatus(idleDays: number, settings: Settings): Status {
  if (idleDays >= settings.disposeThreshold) return "disposal";
  if (idleDays >= settings.idleThreshold) return "idle";
  return "active";
}

export function findCategory(categories: Category[], categoryId: string): Category {
  return (
    categories.find((category) => category.id === categoryId) ?? {
      id: categoryId || "unknown",
      name: "未分类",
      color: CATEGORY_COLORS[7],
    }
  );
}

export function nextCategoryColor(categories: Category[]): string {
  const used = new Set(categories.map((category) => category.color));
  return CATEGORY_COLORS.find((color) => !used.has(color)) ??
    CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
}

export function toEntries(devices: Device[], settings: Settings, today: string): DeviceEntry[] {
  return devices.map((device) => {
    const idleDays = daysSince(device.lastUsedDate, today);
    return {
      ...device,
      idleDays,
      status: getStatus(idleDays, settings),
      category: findCategory(settings.categories, device.categoryId),
    };
  });
}

export function filterAndSort(
  entries: DeviceEntry[],
  filter: Filter,
  sort: SortKey,
): DeviceEntry[] {
  const filtered = entries.filter((entry) => {
    if (filter === "all") return true;
    if (filter === "active") return entry.status === "active";
    if (filter === "disposal") return entry.status === "disposal";
    return entry.status !== "active";
  });

  return [...filtered].sort((a, b) => {
    if (sort === "value") {
      const priceDiff = (b.price ?? -1) - (a.price ?? -1);
      if (priceDiff !== 0) return priceDiff;
    } else if (sort === "category") {
      const categoryDiff = collator.compare(a.category.name, b.category.name);
      if (categoryDiff !== 0) return categoryDiff;
    } else if (sort === "release") {
      if (a.releaseDate !== b.releaseDate) {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return b.releaseDate.localeCompare(a.releaseDate);
      }
    }
    const daysDiff = b.idleDays - a.idleDays;
    if (daysDiff !== 0) return daysDiff;
    return collator.compare(a.name, b.name);
  });
}

export function computeStats(entries: DeviceEntry[]): LedgerStats {
  return entries.reduce<LedgerStats>(
    (stats, entry) => {
      stats.total += 1;
      if (entry.status === "active") {
        stats.active += 1;
      } else {
        stats.idle += 1;
        stats.idleDays += entry.idleDays;
        stats.idleValue += entry.price ?? 0;
      }
      if (entry.status === "disposal") stats.disposal += 1;
      return stats;
    },
    { total: 0, active: 0, idle: 0, disposal: 0, idleDays: 0, idleValue: 0 },
  );
}

export function longestIdle(entries: DeviceEntry[], limit = 5): DeviceEntry[] {
  return entries
    .filter((entry) => entry.status !== "active")
    .sort((a, b) => {
      const diff = b.idleDays - a.idleDays;
      return diff !== 0 ? diff : collator.compare(a.name, b.name);
    })
    .slice(0, limit);
}

export interface CategorySlice {
  category: Category;
  count: number;
  idleCount: number;
}

export function categoryBreakdown(entries: DeviceEntry[]): CategorySlice[] {
  const map = new Map<string, CategorySlice>();
  for (const entry of entries) {
    const existing = map.get(entry.category.id);
    if (existing) {
      existing.count += 1;
      if (entry.status !== "active") existing.idleCount += 1;
    } else {
      map.set(entry.category.id, {
        category: entry.category,
        count: 1,
        idleCount: entry.status === "active" ? 0 : 1,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || collator.compare(a.category.name, b.category.name),
  );
}

export function createSampleDevices(today = todayISO()): Device[] {
  const createdAt = new Date().toISOString();
  return [
    {
      id: "sample-kindle",
      name: "Kindle Paperwhite 4",
      categoryId: "media",
      purchaseDate: shiftISO(today, -1480),
      price: 998,
      releaseDate: "2018-11-07",
      releasePrice: 998,
      lastUsedDate: shiftISO(today, -412),
      note: "电池还健康，只是被手机替代了。",
      createdAt,
      sample: true,
    },
    {
      id: "sample-sony",
      name: "Sony WH-1000XM4",
      categoryId: "media",
      purchaseDate: shiftISO(today, -1040),
      price: 1899,
      releaseDate: "2020-08-06",
      releasePrice: 2899,
      lastUsedDate: shiftISO(today, -137),
      note: "降噪依旧能打，考虑留作差旅备用。",
      createdAt,
      sample: true,
    },
    {
      id: "sample-switch",
      name: "Nintendo Switch OLED",
      categoryId: "gaming",
      purchaseDate: shiftISO(today, -610),
      price: 2599,
      releaseDate: "2021-10-08",
      releasePrice: 2599,
      lastUsedDate: shiftISO(today, -6),
      note: "周末偶尔和朋友联机。",
      createdAt,
      sample: true,
    },
  ];
}

function defaultSettings(): Settings {
  return {
    idleThreshold: 90,
    disposeThreshold: 365,
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeCategory(raw: unknown): Category | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) return null;
  const color =
    typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color)
      ? raw.color
      : CATEGORY_COLORS[0];
  return { id, name: name.slice(0, 20), color };
}

export function normalizeDevice(raw: unknown): Device | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const lastUsedDate =
    typeof raw.lastUsedDate === "string" ? normalizeDateInput(raw.lastUsedDate) : null;
  if (!name || !lastUsedDate) return null;

  const purchaseDate =
    typeof raw.purchaseDate === "string" ? normalizeDateInput(raw.purchaseDate) : null;
  const price =
    typeof raw.price === "number" && Number.isFinite(raw.price) && raw.price >= 0
      ? Math.round(raw.price * 100) / 100
      : null;
  const releaseDate =
    typeof raw.releaseDate === "string" ? normalizeDateInput(raw.releaseDate) : null;
  const releasePrice =
    typeof raw.releasePrice === "number" &&
    Number.isFinite(raw.releasePrice) &&
    raw.releasePrice >= 0
      ? Math.round(raw.releasePrice * 100) / 100
      : null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId("device"),
    name: name.slice(0, 40),
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : "other",
    purchaseDate,
    price,
    releaseDate,
    releasePrice,
    lastUsedDate,
    note: typeof raw.note === "string" ? raw.note.slice(0, 200) : "",
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    ...(raw.sample === true ? { sample: true } : {}),
  };
}

export function normalizeStore(value: unknown): LedgerStore | null {
  if (!isRecord(value) || !Array.isArray(value.devices) || !isRecord(value.settings)) {
    return null;
  }

  const rawCategories = Array.isArray(value.settings.categories)
    ? value.settings.categories
    : [];
  const categories = rawCategories
    .map(normalizeCategory)
    .filter((category): category is Category => category !== null);
  const uniqueCategories = categories.filter(
    (category, index) => categories.findIndex((item) => item.id === category.id) === index,
  );

  const rawIdle = Number(value.settings.idleThreshold);
  const rawDispose = Number(value.settings.disposeThreshold);
  const thresholdsValid =
    Number.isInteger(rawIdle) &&
    rawIdle >= 1 &&
    rawIdle <= MAX_IDLE_THRESHOLD &&
    Number.isInteger(rawDispose) &&
    rawDispose > rawIdle &&
    rawDispose <= MAX_IDLE_THRESHOLD;
  const defaults = defaultSettings();

  const settings: Settings = {
    idleThreshold: thresholdsValid ? rawIdle : defaults.idleThreshold,
    disposeThreshold: thresholdsValid ? rawDispose : defaults.disposeThreshold,
    categories: uniqueCategories.length > 0 ? uniqueCategories : defaults.categories,
  };

  const devices = value.devices
    .map(normalizeDevice)
    .filter((device): device is Device => device !== null);

  return { version: 1, devices, settings };
}

export function parseStoredStore(raw: string | null): LedgerStore | null {
  if (!raw) return null;
  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadStore(): LedgerStore {
  try {
    const stored = parseStoredStore(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage can be unavailable in restricted browsing modes.
  }
  return {
    version: 1,
    devices: createSampleDevices(),
    settings: defaultSettings(),
  };
}

export function saveStore(store: LedgerStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The ledger still works in memory when storage is blocked.
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore blocked storage.
  }
}

export function buildBackup(store: LedgerStore): string {
  return JSON.stringify(
    {
      app: "吃灰台账",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: store.settings,
      devices: store.devices,
    },
    null,
    2,
  );
}

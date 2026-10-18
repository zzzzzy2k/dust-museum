import Papa from "papaparse";
import {
  MAX_IDLE_THRESHOLD,
  MAX_PRICE,
  findCategory,
  makeId,
  nextCategoryColor,
  normalizeCategory,
  normalizeDateInput,
  normalizeDevice,
  type Category,
  type Device,
  type LedgerStore,
  type Settings,
} from "@/lib/ledger";

export const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024;

export const CSV_COLUMNS = [
  "名称",
  "类别",
  "购买日期",
  "购买价格",
  "最后使用日",
  "上市日期",
  "上市价格",
  "备注",
] as const;

export type ImportFormat = "json" | "csv";

export interface ImportPlan {
  format: ImportFormat;
  fileName: string;
  store: LedgerStore;
  deviceCount: number;
  categoryCount: number;
  newCategoryCount: number;
  exportedAt: string | null;
  currentDeviceCount: number;
  scope: "all" | "devices";
}

export class BackupImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupImportError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanCell(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateThresholds(settings: Record<string, unknown>): {
  idleThreshold: number;
  disposeThreshold: number;
} {
  const idleThreshold = settings.idleThreshold;
  const disposeThreshold = settings.disposeThreshold;
  const valid =
    typeof idleThreshold === "number" &&
    Number.isInteger(idleThreshold) &&
    idleThreshold >= 1 &&
    idleThreshold <= MAX_IDLE_THRESHOLD &&
    typeof disposeThreshold === "number" &&
    Number.isInteger(disposeThreshold) &&
    disposeThreshold > idleThreshold &&
    disposeThreshold <= MAX_IDLE_THRESHOLD;

  if (!valid) {
    throw new BackupImportError("备份中的吃灰阈值设置无效，无法导入。");
  }
  return { idleThreshold, disposeThreshold };
}

function parseJsonBackup(
  fileName: string,
  text: string,
  currentDeviceCount: number,
): ImportPlan {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new BackupImportError("JSON 文件内容不是有效的 JSON。");
  }

  if (!isRecord(raw)) {
    throw new BackupImportError("JSON 备份必须是一个对象。");
  }
  if (raw.app !== "吃灰台账") {
    throw new BackupImportError("这不是吃灰台账的备份文件。");
  }
  if (raw.version !== 1) {
    throw new BackupImportError("备份版本不受支持，请使用本应用导出的 version 1 备份。");
  }
  if (!Array.isArray(raw.devices) || !isRecord(raw.settings)) {
    throw new BackupImportError("备份缺少 devices 或 settings 数据。");
  }
  const rawCategories = raw.settings.categories;
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    throw new BackupImportError("备份缺少有效的类别数据。");
  }

  const categories = rawCategories.map(normalizeCategory);
  if (categories.some((category) => category === null)) {
    throw new BackupImportError("备份中存在无效的类别记录。");
  }
  const cleanCategories = categories as Category[];
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  for (const category of cleanCategories) {
    const nameKey = category.name.toLocaleLowerCase();
    if (categoryIds.has(category.id) || categoryNames.has(nameKey)) {
      throw new BackupImportError("备份中的类别存在重复。");
    }
    categoryIds.add(category.id);
    categoryNames.add(nameKey);
  }

  const thresholds = validateThresholds(raw.settings);
  const devices = raw.devices.map(normalizeDevice);
  if (devices.some((device) => device === null)) {
    throw new BackupImportError("备份中存在缺少名称或最后使用日的设备记录。");
  }
  const cleanDevices = devices as Device[];
  const deviceIds = new Set<string>();
  for (const device of cleanDevices) {
    if (deviceIds.has(device.id)) {
      throw new BackupImportError("备份中的设备 ID 存在重复。");
    }
    deviceIds.add(device.id);
    if (!categoryIds.has(device.categoryId)) {
      throw new BackupImportError(`设备「${device.name}」引用了不存在的类别。`);
    }
  }

  return {
    format: "json",
    fileName,
    store: {
      version: 1,
      devices: cleanDevices,
      settings: {
        ...thresholds,
        categories: cleanCategories,
      },
    },
    deviceCount: cleanDevices.length,
    categoryCount: cleanCategories.length,
    newCategoryCount: 0,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : null,
    currentDeviceCount,
    scope: "all",
  };
}

function parseOptionalDate(
  value: unknown,
  label: string,
  today: string,
): { value: string | null; error?: string } {
  const text = cleanCell(value);
  if (!text) return { value: null };
  const normalized = normalizeDateInput(text);
  if (!normalized) {
    return {
      value: null,
      error: `${label}不是有效日期（支持 YYYY-MM-DD、YYYY/MM/DD 或 YYYY.MM.DD）`,
    };
  }
  if (normalized > today) {
    return { value: null, error: `${label}不能晚于今天` };
  }
  return { value: normalized };
}

function parseOptionalPrice(
  value: unknown,
  label: string,
): { value: number | null; error?: string } {
  const text = cleanCell(value);
  if (!text) return { value: null };
  const normalized = text.replace(/[,\s¥￥]/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) {
    return { value: null, error: `${label}必须是 0–${MAX_PRICE} 之间的数字` };
  }
  return { value: Math.round(number * 100) / 100 };
}

function createCategoryResolver(initialCategories: Category[]) {
  const categories = initialCategories.map((category) => ({ ...category }));
  let newCategoryCount = 0;

  const findByName = (name: string): Category | undefined =>
    categories.find(
      (category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );

  const addCategory = (name: string): Category => {
    if (name.length > 20) {
      throw new BackupImportError(`类别名「${name}」超过 20 个字。`);
    }
    const created: Category = {
      id: makeId("category"),
      name,
      color: nextCategoryColor(categories),
    };
    categories.push(created);
    newCategoryCount += 1;
    return created;
  };

  return {
    resolve(rawName: unknown): Category {
      const name = cleanCell(rawName) || "其他";
      if (name.length > 20) {
        throw new BackupImportError(`类别名「${name}」超过 20 个字。`);
      }
      return findByName(name) ?? addCategory(name);
    },
    get categories() {
      return categories;
    },
    get newCategoryCount() {
      return newCategoryCount;
    },
  };
}

function parseCsvBackup(
  fileName: string,
  text: string,
  currentSettings: Settings,
  currentDeviceCount: number,
  today: string,
): ImportPlan {
  const parsed = Papa.parse<Record<string, string | undefined>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    },
  );

  if (parsed.errors.length > 0) {
    throw new BackupImportError(`CSV 解析失败：${parsed.errors[0].message}`);
  }

  const fields = parsed.meta.fields ?? [];
  const requiredHeaders = ["名称", "最后使用日"];
  const missingHeaders = requiredHeaders.filter((header) => !fields.includes(header));
  if (missingHeaders.length > 0) {
    throw new BackupImportError(`CSV 缺少必需列：${missingHeaders.join("、")}。`);
  }

  const rows = parsed.data.filter((row) =>
    Object.values(row).some((value) => cleanCell(value) !== ""),
  );
  if (rows.length === 0) {
    throw new BackupImportError("CSV 中没有可导入的设备记录。");
  }

  const categoryResolver = createCategoryResolver(currentSettings.categories);
  const devices: Device[] = [];
  const errors: string[] = [];
  const createdAt = new Date().toISOString();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: string[] = [];
    const name = cleanCell(row["名称"]);
    if (!name) {
      rowErrors.push("缺少名称");
    } else if (name.length > 40) {
      rowErrors.push("名称超过 40 个字");
    }

    const lastUsed = parseOptionalDate(row["最后使用日"], "最后使用日", today);
    if (!cleanCell(row["最后使用日"])) {
      rowErrors.push("缺少最后使用日");
    } else if (lastUsed.error) {
      rowErrors.push(lastUsed.error);
    }

    const purchaseDate = parseOptionalDate(row["购买日期"], "购买日期", today);
    if (purchaseDate.error) rowErrors.push(purchaseDate.error);

    const releaseDate = parseOptionalDate(row["上市日期"], "上市日期", today);
    if (releaseDate.error) rowErrors.push(releaseDate.error);

    const price = parseOptionalPrice(row["购买价格"], "购买价格");
    if (price.error) rowErrors.push(price.error);

    const releasePrice = parseOptionalPrice(row["上市价格"], "上市价格");
    if (releasePrice.error) rowErrors.push(releasePrice.error);

    const note = typeof row["备注"] === "string" ? row["备注"].trim() : "";
    if (note.length > 200) rowErrors.push("备注超过 200 个字");

    let category: Category | null = null;
    try {
      category = categoryResolver.resolve(row["类别"]);
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "类别无效");
    }

    if (rowErrors.length > 0) {
      errors.push(`第 ${rowNumber} 行：${rowErrors.join("，")}`);
      return;
    }

    devices.push({
      id: makeId("device"),
      name,
      categoryId: category!.id,
      purchaseDate: purchaseDate.value,
      price: price.value,
      releaseDate: releaseDate.value,
      releasePrice: releasePrice.value,
      lastUsedDate: lastUsed.value!,
      note,
      createdAt,
    });
  });

  if (errors.length > 0) {
    const visible = errors.slice(0, 5).join("；");
    const more = errors.length > 5 ? `；另有 ${errors.length - 5} 行未通过校验` : "";
    throw new BackupImportError(`CSV 校验失败：${visible}${more}`);
  }

  return {
    format: "csv",
    fileName,
    store: {
      version: 1,
      devices,
      settings: {
        ...currentSettings,
        categories: categoryResolver.categories,
      },
    },
    deviceCount: devices.length,
    categoryCount: categoryResolver.categories.length,
    newCategoryCount: categoryResolver.newCategoryCount,
    exportedAt: null,
    currentDeviceCount,
    scope: "devices",
  };
}

export function parseImportFile(
  fileName: string,
  text: string,
  currentSettings: Settings,
  currentDeviceCount: number,
  today: string,
): ImportPlan {
  const lowerName = fileName.toLocaleLowerCase();
  if (lowerName.endsWith(".json")) {
    return parseJsonBackup(fileName, text, currentDeviceCount);
  }
  if (lowerName.endsWith(".csv")) {
    return parseCsvBackup(fileName, text, currentSettings, currentDeviceCount, today);
  }
  throw new BackupImportError("只支持 .json 或 .csv 文件。");
}

export function buildCsv(devices: Device[], categories: Category[]): string {
  const rows = devices.map((device) => ({
    名称: device.name,
    类别: findCategory(categories, device.categoryId).name,
    购买日期: device.purchaseDate ?? "",
    购买价格: device.price ?? "",
    最后使用日: device.lastUsedDate,
    上市日期: device.releaseDate ?? "",
    上市价格: device.releasePrice ?? "",
    备注: device.note,
  }));
  const csv = Papa.unparse(rows, {
    columns: [...CSV_COLUMNS],
    newline: "\r\n",
    quotes: false,
  });
  return `\uFEFF${csv}`;
}

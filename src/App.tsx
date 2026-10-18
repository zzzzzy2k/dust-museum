import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  CircleCheck,
  Download,
  Moon,
  Plus,
  RotateCcw,
  Settings,
  Sun,
} from "lucide-react";
import { DeviceCard } from "@/components/DeviceCard";
import { DeviceForm } from "@/components/DeviceForm";
import { Dialog } from "@/components/Dialog";
import { SettingsForm } from "@/components/SettingsForm";
import { useToday } from "@/hooks/useToday";
import {
  STORAGE_KEY,
  THEME_KEY,
  buildBackup,
  categoryBreakdown,
  computeStats,
  filterAndSort,
  formatInteger,
  formatMoney,
  formatMonthDay,
  longestIdle,
  loadStore,
  parseStoredStore,
  saveStore,
  saveTheme,
  todayLabel,
  toEntries,
  type Device,
  type DeviceEntry,
  type Filter,
  type LedgerStore,
  type Settings as LedgerSettings,
  type SortKey,
  type Theme,
} from "@/lib/ledger";

type EditorState = { mode: "create" } | { mode: "edit"; device: Device } | null;

const FILTER_META: Array<{ value: Filter; label: string; title: string }> = [
  { value: "all", label: "全部", title: "显示全部设备" },
  { value: "active", label: "活跃", title: "未达到吃灰阈值" },
  { value: "idle", label: "吃灰", title: "包含待处置设备" },
  { value: "disposal", label: "待处置", title: "超过待处置阈值" },
];

export default function App() {
  const [store, setStore] = useState<LedgerStore>(loadStore);
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("idle");
  const [editor, setEditor] = useState<EditorState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null);
  const [confirmClearSamples, setConfirmClearSamples] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const today = useToday();
  const toastTimer = useRef<number | undefined>(undefined);
  const toastId = useRef(0);
  const lastSaved = useRef("");

  const entries = useMemo(
    () => toEntries(store.devices, store.settings, today),
    [store.devices, store.settings, today],
  );
  const stats = useMemo(() => computeStats(entries), [entries]);
  const visibleEntries = useMemo(
    () => filterAndSort(entries, filter, sortKey),
    [entries, filter, sortKey],
  );
  const ranking = useMemo(() => longestIdle(entries), [entries]);
  const breakdown = useMemo(() => categoryBreakdown(entries), [entries]);
  const sampleCount = useMemo(
    () => store.devices.filter((device) => device.sample).length,
    [store.devices],
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const device of store.devices) {
      counts[device.categoryId] = (counts[device.categoryId] ?? 0) + 1;
    }
    return counts;
  }, [store.devices]);

  const filterCounts: Record<Filter, number> = {
    all: stats.total,
    active: stats.active,
    idle: stats.idle,
    disposal: stats.disposal,
  };

  useEffect(() => {
    const serialized = JSON.stringify(store);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    saveStore(store);
  }, [store]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#14181b" : "#f1f3f4");
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const next = parseStoredStore(event.newValue);
        if (next) setStore(next);
      }
      if (
        event.key === THEME_KEY &&
        (event.newValue === "light" || event.newValue === "dark")
      ) {
        setTheme(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current);
    toastId.current += 1;
    setToast({ id: toastId.current, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const handleSaveDevice = (device: Device) => {
    const exists = store.devices.some((item) => item.id === device.id);
    setStore((previous) => ({
      ...previous,
      devices: exists
        ? previous.devices.map((item) => (item.id === device.id ? device : item))
        : [device, ...previous.devices],
    }));
    setEditor(null);
    showToast(exists ? `已更新「${device.name}」` : `已登记「${device.name}」`);
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    setStore((previous) => ({
      ...previous,
      devices: previous.devices.filter((device) => device.id !== pendingDelete.id),
    }));
    setPendingDelete(null);
    showToast(`已移除「${name}」`);
  };

  const handleMarkUsed = (entry: DeviceEntry) => {
    if (entry.lastUsedDate === today) return;
    setStore((previous) => ({
      ...previous,
      devices: previous.devices.map((device) =>
        device.id === entry.id ? { ...device, lastUsedDate: today } : device,
      ),
    }));
    showToast(`「${entry.name}」已记为今天使用`);
  };

  const handleSaveSettings = (settings: LedgerSettings) => {
    setStore((previous) => ({ ...previous, settings }));
    setSettingsOpen(false);
    showToast("设置已保存");
  };

  const handleClearSamples = () => {
    const count = sampleCount;
    setStore((previous) => ({
      ...previous,
      devices: previous.devices.filter((device) => !device.sample),
    }));
    setConfirmClearSamples(false);
    showToast(`已清除 ${count} 件示例设备`);
  };

  const handleToggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    saveTheme(next);
  };

  const handleExport = () => {
    const blob = new Blob([buildBackup(store)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `吃灰台账-备份-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("备份已导出");
  };

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true" />

      <header className="site-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <BrandMark />
          </div>
          <div className="brand-copy">
            <h1>吃灰台账</h1>
            <p>闲置设备记录</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={handleToggleTheme}
            aria-label={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
            title={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
          >
            {theme === "light" ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
            title="设置"
          >
            <Settings size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-primary btn-add"
            onClick={() => setEditor({ mode: "create" })}
            aria-label="登记设备"
          >
            <Plus size={17} aria-hidden="true" />
            <span className="btn-label">登记设备</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="ledger" aria-labelledby="ledger-heading">
          <div className="ledger-head">
            <div>
              <p className="eyebrow">DEVICE REGISTER</p>
              <div className="heading-line">
                <h2 id="ledger-heading">设备名录</h2>
                <span className="count-tag num">{stats.total} 台</span>
              </div>
            </div>
            <p className="ledger-date">{todayLabel(today)}</p>
          </div>

          <div className="toolbar">
            <div className="filters" role="group" aria-label="按状态筛选设备">
              {FILTER_META.map((item) => {
                const active = filter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`filter-tab${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    title={item.title}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                    <span className="tab-count num">{filterCounts[item.value]}</span>
                  </button>
                );
              })}
            </div>

            <label className="sort-control">
              <ArrowUpDown size={14} aria-hidden="true" />
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                aria-label="排序方式"
              >
                <option value="idle">吃灰最久</option>
                <option value="value">价值最高</option>
                <option value="category">按类别</option>
              </select>
              <ChevronDown size={14} className="sort-chevron" aria-hidden="true" />
            </label>
          </div>

          <div className="threshold-note">
            <span>
              <span className="threshold-tick" aria-hidden="true" />
              超过 {store.settings.idleThreshold} 天未使用为吃灰，
              {store.settings.disposeThreshold} 天起标记待处置。
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => setSettingsOpen(true)}
            >
              调整
            </button>
          </div>

          {sampleCount > 0 ? (
            <div className="sample-banner">
              <span className="sample-banner-dot" aria-hidden="true" />
              <p>
                <strong>示例设备</strong>
                <span> · 可随时编辑或删除。</span>
              </p>
              <button
                type="button"
                className="link-btn"
                onClick={() => setConfirmClearSamples(true)}
              >
                清除示例
              </button>
            </div>
          ) : null}

          <div className="device-list">
            {entries.length === 0 ? (
              <EmptyLedger onCreate={() => setEditor({ mode: "create" })} />
            ) : visibleEntries.length === 0 ? (
              <FilteredEmpty onReset={() => setFilter("all")} />
            ) : (
              visibleEntries.map((entry, index) => (
                <DeviceCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  today={today}
                  onEdit={(deviceEntry) =>
                    setEditor({ mode: "edit", device: deviceEntry })
                  }
                  onDelete={(deviceEntry) => setPendingDelete(deviceEntry)}
                  onMarkUsed={handleMarkUsed}
                />
              ))
            )}
          </div>
        </section>

        <aside className="insights" aria-label="吃灰统计与排行">
          <section className="panel overview" aria-labelledby="overview-heading">
            <div className="panel-head">
              <div>
                <p className="eyebrow">OVERVIEW</p>
                <h2 id="overview-heading">吃灰总览</h2>
              </div>
              <span className="as-of" title={todayLabel(today)}>
                <span className="as-of-dot" aria-hidden="true" />
                {formatMonthDay(today)}
              </span>
            </div>

            <dl className="stat-grid">
              <div className="stat">
                <dt>
                  <span className="stat-label">设备总数</span>
                  <span className="stat-note">全部登记</span>
                </dt>
                <dd>
                  <span className="stat-number num">{stats.total}</span>
                  <span className="stat-unit">台</span>
                </dd>
              </div>
              <div className="stat">
                <dt>
                  <span className="stat-label">吃灰设备</span>
                  <span className="stat-note">≥ {store.settings.idleThreshold} 天</span>
                </dt>
                <dd>
                  <span className="stat-number num stat-number-alert">{stats.idle}</span>
                  <span className="stat-unit">台</span>
                </dd>
              </div>
              <div className="stat">
                <dt>
                  <span className="stat-label">吃灰总天数</span>
                  <span className="stat-note">吃灰设备累计</span>
                </dt>
                <dd>
                  <span className="stat-number num">{formatInteger(stats.idleDays)}</span>
                  <span className="stat-unit">天</span>
                </dd>
              </div>
              <div className="stat">
                <dt>
                  <span className="stat-label">闲置总价值</span>
                  <span className="stat-note">按购入价</span>
                </dt>
                <dd>
                  <span className="stat-currency">¥</span>
                  <span className="stat-number num">{formatMoney(stats.idleValue)}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel ranking" aria-labelledby="ranking-heading">
            <div className="panel-head">
              <div>
                <p className="eyebrow">RANKING</p>
                <h2 id="ranking-heading">最久吃灰</h2>
              </div>
              <span className="panel-tag">TOP 5</span>
            </div>

            {ranking.length > 0 ? (
              <ol className="rank-list">
                {ranking.map((entry, index) => (
                  <li className="rank-item" key={entry.id}>
                    <span className="rank-index num" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="rank-main">
                      <span className="rank-name" title={entry.name}>
                        {entry.name}
                      </span>
                      <span className="rank-meta">
                        <span
                          className="category-dot"
                          style={{ backgroundColor: entry.category.color }}
                          aria-hidden="true"
                        />
                        {entry.category.name}
                        <span className="meta-sep" aria-hidden="true">
                          ·
                        </span>
                        <span className={`rank-status rank-status-${entry.status}`}>
                          {entry.status === "disposal" ? "待处置" : "吃灰"}
                        </span>
                      </span>
                    </div>
                    <span className="rank-days">
                      <span className="num">{formatInteger(entry.idleDays)}</span>
                      <em>天</em>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="panel-empty">
                <CircleCheck size={22} aria-hidden="true" />
                <p>暂无吃灰设备</p>
                <span>保持得不错，先让它们继续被使用。</span>
              </div>
            )}
          </section>

          <section className="panel categories" aria-labelledby="categories-heading">
            <div className="panel-head">
              <div>
                <p className="eyebrow">CATEGORY</p>
                <h2 id="categories-heading">类别分布</h2>
              </div>
              <span className="panel-tag">全部设备</span>
            </div>

            {breakdown.length > 0 ? (
              <ul className="cat-list">
                {breakdown.map((item) => {
                  const maxCount = breakdown[0]?.count || 1;
                  const width = Math.max(4, (item.count / maxCount) * 100);
                  return (
                    <li
                      key={item.category.id}
                      title={`${item.category.name}：${item.count} 台设备，其中 ${item.idleCount} 台吃灰`}
                    >
                      <div className="cat-line">
                        <span className="cat-name">
                          <span
                            className="category-dot"
                            style={{ backgroundColor: item.category.color }}
                            aria-hidden="true"
                          />
                          {item.category.name}
                        </span>
                        <span className="cat-count num">{item.count} 台</span>
                      </div>
                      <div className="cat-track" aria-hidden="true">
                        <span
                          className="cat-fill"
                          style={{
                            width: `${width}%`,
                            backgroundColor: item.category.color,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="panel-empty panel-empty-quiet">
                <p>还没有类别分布</p>
                <span>登记设备后，这里会自动汇总。</span>
              </div>
            )}
          </section>
        </aside>
      </main>

      <footer className="site-footer">
        <p>
          <span className="local-dot" aria-hidden="true" />
          台账保存在当前浏览器，刷新后仍会保留，不会上传服务器。
        </p>
        <button type="button" className="link-btn footer-export" onClick={handleExport}>
          <Download size={14} aria-hidden="true" />
          导出备份
        </button>
      </footer>

      {editor ? (
        <DeviceForm
          device={editor.mode === "edit" ? editor.device : null}
          categories={store.settings.categories}
          today={today}
          onClose={() => setEditor(null)}
          onSave={handleSaveDevice}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsForm
          settings={store.settings}
          deviceCounts={categoryCounts}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
          onExport={handleExport}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="移除设备"
          message={`「${pendingDelete.name}」将从台账中移除，吃灰记录也会一并删除。此操作无法撤销。`}
          confirmLabel="确认移除"
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {confirmClearSamples ? (
        <ConfirmDialog
          title="清除示例设备"
          message={`将移除当前 ${sampleCount} 件示例设备，不会影响你自己登记的记录。`}
          confirmLabel="清除示例"
          onCancel={() => setConfirmClearSamples(false)}
          onConfirm={handleClearSamples}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status" aria-live="polite" key={toast.id}>
          <Check size={15} aria-hidden="true" />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.75"
        y="7.25"
        width="16.5"
        height="12.5"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 7.25V5.9A1.9 1.9 0 0 1 9.9 4h4.2A1.9 1.9 0 0 1 16 5.9v1.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 12.3h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function EmptyLedgerArt() {
  return (
    <svg
      className="empty-art"
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 39h56v29.5a6.5 6.5 0 0 1-6.5 6.5h-43a6.5 6.5 0 0 1-6.5-6.5V39Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 5"
        opacity=".5"
      />
      <path
        d="M30 39V28.5A6.5 6.5 0 0 1 36.5 22h23a6.5 6.5 0 0 1 6.5 6.5V39"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M41 51h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="27" cy="19" r="1.6" fill="currentColor" opacity=".4" />
      <circle cx="71" cy="28" r="1.2" fill="currentColor" opacity=".3" />
      <path
        d="M68 15v5M65.5 17.5h5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity=".35"
      />
    </svg>
  );
}

function EmptyLedger({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <EmptyLedgerArt />
      <h3>台账还是空的</h3>
      <p>从抽屉里最久没动的那件开始，给它记一笔。</p>
      <button type="button" className="btn btn-primary" onClick={onCreate}>
        <Plus size={16} aria-hidden="true" />
        先登记一件最久没用的东西
      </button>
    </div>
  );
}

function FilteredEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className="empty-state empty-state-compact">
      <EmptyLedgerArt />
      <h3>这一栏暂时空着</h3>
      <p>当前筛选下没有设备，换个状态看看。</p>
      <button type="button" className="btn btn-outline" onClick={onReset}>
        <RotateCcw size={15} aria-hidden="true" />
        查看全部设备
      </button>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog title={title} size="sm" onClose={onCancel}>
      <div className="modal-body confirm-body">
        <p>{message}</p>
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
          取消
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </footer>
    </Dialog>
  );
}

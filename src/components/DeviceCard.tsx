import { Check, Pencil, Trash2 } from "lucide-react";
import {
  STATUS_LABELS,
  formatDate,
  formatInteger,
  formatMoney,
  type DeviceEntry,
} from "@/lib/ledger";

interface DeviceCardProps {
  entry: DeviceEntry;
  index: number;
  today: string;
  onEdit: (entry: DeviceEntry) => void;
  onDelete: (entry: DeviceEntry) => void;
  onMarkUsed: (entry: DeviceEntry) => void;
}

export function DeviceCard({
  entry,
  index,
  today,
  onEdit,
  onDelete,
  onMarkUsed,
}: DeviceCardProps) {
  const usedToday = entry.lastUsedDate === today;
  const hasReleaseInfo = Boolean(entry.releaseDate) || entry.releasePrice !== null;

  return (
    <article className="device-card" data-status={entry.status}>
      <div className="device-info">
        <div className="device-top">
          <span className="device-index num" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="device-name" title={entry.name}>
            {entry.name}
          </h3>
          {entry.sample ? <span className="chip chip-sample">示例</span> : null}
          <span className={`chip status-chip status-${entry.status}`}>
            <span className="status-dot" aria-hidden="true" />
            {STATUS_LABELS[entry.status]}
          </span>
          <div className="device-tools">
            <button
              type="button"
              className="icon-btn icon-btn-plain icon-btn-small"
              onClick={() => onEdit(entry)}
              aria-label={`编辑 ${entry.name}`}
              title="编辑设备"
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-plain icon-btn-small"
              onClick={() => onDelete(entry)}
              aria-label={`删除 ${entry.name}`}
              title="删除设备"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="device-meta">
          <span className="meta-category">
            <span
              className="category-dot"
              style={{ backgroundColor: entry.category.color }}
              aria-hidden="true"
            />
            {entry.category.name}
          </span>
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          <span>
            {entry.purchaseDate ? `购于 ${formatDate(entry.purchaseDate)}` : "购入日期未记"}
          </span>
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          <span className="num">
            {entry.price !== null ? `¥${formatMoney(entry.price)}` : "价格未记"}
          </span>
        </div>
        {hasReleaseInfo ? (
          <div className="device-release">
            {entry.releaseDate ? (
              <span>上市 {formatDate(entry.releaseDate)}</span>
            ) : null}
            {entry.releaseDate && entry.releasePrice !== null ? (
              <span className="meta-sep" aria-hidden="true">
                ·
              </span>
            ) : null}
            {entry.releasePrice !== null ? (
              <span className="num">上市价 ¥{formatMoney(entry.releasePrice)}</span>
            ) : null}
          </div>
        ) : null}
        {entry.note ? (
          <p className="device-note" title={entry.note}>
            {entry.note}
          </p>
        ) : null}
      </div>

      <div className="device-idle">
        <span className="idle-number num">{formatInteger(entry.idleDays)}</span>
        <span className="idle-unit">天未使用</span>
      </div>

      <div className="device-last">
        <span className="micro-label">最后使用</span>
        <span className="last-date num">{formatDate(entry.lastUsedDate)}</span>
        {usedToday ? <span className="today-chip">今天</span> : null}
      </div>

      <div className="device-action">
        <button
          type="button"
          className="use-btn"
          disabled={usedToday}
          onClick={() => onMarkUsed(entry)}
          aria-label={
            usedToday ? `${entry.name}今天已经使用过` : `将${entry.name}记为今天使用`
          }
        >
          <Check size={15} aria-hidden="true" />
          {usedToday ? "今天已用" : "今天用了"}
        </button>
      </div>
    </article>
  );
}

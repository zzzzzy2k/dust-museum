import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, Check, Download, Plus, Trash2, Upload } from "lucide-react";
import {
  MAX_IMPORT_FILE_SIZE,
  parseImportFile,
  type ImportPlan,
} from "@/lib/backup";
import {
  MAX_IDLE_THRESHOLD,
  makeId,
  nextCategoryColor,
  type Category,
  type LedgerStore,
  type Settings,
} from "@/lib/ledger";
import { Dialog } from "./Dialog";

interface SettingsFormProps {
  settings: Settings;
  deviceCounts: Record<string, number>;
  today: string;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImport: (store: LedgerStore) => void;
}

interface SettingsErrors {
  thresholds?: string;
  categories?: string;
  newCategory?: string;
}

export function SettingsForm({
  settings,
  deviceCounts,
  today,
  onClose,
  onSave,
  onExportJson,
  onExportCsv,
  onImport,
}: SettingsFormProps) {
  const [idleThreshold, setIdleThreshold] = useState(String(settings.idleThreshold));
  const [disposeThreshold, setDisposeThreshold] = useState(String(settings.disposeThreshold));
  const [categories, setCategories] = useState<Category[]>(() =>
    settings.categories.map((category) => ({ ...category })),
  );
  const [newCategory, setNewCategory] = useState("");
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [exportedFormat, setExportedFormat] = useState<"json" | "csv" | null>(null);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const idleNumber = Number(idleThreshold);
  const disposeNumber = Number(disposeThreshold);
  const idleWithinRange =
    idleThreshold.trim() !== "" &&
    Number.isInteger(idleNumber) &&
    idleNumber >= 1 &&
    idleNumber <= MAX_IDLE_THRESHOLD;
  const disposeWithinRange =
    disposeThreshold.trim() !== "" &&
    Number.isInteger(disposeNumber) &&
    disposeNumber >= 1 &&
    disposeNumber <= MAX_IDLE_THRESHOLD;
  const totalDevices = Object.values(deviceCounts).reduce((sum, count) => sum + count, 0);
  const exportedAtLabel = importPlan?.exportedAt
    ? (() => {
        const date = new Date(importPlan.exportedAt);
        return Number.isNaN(date.getTime())
          ? importPlan.exportedAt
          : date.toLocaleString("zh-CN", { hour12: false });
      })()
    : null;

  const handleExport = (format: "json" | "csv") => {
    if (format === "json") onExportJson();
    else onExportCsv();
    setExportedFormat(format);
  };

  const resetImport = () => {
    setImportPlan(null);
    setImportError(null);
    setImportConfirmed(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportPlan(null);
    setImportConfirmed(false);
    setImportError(null);

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setImportError("文件超过 2 MiB 上限，请选择更小的备份文件。");
      return;
    }

    try {
      const text = await file.text();
      const plan = parseImportFile(file.name, text, settings, totalDevices, today);
      setImportPlan(plan);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "读取备份文件失败。");
    }
  };

  const addCategory = (): boolean => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setErrors((previous) => ({ ...previous, newCategory: "请输入类别名称。" }));
      return false;
    }
    if (
      categories.some(
        (category) => category.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      )
    ) {
      setErrors((previous) => ({ ...previous, newCategory: "已有同名类别。" }));
      return false;
    }
    setCategories((previous) => [
      ...previous,
      {
        id: makeId("category"),
        name: trimmed.slice(0, 20),
        color: nextCategoryColor(previous),
      },
    ]);
    setNewCategory("");
    setErrors((previous) => ({ ...previous, newCategory: undefined, categories: undefined }));
    return true;
  };

  const removeCategory = (categoryId: string) => {
    if (categories.length <= 1) return;
    if ((deviceCounts[categoryId] ?? 0) > 0) return;
    setCategories((previous) => previous.filter((category) => category.id !== categoryId));
    setErrors((previous) => ({ ...previous, categories: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: SettingsErrors = {};

    if (!idleWithinRange || !disposeWithinRange) {
      nextErrors.thresholds = `阈值请填写 1–${MAX_IDLE_THRESHOLD} 之间的整数。`;
    } else if (disposeNumber <= idleNumber) {
      nextErrors.thresholds = "待处置阈值需要大于吃灰阈值。";
    }

    const pendingName = newCategory.trim();
    const finalCategories = categories.map((category) => ({
      ...category,
      name: category.name.trim(),
    }));

    if (pendingName) {
      if (
        finalCategories.some(
          (category) =>
            category.name.toLocaleLowerCase() === pendingName.toLocaleLowerCase(),
        )
      ) {
        nextErrors.newCategory = "已有同名类别。";
      } else {
        finalCategories.push({
          id: makeId("category"),
          name: pendingName.slice(0, 20),
          color: nextCategoryColor(finalCategories),
        });
      }
    }

    if (finalCategories.some((category) => !category.name)) {
      nextErrors.categories = "类别名称不能为空。";
    } else if (
      new Set(finalCategories.map((category) => category.name.toLocaleLowerCase())).size !==
      finalCategories.length
    ) {
      nextErrors.categories = "类别名称不能重复。";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave({
      idleThreshold: idleNumber,
      disposeThreshold: disposeNumber,
      categories: finalCategories,
    });
  };

  return (
    <Dialog
      title="设置"
      subtitle="调整吃灰判定口径、管理类别，以及备份本地数据。"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          <section className="settings-section" aria-labelledby="threshold-heading">
            <div className="settings-section-head">
              <h3 id="threshold-heading">吃灰判定</h3>
              <span className="micro-label">按未使用天数计算</span>
            </div>
            <div className="threshold-grid">
              <div className="field">
                <label className="field-label" htmlFor="idle-threshold">
                  吃灰提醒阈值
                </label>
                <div className="input-suffix">
                  <input
                    id="idle-threshold"
                    className="text-input num"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={MAX_IDLE_THRESHOLD}
                    step="1"
                    value={idleThreshold}
                    onChange={(event) => {
                      setIdleThreshold(event.target.value);
                      setErrors((previous) => ({ ...previous, thresholds: undefined }));
                    }}
                    autoFocus
                  />
                  <span className="input-suffix-text">天</span>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="dispose-threshold">
                  待处置阈值
                </label>
                <div className="input-suffix">
                  <input
                    id="dispose-threshold"
                    className="text-input num"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={MAX_IDLE_THRESHOLD}
                    step="1"
                    value={disposeThreshold}
                    onChange={(event) => {
                      setDisposeThreshold(event.target.value);
                      setErrors((previous) => ({ ...previous, thresholds: undefined }));
                    }}
                  />
                  <span className="input-suffix-text">天</span>
                </div>
              </div>
            </div>
            {errors.thresholds ? (
              <p className="field-error">{errors.thresholds}</p>
            ) : (
              <p className="settings-hint">
                超过 {idleWithinRange ? idleNumber : "—"} 天未使用视为吃灰；
                超过 {disposeWithinRange ? disposeNumber : "—"} 天会进一步标记为待处置。
              </p>
            )}
          </section>

          <section className="settings-section" aria-labelledby="category-heading">
            <div className="settings-section-head">
              <h3 id="category-heading">类别</h3>
              <span className="micro-label">可直接重命名</span>
            </div>
            <ul className="category-editor">
              {categories.map((category, index) => {
                const count = deviceCounts[category.id] ?? 0;
                const deleteDisabled = count > 0 || categories.length <= 1;
                return (
                  <li className="category-editor-row" key={category.id}>
                    <span
                      className="category-dot"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                    <input
                      className="category-name-input"
                      value={category.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCategories((previous) =>
                          previous.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: value } : item,
                          ),
                        );
                        setErrors((previous) => ({
                          ...previous,
                          categories: undefined,
                        }));
                      }}
                      maxLength={20}
                      aria-label={`类别 ${index + 1} 名称`}
                    />
                    <span className="category-use-count num">{count} 台</span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-plain icon-btn-small category-delete"
                      onClick={() => removeCategory(category.id)}
                      disabled={deleteDisabled}
                      aria-label={`删除类别 ${category.name}`}
                      title={
                        count > 0
                          ? "该类别下仍有设备，暂不能删除"
                          : categories.length <= 1
                            ? "至少保留一个类别"
                            : "删除类别"
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="category-add">
              <input
                className="text-input"
                value={newCategory}
                placeholder="新类别名称"
                maxLength={20}
                onChange={(event) => {
                  setNewCategory(event.target.value);
                  setErrors((previous) => ({ ...previous, newCategory: undefined }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory();
                  }
                }}
                aria-label="新类别名称"
                aria-invalid={Boolean(errors.newCategory)}
              />
              <button type="button" className="btn btn-ghost btn-compact" onClick={addCategory}>
                <Plus size={15} aria-hidden="true" />
                添加
              </button>
            </div>
            {errors.categories || errors.newCategory ? (
              <p className="field-error">{errors.categories ?? errors.newCategory}</p>
            ) : (
              <p className="settings-hint">有设备的类别不可删除，避免记录失去归属。</p>
            )}
          </section>

          <section className="settings-section" aria-labelledby="data-heading">
            <div className="settings-section-head">
              <h3 id="data-heading">数据与备份</h3>
              <span className="micro-label">仅保存在本机</span>
            </div>
            <p className="settings-hint settings-hint-block">
              台账保存在当前浏览器，不会上传服务器。清除浏览器站点数据会丢失记录，
              建议定期导出 JSON 备份。当前共 {totalDevices} 台设备。
            </p>

            <div className="data-actions">
              <button
                type="button"
                className="btn btn-outline btn-compact"
                onClick={() => handleExport("json")}
              >
                {exportedFormat === "json" ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Download size={15} aria-hidden="true" />
                )}
                {exportedFormat === "json" ? "JSON 已导出" : "导出 JSON 备份"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-compact"
                onClick={() => handleExport("csv")}
              >
                {exportedFormat === "csv" ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Download size={15} aria-hidden="true" />
                )}
                {exportedFormat === "csv" ? "CSV 已导出" : "导出 CSV 表格"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-compact"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} aria-hidden="true" />
                导入备份
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,application/json,text/csv"
                className="file-input-hidden"
                onChange={handleFileChange}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
            <p className="settings-hint">
              JSON 是包含设备、类别和阈值的完整备份；CSV 是可编辑的设备表格。
              两种格式都支持导入，单文件不超过 2 MiB。CSV 日期可用 -、/ 或 . 分隔，
              导入后会统一转换为标准日期。
            </p>

            {importError ? (
              <div className="import-error" role="alert">
                {importError}
              </div>
            ) : null}

            {importPlan ? (
              <div className="import-preview">
                <div className="import-preview-head">
                  <div className="import-preview-title">
                    <span className="import-format">
                      {importPlan.format === "json" ? "JSON 完整备份" : "CSV 设备表"}
                    </span>
                    <p title={importPlan.fileName}>{importPlan.fileName}</p>
                  </div>
                  <span className="import-current">
                    当前 {importPlan.currentDeviceCount} 台
                  </span>
                </div>

                <dl className="import-summary">
                  <div>
                    <dt>导入设备</dt>
                    <dd>{importPlan.deviceCount} 台</dd>
                  </div>
                  <div>
                    <dt>{importPlan.format === "json" ? "导入类别" : "新增类别"}</dt>
                    <dd>
                      {importPlan.format === "json"
                        ? `${importPlan.categoryCount} 类`
                        : `${importPlan.newCategoryCount} 类`}
                    </dd>
                  </div>
                  <div>
                    <dt>{importPlan.format === "json" ? "吃灰阈值" : "保留阈值"}</dt>
                    <dd>{importPlan.store.settings.idleThreshold} 天</dd>
                  </div>
                  {importPlan.format === "json" && exportedAtLabel ? (
                    <div>
                      <dt>备份时间</dt>
                      <dd className="import-time">{exportedAtLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="import-warning" role="alert">
                  <AlertTriangle size={17} aria-hidden="true" />
                  <div>
                    <strong>导入会覆盖当前数据，应用内无法撤销。</strong>
                    <p>
                      {importPlan.scope === "all"
                        ? `将用备份替换当前 ${totalDevices} 台设备、全部类别和阈值设置。`
                        : `将用表格替换当前 ${totalDevices} 台设备；保留当前类别和阈值${
                            importPlan.newCategoryCount > 0
                              ? `，并新增 ${importPlan.newCategoryCount} 个类别`
                              : ""
                          }。`}
                    </p>
                    <div className="import-backup-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-compact import-backup-button"
                        onClick={() => handleExport("json")}
                      >
                        <Download size={14} aria-hidden="true" />
                        先导出当前 JSON 备份
                      </button>
                      {exportedFormat === "json" ? (
                        <span className="import-exported">
                          <Check size={13} aria-hidden="true" />
                          已导出
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <label className="import-check">
                  <input
                    type="checkbox"
                    checked={importConfirmed}
                    onChange={(event) => setImportConfirmed(event.target.checked)}
                  />
                  <span>我已了解导入会覆盖当前数据</span>
                </label>

                <div className="import-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact"
                    onClick={resetImport}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-compact"
                    disabled={!importConfirmed}
                    onClick={() => onImport(importPlan.store)}
                  >
                    确认导入
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {importPlan ? null : (
          <footer className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              保存设置
            </button>
          </footer>
        )}
      </form>
    </Dialog>
  );
}

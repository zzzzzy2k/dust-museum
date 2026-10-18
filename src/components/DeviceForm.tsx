import { useState, type FormEvent } from "react";
import {
  MAX_PRICE,
  isValidDateISO,
  makeId,
  type Category,
  type Device,
} from "@/lib/ledger";
import { Dialog } from "./Dialog";

interface DeviceFormProps {
  device: Device | null;
  categories: Category[];
  today: string;
  onClose: () => void;
  onSave: (device: Device) => void;
}

interface FormErrors {
  name?: string;
  categoryId?: string;
  lastUsedDate?: string;
  purchaseDate?: string;
  price?: string;
  releaseDate?: string;
  releasePrice?: string;
  note?: string;
}

export function DeviceForm({
  device,
  categories,
  today,
  onClose,
  onSave,
}: DeviceFormProps) {
  const fallbackCategoryId = categories[0]?.id ?? "";
  const [name, setName] = useState(device?.name ?? "");
  const [categoryId, setCategoryId] = useState(() => {
    if (device && categories.some((category) => category.id === device.categoryId)) {
      return device.categoryId;
    }
    return fallbackCategoryId;
  });
  const [lastUsedDate, setLastUsedDate] = useState(device?.lastUsedDate ?? today);
  const [purchaseDate, setPurchaseDate] = useState(device?.purchaseDate ?? "");
  const [price, setPrice] = useState(
    device?.price !== null && device?.price !== undefined ? String(device.price) : "",
  );
  const [releaseDate, setReleaseDate] = useState(device?.releaseDate ?? "");
  const [releasePrice, setReleasePrice] = useState(
    device?.releasePrice !== null && device?.releasePrice !== undefined
      ? String(device.releasePrice)
      : "",
  );
  const [note, setNote] = useState(device?.note ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  const clearErrors = () => {
    if (Object.keys(errors).length > 0) setErrors({});
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedNote = note.trim();

    if (!trimmedName) {
      nextErrors.name = "给这件设备起个名字。";
    } else if (trimmedName.length > 40) {
      nextErrors.name = "名称请控制在 40 个字以内。";
    }

    const categoryExists = categories.some((category) => category.id === categoryId);
    if (!categoryExists) nextErrors.categoryId = "请选择一个类别。";

    if (!lastUsedDate) {
      nextErrors.lastUsedDate = "请选择最后使用日期。";
    } else if (!isValidDateISO(lastUsedDate)) {
      nextErrors.lastUsedDate = "日期格式不正确。";
    } else if (lastUsedDate > today) {
      nextErrors.lastUsedDate = "最后使用日不能晚于今天。";
    }

    if (purchaseDate) {
      if (!isValidDateISO(purchaseDate)) {
        nextErrors.purchaseDate = "日期格式不正确。";
      } else if (purchaseDate > today) {
        nextErrors.purchaseDate = "购买日期不能晚于今天。";
      }
    }

    let parsedPrice: number | null = null;
    if (price.trim()) {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        nextErrors.price = "请输入不小于 0 的价格。";
      } else if (numericPrice > MAX_PRICE) {
        nextErrors.price = "这个价格超出了台账的记录范围。";
      } else {
        parsedPrice = Math.round(numericPrice * 100) / 100;
      }
    }

    if (releaseDate) {
      if (!isValidDateISO(releaseDate)) {
        nextErrors.releaseDate = "日期格式不正确。";
      } else if (releaseDate > today) {
        nextErrors.releaseDate = "上市日期不能晚于今天。";
      }
    }

    let parsedReleasePrice: number | null = null;
    if (releasePrice.trim()) {
      const numericReleasePrice = Number(releasePrice);
      if (!Number.isFinite(numericReleasePrice) || numericReleasePrice < 0) {
        nextErrors.releasePrice = "请输入不小于 0 的价格。";
      } else if (numericReleasePrice > MAX_PRICE) {
        nextErrors.releasePrice = "这个价格超出了台账的记录范围。";
      } else {
        parsedReleasePrice = Math.round(numericReleasePrice * 100) / 100;
      }
    }

    if (trimmedNote.length > 200) {
      nextErrors.note = "备注请控制在 200 个字以内。";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave({
      id: device?.id ?? makeId("device"),
      name: trimmedName,
      categoryId,
      purchaseDate: purchaseDate || null,
      price: parsedPrice,
      releaseDate: releaseDate || null,
      releasePrice: parsedReleasePrice,
      lastUsedDate,
      note: trimmedNote,
      createdAt: device?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <Dialog
      title={device ? "编辑设备" : "登记设备"}
      subtitle="吃灰天数由最后使用日自动计算，之后每天更新。"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field field-wide">
              <label className="field-label" htmlFor="device-name">
                设备名称 <span className="required">*</span>
              </label>
              <input
                id="device-name"
                className="text-input"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearErrors();
                }}
                placeholder="例如：Kindle Paperwhite 4"
                maxLength={40}
                autoFocus
                autoComplete="off"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name ? <p className="field-error">{errors.name}</p> : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="device-category">
                类别 <span className="required">*</span>
              </label>
              <div className="select-wrap">
                <select
                  id="device-category"
                  className="text-input select-input"
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    clearErrors();
                  }}
                  aria-invalid={Boolean(errors.categoryId)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.categoryId ? (
                <p className="field-error">{errors.categoryId}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="device-last-used">
                最后使用日 <span className="required">*</span>
              </label>
              <input
                id="device-last-used"
                className="text-input"
                type="date"
                value={lastUsedDate}
                max={today}
                onChange={(event) => {
                  setLastUsedDate(event.target.value);
                  clearErrors();
                }}
                aria-invalid={Boolean(errors.lastUsedDate)}
              />
              {errors.lastUsedDate ? (
                <p className="field-error">{errors.lastUsedDate}</p>
              ) : (
                <p className="field-hint">上一次真正使用它的日期。</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="device-purchase-date">
                购买日期
              </label>
              <input
                id="device-purchase-date"
                className="text-input"
                type="date"
                value={purchaseDate}
                max={today}
                onChange={(event) => {
                  setPurchaseDate(event.target.value);
                  clearErrors();
                }}
                aria-invalid={Boolean(errors.purchaseDate)}
              />
              {errors.purchaseDate ? (
                <p className="field-error">{errors.purchaseDate}</p>
              ) : (
                <p className="field-hint">不记得可以留空。</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="device-price">
                购买价格
              </label>
              <div className="input-affix">
                <span className="input-prefix" aria-hidden="true">
                  ¥
                </span>
                <input
                  id="device-price"
                  className="text-input has-prefix num"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    clearErrors();
                  }}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.price)}
                />
              </div>
              {errors.price ? <p className="field-error">{errors.price}</p> : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="device-release-date">
                上市日期
              </label>
              <input
                id="device-release-date"
                className="text-input"
                type="date"
                value={releaseDate}
                max={today}
                onChange={(event) => {
                  setReleaseDate(event.target.value);
                  clearErrors();
                }}
                aria-invalid={Boolean(errors.releaseDate)}
              />
              {errors.releaseDate ? (
                <p className="field-error">{errors.releaseDate}</p>
              ) : (
                <p className="field-hint">产品型号正式上市的日期。</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="device-release-price">
                上市价格
              </label>
              <div className="input-affix">
                <span className="input-prefix" aria-hidden="true">
                  ¥
                </span>
                <input
                  id="device-release-price"
                  className="text-input has-prefix num"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={releasePrice}
                  onChange={(event) => {
                    setReleasePrice(event.target.value);
                    clearErrors();
                  }}
                  placeholder="官方上市价"
                  aria-invalid={Boolean(errors.releasePrice)}
                />
              </div>
              {errors.releasePrice ? (
                <p className="field-error">{errors.releasePrice}</p>
              ) : (
                <p className="field-hint">官方上市价格，仅作参照。</p>
              )}
            </div>

            <div className="field field-wide">
              <label className="field-label" htmlFor="device-note">
                备注
              </label>
              <textarea
                id="device-note"
                className="text-input textarea"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  clearErrors();
                }}
                placeholder="为什么吃灰、是否打算出二手，或任何想记住的细节。"
                maxLength={200}
                rows={3}
                aria-invalid={Boolean(errors.note)}
              />
              <div className="field-foot">
                {errors.note ? (
                  <p className="field-error">{errors.note}</p>
                ) : (
                  <span className="field-hint">选填</span>
                )}
                <span className="char-count num">{note.length}/200</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            {device ? "保存修改" : "保存设备"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

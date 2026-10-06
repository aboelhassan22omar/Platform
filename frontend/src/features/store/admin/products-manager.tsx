'use client';
import { useState } from 'react';
import { useStore } from '../store-provider';
import { STORE_GRADES, STORE_KINDS, type StoreProduct } from '../store-data';
import { formatEgp } from '@/lib/utils';
export function StoreProductManager({ onMessage }: { onMessage: (message: string) => void }) {
  const store = useStore();
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const setMessage = onMessage;
  return (
    <>
      <button
        className="store-button"
        onClick={() =>
          setEditing({
            id: `demo-${crypto.randomUUID()}`,
            title: '',
            description: '',
            kind: 'BOOK',
            grade: 'SEC_1',
            priceMinor: 18000,
            compareAtMinor: null,
            stock: 30,
            allowCod: true,
            active: true,
            featured: false,
            pages: 240,
            image: null,
            highlights: ['شرح مبسط', 'تدريبات شاملة'],
          })
        }
      >
        ＋ إضافة منتج
      </button>
      {editing && (
        <form
          className="store-panel"
          onSubmit={(e) => {
            e.preventDefault();
            store.saveProduct(editing);
            setEditing(null);
            setMessage('تم حفظ المنتج.');
          }}
        >
          <h2>بيانات المنتج</h2>
          <div className="store-form-grid">
            <label className="store-field store-field-wide">
              <span>اسم المنتج</span>
              <input
                required
                maxLength={120}
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="store-field">
              <span>القسم</span>
              <select
                value={editing.kind}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    kind: e.target.value as StoreProduct['kind'],
                  })
                }
              >
                {STORE_KINDS.map((k) => (
                  <option value={k.key} key={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="store-field">
              <span>الصف الدراسي</span>
              <select
                value={editing.grade}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    grade: e.target.value as StoreProduct['grade'],
                  })
                }
              >
                {STORE_GRADES.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ['priceMinor', 'السعر بالجنيه'],
                ['stock', 'الكمية المتاحة'],
                ['pages', 'عدد الصفحات'],
              ] as const
            ).map(([key, label]) => (
              <label className="store-field" key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  required
                  min={key === 'pages' ? 1 : 0}
                  max={key === 'priceMinor' ? 100000 : 10000}
                  step={key === 'priceMinor' ? '0.01' : 1}
                  value={key === 'priceMinor' ? editing[key] / 100 : editing[key]}
                  onChange={(e) => {
                    const value = Math.round(
                      Number(e.target.value) * (key === 'priceMinor' ? 100 : 1),
                    );
                    setEditing({
                      ...editing,
                      [key]: value,
                      compareAtMinor:
                        key === 'priceMinor' &&
                        editing.compareAtMinor !== null &&
                        editing.compareAtMinor <= value
                          ? null
                          : editing.compareAtMinor,
                    });
                  }}
                />
              </label>
            ))}
            <label className="store-field">
              <span>السعر قبل الخصم (اختياري)</span>
              <input
                type="number"
                min={editing.priceMinor / 100}
                step="0.01"
                value={editing.compareAtMinor === null ? '' : editing.compareAtMinor / 100}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    compareAtMinor: e.target.value
                      ? Math.round(Number(e.target.value) * 100)
                      : null,
                  })
                }
              />
            </label>
            <label className="store-field store-field-wide">
              <span>الوصف</span>
              <textarea
                required
                maxLength={1200}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <label className="store-field store-field-wide">
              <span>مميزات المنتج (كل ميزة في سطر)</span>
              <textarea
                value={editing.highlights.join('\n')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    highlights: e.target.value.split('\n').filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          <div className="store-admin-checks">
            <label>
              <input
                type="checkbox"
                checked={editing.allowCod}
                onChange={(e) => setEditing({ ...editing, allowCod: e.target.checked })}
              />{' '}
              السماح بالدفع عند الاستلام <small>لو مقفول، المنتج بالدفع الإلكتروني فقط.</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />{' '}
              إظهار في المتجر
            </label>
          </div>
          <div className="store-form-actions">
            <button className="store-button">حفظ المنتج</button>
            <button type="button" className="store-secondary" onClick={() => setEditing(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}
      <div className="store-panel">
        {store.products.map((p) => (
          <div className="store-admin-product" key={p.id}>
            <div>
              <h3>{p.title}</h3>
              <small>
                {STORE_KINDS.find((k) => k.key === p.kind)?.label} · مخزون {p.stock} ·{' '}
                {p.active ? 'ظاهر' : 'مخفي'} ·{' '}
                {p.allowCod ? 'عند الاستلام / إلكتروني' : 'إلكتروني فقط'}
              </small>
            </div>
            <strong>{formatEgp(p.priceMinor)}</strong>
            <button
              className="store-secondary"
              onClick={() => {
                setEditing({ ...p });
                window.scrollTo({ top: 250, behavior: 'smooth' });
              }}
            >
              تعديل
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from './store-provider';
import {
  STORE_GRADES,
  STORE_KINDS,
  STATUS_LABELS,
  METHOD_LABELS,
  PAYMENT_LABELS,
  type StoreProduct,
} from './store-data';
import { formatEgp } from '@/lib/utils';
export function AdminStore() {
  const store = useStore();
  const [tab, setTab] = useState('products');
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [message, setMessage] = useState('');
  return (
    <div className="container-page store-page">
      <div className="store-section-heading">
        <div>
          <span className="store-eyebrow">لوحة المستر</span>
          <h1>المتجر والطلبات</h1>
        </div>
        <Link className="store-secondary" href="/store">
          معاينة المتجر ←
        </Link>
      </div>

      <div className="store-admin-metrics">
        <div>
          <small>المنتجات الظاهرة</small>
          <strong>{store.products.filter((p) => p.active).length}</strong>
        </div>
        <div>
          <small>الطلبات</small>
          <strong>{store.orders.length}</strong>
        </div>
        <div>
          <small>تحويلات للمراجعة</small>
          <strong>
            {
              store.orders.filter(
                (o) =>
                  o.paymentStatus === 'SUBMITTED' && o.status !== 'CANCELLED',
              ).length
            }
          </strong>
        </div>
      </div>
      <div className="store-grade-tabs store-admin-tabs">
        {[
          ['products', 'المنتجات'],
          ['orders', 'الطلبات'],
          ['shipping', 'الشحن'],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setEditing(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      {tab === 'products' && (
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
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
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
                      value={
                        key === 'priceMinor' ? editing[key] / 100 : editing[key]
                      }
                      onChange={(e) => {
                        const value = Math.round(
                          Number(e.target.value) *
                            (key === 'priceMinor' ? 100 : 1),
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
                    value={
                      editing.compareAtMinor === null
                        ? ''
                        : editing.compareAtMinor / 100
                    }
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
                    onChange={(e) =>
                      setEditing({ ...editing, description: e.target.value })
                    }
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
                    onChange={(e) =>
                      setEditing({ ...editing, allowCod: e.target.checked })
                    }
                  />{' '}
                  السماح بالدفع عند الاستلام{' '}
                  <small>لو مقفول، المنتج بالدفع الإلكتروني فقط.</small>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) =>
                      setEditing({ ...editing, active: e.target.checked })
                    }
                  />{' '}
                  إظهار في المتجر
                </label>
              </div>
              <div className="store-form-actions">
                <button className="store-button">حفظ المنتج</button>
                <button
                  type="button"
                  className="store-secondary"
                  onClick={() => setEditing(null)}
                >
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
                    {STORE_KINDS.find((k) => k.key === p.kind)?.label} · مخزون{' '}
                    {p.stock} · {p.active ? 'ظاهر' : 'مخفي'} ·{' '}
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
      )}
      {tab === 'orders' && (
        <div className="store-admin-orders">
          {store.orders.map((o) => (
            <article className="store-panel" key={o.reference}>
              <div className="store-section-heading">
                <div>
                  <h2>{o.delivery.customerName}</h2>
                  <Link
                    href={`/store/orders/${o.reference}`}
                    className="store-text-link"
                  >
                    {o.reference} ↗
                  </Link>
                </div>
                <strong>{formatEgp(o.totalMinor)}</strong>
              </div>
              <p className="store-status">
                {STATUS_LABELS[o.status]} · {PAYMENT_LABELS[o.paymentStatus]}
              </p>
              <p>
                {METHOD_LABELS[o.method]} ·{' '}
                {new Date(o.createdAt).toLocaleDateString('ar-EG')}
              </p>
              <p>
                {o.delivery.phone} / {o.delivery.alternatePhone}
              </p>
              <p>
                {
                  store.rates.find((r) => r.code === o.delivery.governorate)
                    ?.name
                }
                ، {o.delivery.city}، {o.delivery.address}
              </p>
              <p>
                مبنى {o.delivery.building} · الدور {o.delivery.floor} · شقة{' '}
                {o.delivery.apartment} · {o.delivery.landmark}
              </p>
              {o.items.map((i) => (
                <div className="store-order-line" key={i.product.id}>
                  <span>
                    {i.product.title} × {i.quantity}
                  </span>
                  <b>{formatEgp(i.product.priceMinor * i.quantity)}</b>
                </div>
              ))}
              <p>
                شحن {formatEgp(o.shippingMinor)}
                {o.transferReference && ` · مرجع: ${o.transferReference}`}
              </p>
              <div className="store-form-actions">
                {o.status === 'AWAITING_PAYMENT' &&
                  o.paymentStatus === 'SUBMITTED' && (
                    <>
                      <button
                        className="store-button"
                        onClick={() =>
                          store.updateOrder(o.reference, 'CONFIRMED', 'PAID')
                        }
                      >
                        تأكيد الدفع
                      </button>
                      <button
                        className="store-secondary"
                        onClick={() =>
                          store.updateOrder(
                            o.reference,
                            'AWAITING_PAYMENT',
                            'REJECTED',
                            'أعد إرسال مرجع التحويل.',
                          )
                        }
                      >
                        رفض التحويل
                      </button>
                    </>
                  )}
                {o.status === 'CONFIRMED' && (
                  <button
                    className="store-button"
                    onClick={() => store.updateOrder(o.reference, 'PROCESSING')}
                  >
                    بدء التجهيز
                  </button>
                )}
                {o.status === 'PROCESSING' && (
                  <button
                    className="store-button"
                    onClick={() =>
                      store.updateOrder(
                        o.reference,
                        'SHIPPED',
                        undefined,
                        undefined,
                        `DEMO-SHIP-${o.reference.slice(-4)}`,
                      )
                    }
                  >
                    تم الشحن
                  </button>
                )}
                {o.status === 'SHIPPED' && (
                  <button
                    className="store-button"
                    onClick={() =>
                      store.updateOrder(o.reference, 'DELIVERED', 'PAID')
                    }
                  >
                    تم التسليم والتحصيل
                  </button>
                )}
                {!['CANCELLED', 'DELIVERED'].includes(o.status) && (
                  <button
                    className="store-secondary"
                    onClick={() => store.updateOrder(o.reference, 'CANCELLED')}
                  >
                    إلغاء الطلب
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {tab === 'shipping' && (
        <section className="store-panel">
          <h2>الشحن حسب المحافظة</h2>
          <p>اختيار المحافظة في العربة بيحدد التكلفة تلقائيًا.</p>
          {Array.from(new Set(store.rates.map((r) => r.region))).map(
            (region) => (
              <form
                className="store-shipping-region"
                key={region}
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get('price');
                  store.updateRates(region, Math.round(Number(value) * 100));
                  setMessage('تم تحديث تكلفة الشحن.');
                }}
              >
                <div>
                  <h3>{region}</h3>
                  <p>
                    {store.rates
                      .filter((r) => r.region === region)
                      .map((r) => r.name)
                      .join(' · ')}
                  </p>
                </div>
                <label className="store-field">
                  <span>الشحن بالجنيه</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    required
                    defaultValue={
                      store.rates.find((r) => r.region === region)!.priceMinor /
                      100
                    }
                  />
                </label>
                <button className="store-secondary">حفظ</button>
              </form>
            ),
          )}
        </section>
      )}
    </div>
  );
}

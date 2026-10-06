'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from './store-provider';
import { cartTotals, METHOD_LABELS, type DeliveryDetails, type StoreMethod } from './store-data';
import {
  DELIVERY_FIELDS,
  EMPTY_DELIVERY,
  OPTIONAL_DELIVERY_FIELDS,
  validateDeliveryDetails,
} from './delivery-details';
import { selectCartItems } from './store-model';
import { BookCover } from './book-cover';
import { formatEgp } from '@/lib/utils';

export function StoreCart() {
  const store = useStore();
  const router = useRouter();
  const lock = useRef(false);
  const [delivery, setDelivery] = useState<DeliveryDetails>(EMPTY_DELIVERY);
  const [method, setMethod] = useState<StoreMethod>('COD');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const items = selectCartItems(store);
  const rate = store.rates.find((r) => r.code === delivery.governorate);
  const totals = cartTotals(items, rate?.priceMinor || 0);
  const actualMethod = method === 'COD' && !totals.codAllowed ? 'VODAFONE_CASH' : method;
  if (!store.ready) return <div className="container-page store-page">جاري تحميل العربة…</div>;
  if (!items.length)
    return (
      <div className="container-page store-empty">
        <span className="store-empty-icon">▣</span>
        <h1>عربتك مستنية اختيارك</h1>
        <p>اختار الكتب والملازم اللي هتبدأ بيها رحلتك.</p>
        <Link className="store-button" href="/store">
          تصفّح المتجر ←
        </Link>
      </div>
    );
  return (
    <div className="container-page store-page">
      <Link href="/store" className="store-text-link">
        ← كمل تسوّق
      </Link>
      <div className="store-section-heading">
        <div>
          <span className="store-eyebrow">خطوة أقرب للتفوق</span>
          <h1>عربة التسوق</h1>
        </div>
      </div>
      <div className="store-checkout-layout">
        <div>
          <section className="store-panel">
            {items.map(({ product, quantity }) => (
              <div className="store-cart-item" key={product.id}>
                <BookCover product={product} small />
                <div className="store-cart-info">
                  <Link href={`/store/products/${product.id}`}>
                    <h3>{product.title}</h3>
                  </Link>
                  <p>{formatEgp(product.priceMinor)} للنسخة</p>
                  <div className="store-quantity">
                    <button
                      aria-label={`تقليل كمية ${product.title}`}
                      disabled={quantity <= 1}
                      onClick={() => store.setQuantity(product.id, quantity - 1)}
                    >
                      −
                    </button>
                    <span aria-label="الكمية">{quantity}</span>
                    <button
                      aria-label={`زيادة كمية ${product.title}`}
                      disabled={quantity >= Math.min(10, product.stock)}
                      onClick={() => store.setQuantity(product.id, quantity + 1)}
                    >
                      ＋
                    </button>
                    <button
                      className="store-remove"
                      onClick={() => store.removeFromCart(product.id)}
                    >
                      حذف
                    </button>
                  </div>
                  {(!product.active || product.stock < quantity) && (
                    <p className="store-error">غير متاح بالكمية المطلوبة؛ احذفه أو قلل الكمية.</p>
                  )}
                </div>
                <strong>{formatEgp(product.priceMinor * quantity)}</strong>
              </div>
            ))}
          </section>
          <section className="store-panel store-checkout">
            <div className="store-steps">
              {['التوصيل', 'الدفع', 'المراجعة'].map((label, i) => (
                <span key={label} data-active={step === i + 1}>
                  <b>{i + 1}</b>
                  {label}
                </span>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError('');
                if (step === 1) {
                  const result = validateDeliveryDetails(delivery);
                  if (result.delivery === undefined) {
                    setError(result.error);
                    return;
                  }
                  setDelivery(result.delivery);
                  setStep(2);
                } else if (step === 2) {
                  setStep(3);
                } else if (!lock.current) {
                  try {
                    lock.current = true;
                    const order = store.placeOrder(delivery, actualMethod);
                    router.push(`/store/orders/${order.reference}`);
                  } catch (err) {
                    lock.current = false;
                    setError((err as Error).message);
                  }
                }
              }}
            >
              {step === 1 && (
                <>
                  <h2>هنوصّل طلبك فين؟</h2>
                  <p>اكتب بيانات التوصيل عشان الطلب يوصلك بسهولة.</p>
                  <div className="store-form-grid">
                    <label className="store-field">
                      <span>المحافظة</span>
                      <select
                        aria-label="المحافظة"
                        required
                        value={delivery.governorate}
                        onChange={(e) =>
                          setDelivery({
                            ...delivery,
                            governorate: e.target.value,
                          })
                        }
                      >
                        <option value="">اختار المحافظة</option>
                        {store.rates.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {DELIVERY_FIELDS.map(([key, label, type]) => (
                      <label
                        className={`store-field ${key === 'address' || key === 'notes' ? 'store-field-wide' : ''}`}
                        key={key}
                      >
                        <span>
                          {label}
                          {(key === 'alternatePhone' || key === 'landmark') && ' (اختياري)'}
                        </span>
                        <input
                          required={!OPTIONAL_DELIVERY_FIELDS.includes(key)}
                          type={type || 'text'}
                          inputMode={type === 'tel' ? 'tel' : undefined}
                          minLength={
                            key === 'customerName' ? 3 : key === 'address' ? 10 : undefined
                          }
                          maxLength={key === 'address' || key === 'notes' ? 300 : 100}
                          value={delivery[key]}
                          onChange={(e) => setDelivery({ ...delivery, [key]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <h2>اختار طريقة الدفع</h2>
                  <p>اختار طريقة الدفع المناسبة لطلبك.</p>
                  <div className="store-methods">
                    {(Object.keys(METHOD_LABELS) as StoreMethod[]).map((m) => (
                      <label
                        key={m}
                        data-selected={actualMethod === m}
                        className={m === 'COD' && !totals.codAllowed ? 'store-disabled' : ''}
                      >
                        <input
                          type="radio"
                          name="method"
                          checked={actualMethod === m}
                          disabled={m === 'COD' && !totals.codAllowed}
                          onChange={() => setMethod(m)}
                        />
                        <div>
                          <strong>{METHOD_LABELS[m]}</strong>
                          <small>
                            {m === 'COD'
                              ? 'ادفع لما تستلم طلبك'
                              : 'تحويل ومراجعة الدفع بواسطة المستر'}
                          </small>
                        </div>
                      </label>
                    ))}
                  </div>
                  {!totals.codAllowed && (
                    <p className="store-error">
                      الدفع عند الاستلام غير متاح لأن العربة فيها منتج بالدفع الإلكتروني فقط.
                    </p>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <h2>راجع طلبك قبل التأكيد</h2>
                  <div className="store-review">
                    <h3>{delivery.customerName}</h3>
                    <p>
                      {delivery.phone}
                      {delivery.alternatePhone && ` · ${delivery.alternatePhone}`}
                    </p>
                    <p>
                      {rate?.name}، {delivery.city}، {delivery.address}
                    </p>
                    <p>
                      مبنى {delivery.building} · الدور {delivery.floor} · شقة {delivery.apartment}
                    </p>
                    {delivery.landmark && <p>علامة مميزة: {delivery.landmark}</p>}
                    <p>{METHOD_LABELS[actualMethod]}</p>
                    <p>{delivery.notes}</p>
                  </div>
                </>
              )}
              {error && (
                <p role="alert" className="store-error">
                  {error}
                </p>
              )}
              <div className="store-form-actions">
                {step > 1 && (
                  <button
                    type="button"
                    className="store-secondary"
                    onClick={() => setStep(step - 1)}
                  >
                    رجوع
                  </button>
                )}
                <button className="store-button" type="submit">
                  {step === 1 ? 'متابعة للدفع' : step === 2 ? 'مراجعة الطلب' : 'تأكيد الطلب'} ←
                </button>
              </div>
            </form>
          </section>
        </div>
        <aside className="store-panel store-summary">
          <h2>ملخّص الطلب</h2>
          <div>
            <span>المنتجات ({store.cartCount})</span>
            <strong>{formatEgp(totals.subtotalMinor)}</strong>
          </div>
          <div>
            <span>الشحن {rate ? `· ${rate.name}` : ''}</span>
            <strong data-testid="shipping-total">
              {rate ? formatEgp(totals.shippingMinor) : 'اختار المحافظة'}
            </strong>
          </div>
          <div className="store-grand-total">
            <span>الإجمالي</span>
            <strong data-testid="order-total">{formatEgp(totals.totalMinor)}</strong>
          </div>
          <p>
            السعر شامل المنتجات والشحن
            {!rate ? '؛ الشحن بيتضاف بعد اختيار المحافظة.' : '.'}
          </p>
        </aside>
      </div>
    </div>
  );
}

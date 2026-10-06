'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useStore } from './store-provider';
import { METHOD_LABELS, PAYMENT_LABELS, STATUS_LABELS } from './store-data';
import { formatEgp } from '@/lib/utils';
export function StoreOrderView({ reference }: { reference: string }) {
  const store = useStore();
  const [transfer, setTransfer] = useState('');
  const order = store.orders.find((o) => o.reference === reference);
  if (!store.ready)
    return <div className="container-page store-page">جاري تحميل الطلب…</div>;
  if (!order)
    return (
      <div className="container-page store-empty">
        <h1>الطلب غير موجود</h1>
        <Link href="/store">ارجع للمتجر</Link>
      </div>
    );
  const delivery = order.delivery;
  return (
    <div className="container-page store-page">
      <section className="store-order-header">
        <span className="store-order-check">✓</span>
        <span className="store-eyebrow">طلبك اتسجل</span>
        <h1>{STATUS_LABELS[order.status]}</h1>
        <p>شكرًا يا {delivery.customerName}. دي تفاصيل طلبك.</p>
        <code>{order.reference}</code>
      </section>

      <div className="store-checkout-layout">
        <div>
          <section className="store-panel">
            <h2>محتويات الطلب</h2>
            {order.items.map(({ product, quantity }) => (
              <div className="store-order-line" key={product.id}>
                <span>
                  {product.title}
                  <small>الكمية: {quantity}</small>
                </span>
                <strong>{formatEgp(product.priceMinor * quantity)}</strong>
              </div>
            ))}
          </section>
          <section className="store-panel">
            <h2>عنوان التوصيل</h2>
            <p>
              {delivery.customerName} · {delivery.phone}
            </p>
            <p>رقم بديل: {delivery.alternatePhone}</p>
            <p>
              {store.rates.find((r) => r.code === delivery.governorate)?.name}،{' '}
              {delivery.city}، {delivery.address}
            </p>
            <p>
              مبنى {delivery.building}، الدور {delivery.floor}، شقة{' '}
              {delivery.apartment}
            </p>
            <p>علامة مميزة: {delivery.landmark}</p>
            {delivery.notes && <p>{delivery.notes}</p>}
            {order.trackingNumber && <p>رقم التتبع: {order.trackingNumber}</p>}
          </section>
        </div>
        <aside className="store-panel store-summary">
          <h2>ملخّص الدفع</h2>
          <p>{METHOD_LABELS[order.method]}</p>
          <p className="store-status">{PAYMENT_LABELS[order.paymentStatus]}</p>
          <div>
            <span>المنتجات</span>
            <strong>{formatEgp(order.subtotalMinor)}</strong>
          </div>
          <div>
            <span>الشحن</span>
            <strong>{formatEgp(order.shippingMinor)}</strong>
          </div>
          <div className="store-grand-total">
            <span>الإجمالي</span>
            <strong>{formatEgp(order.totalMinor)}</strong>
          </div>
          {order.method !== 'COD' &&
            order.status === 'AWAITING_PAYMENT' &&
            ['UNPAID', 'REJECTED'].includes(order.paymentStatus) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  store.submitPayment(reference, transfer.trim());
                }}
              >
                <p>أدخل مرجع التحويل لإرسال بياناته للمراجعة.</p>
                <label className="store-field">
                  <span>مرجع التحويل</span>
                  <input
                    required
                    minLength={3}
                    maxLength={80}
                    value={transfer}
                    placeholder="رقم العملية"
                    onChange={(e) => setTransfer(e.target.value)}
                  />
                </label>
                <button className="store-button">
                  إرسال بيانات التحويل للمراجعة
                </button>
              </form>
            )}
          {order.paymentStatus === 'SUBMITTED' && (
            <p>
              بيانات التحويل تحت المراجعة. المستر يقدر يؤكده من شاشة المتجر في
              لوحة التحكم.
            </p>
          )}
          {order.note && <p>{order.note}</p>}
          <Link href="/store" className="store-text-link">
            ارجع للمكتبة ←
          </Link>
        </aside>
      </div>
    </div>
  );
}

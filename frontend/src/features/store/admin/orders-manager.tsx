'use client';
import Link from 'next/link';
import { useStore } from '../store-provider';
import { STATUS_LABELS, METHOD_LABELS, PAYMENT_LABELS } from '../store-data';
import { formatEgp } from '@/lib/utils';
export function StoreOrderManager() {
  const store = useStore();
  return (
    <div className="store-admin-orders">
      {store.orders.map((o) => (
        <article className="store-panel" key={o.reference}>
          <div className="store-section-heading">
            <div>
              <h2>{o.delivery.customerName}</h2>
              <Link href={`/store/orders/${o.reference}`} className="store-text-link">
                {o.reference} ↗
              </Link>
            </div>
            <strong>{formatEgp(o.totalMinor)}</strong>
          </div>
          <p className="store-status">
            {STATUS_LABELS[o.status]} · {PAYMENT_LABELS[o.paymentStatus]}
          </p>
          <p>
            {METHOD_LABELS[o.method]} · {new Date(o.createdAt).toLocaleDateString('ar-EG')}
          </p>
          <p>
            {o.delivery.phone} / {o.delivery.alternatePhone}
          </p>
          <p>
            {store.rates.find((r) => r.code === o.delivery.governorate)?.name}، {o.delivery.city}،{' '}
            {o.delivery.address}
          </p>
          <p>
            مبنى {o.delivery.building} · الدور {o.delivery.floor} · شقة {o.delivery.apartment} ·{' '}
            {o.delivery.landmark}
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
            {o.status === 'AWAITING_PAYMENT' && o.paymentStatus === 'SUBMITTED' && (
              <>
                <button
                  className="store-button"
                  onClick={() => store.updateOrder(o.reference, 'CONFIRMED', 'PAID')}
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
                onClick={() => store.updateOrder(o.reference, 'DELIVERED', 'PAID')}
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
  );
}

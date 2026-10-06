'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from './store-provider';
import { StoreProductManager } from './admin/products-manager';
import { StoreOrderManager } from './admin/orders-manager';
import { StoreShippingManager } from './admin/shipping-manager';
export function AdminStore() {
  const store = useStore();
  const [tab, setTab] = useState('products');
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
                (o) => o.paymentStatus === 'SUBMITTED' && o.status !== 'CANCELLED',
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
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      {tab === 'products' && <StoreProductManager onMessage={setMessage} />}
      {tab === 'orders' && <StoreOrderManager />}
      {tab === 'shipping' && <StoreShippingManager onMessage={setMessage} />}
    </div>
  );
}

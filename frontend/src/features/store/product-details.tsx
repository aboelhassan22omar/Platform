'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useStore } from './store-provider';
import { STORE_GRADES } from './store-data';
import { formatEgp } from '@/lib/utils';
import { BookCover } from './book-cover';
export function ProductDetails({ id }: { id: string }) {
  const { products, addToCart, ready } = useStore();
  const [added, setAdded] = useState(false);
  const product = products.find((p) => p.id === id && p.active);
  if (!ready) return <div className="container-page store-page">جاري تجهيز المكتبة…</div>;
  if (!product)
    return (
      <div className="container-page store-empty">
        <h1>المنتج غير متاح</h1>
        <Link href="/store">ارجع للمتجر</Link>
      </div>
    );
  return (
    <div className="container-page store-page">
      <Link href="/store" className="store-text-link">
        المتجر / تفاصيل المنتج
      </Link>
      <div className="store-detail">
        <div className="store-detail-art">
          <BookCover product={product} />
        </div>
        <div>
          <span className="store-eyebrow">
            {STORE_GRADES.find((g) => g.key === product.grade)?.label} · {product.pages} صفحة
          </span>
          <h1>{product.title}</h1>
          <p>{product.description}</p>
          <ul className="store-highlights">
            {product.highlights.map((h) => (
              <li key={h}>✓ {h}</li>
            ))}
          </ul>
          <div className="store-price">
            <strong>{formatEgp(product.priceMinor)}</strong>
            {product.compareAtMinor && <del>{formatEgp(product.compareAtMinor)}</del>}
          </div>
          <button
            className="store-button"
            disabled={!product.stock}
            onClick={() => {
              addToCart(id);
              setAdded(true);
            }}
          >
            أضف للعربة ＋
          </button>
          <p role="status">{added && <Link href="/store/cart">تمت الإضافة — كمل طلبك ←</Link>}</p>
          <div className="store-detail-notes">
            <p>نسخة مطبوعة تُوصل لعنوانك. الشحن بيتحسب حسب المحافظة.</p>
            <p>
              {product.allowCod
                ? 'متاح الدفع عند الاستلام، فودافون كاش، وإنستا باي.'
                : 'متاح بفودافون كاش وإنستا باي فقط.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

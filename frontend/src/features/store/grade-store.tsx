'use client';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useStore } from './store-provider';
import { STORE_GRADES, STORE_KINDS } from './store-data';
import { formatEgp } from '@/lib/utils';
import { BookCover } from './book-cover';
export function GradeStore({ id }: { id: string }) {
  const { products, addToCart, ready, cartCount } = useStore();
  const grade = STORE_GRADES.find((g) => g.key === id);
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState('');
  if (!grade)
    return (
      <div className="container-page store-empty">
        <h1>الصف غير موجود</h1>
        <Link href="/store">اختار صفّك الدراسي</Link>
      </div>
    );
  const filtered = products.filter(
    (p) => p.active && p.grade === id && p.title.includes(query.trim()),
  );
  return (
    <div className="container-page store-page">
      <Link href="/store" className="store-text-link">
        المتجر / اختار صفّك الدراسي
      </Link>
      <div
        className="store-grade-heading"
        style={{ '--grade-accent': grade.accent } as CSSProperties}
      >
        <div>
          <span className="store-eyebrow">مكتبة صفّك</span>
          <h1>{grade.label}</h1>
          <p>كل الكتب والملازم والبكدجات الخاصة بصفّك.</p>
        </div>
        <Link href="/store/cart" className="store-secondary">
          العربة ({cartCount}) ←
        </Link>
      </div>
      <div className="store-filters">
        <span>{filtered.length} منتجات</span>
        <label className="store-search">
          <span>⌕</span>
          <input
            aria-label="ابحث في مكتبة الصف"
            placeholder="بتدور على كتاب أو ملزمة؟"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="store-added" role="status">
        {added && (
          <>
            تمت إضافة {added} للعربة. <Link href="/store/cart">راجع طلبك ←</Link>
          </>
        )}
      </div>
      <div className="store-grid store-grade-products">
        {filtered.map((product) => (
          <article className="store-product" key={product.id}>
            <Link
              href={`/store/products/${product.id}`}
              className="store-product-cover"
              aria-label={`تفاصيل ${product.title}`}
            >
              <BookCover product={product} />
              {product.compareAtMinor && (
                <span className="store-saving">
                  وفّر {formatEgp(product.compareAtMinor - product.priceMinor)}
                </span>
              )}
            </Link>
            <div className="store-product-body">
              <small>{STORE_KINDS.find((k) => k.key === product.kind)?.label} · نسخة مطبوعة</small>
              <h3>
                <Link href={`/store/products/${product.id}`}>{product.title}</Link>
              </h3>
              <p>{product.highlights[0]}</p>
              <div className="store-price">
                <strong>{formatEgp(product.priceMinor)}</strong>
                {product.compareAtMinor && <del>{formatEgp(product.compareAtMinor)}</del>}
              </div>
              <button
                className="store-button"
                disabled={!ready || product.stock < 1}
                onClick={() => {
                  addToCart(product.id);
                  setAdded(product.title);
                }}
              >
                {product.stock ? 'أضف للعربة' : 'نفدت الكمية'} <span>＋</span>
              </button>
              <small className="store-payment-tag">
                {product.allowCod ? 'متاح الدفع عند الاستلام' : 'دفع إلكتروني فقط'}
              </small>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="store-empty">
          <h2>{query ? 'مفيش منتجات مطابقة' : 'المنتجات هتتوفر قريبًا'}</h2>
          {query && (
            <button className="store-secondary" onClick={() => setQuery('')}>
              عرض منتجات الصف
            </button>
          )}
        </div>
      )}
    </div>
  );
}

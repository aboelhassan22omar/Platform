'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useStore } from './store-provider';
import { STORE_GRADES, STORE_KINDS, type StoreProduct } from './store-data';
import { formatEgp } from '@/lib/utils';

export function BookCover({
  product,
  small = false,
}: {
  product: StoreProduct;
  small?: boolean;
}) {
  const grade = STORE_GRADES.find((g) => g.key === product.grade)!;
  return (
    <div
      className={`book-stage ${small ? 'book-small' : ''}`}
      style={{ '--book-accent': grade.accent } as CSSProperties}
    >
      <div
        className={`store-book ${product.kind === 'BUNDLE' ? 'book-bundle' : ''}`}
      >
        <div
          className="book-art"
          style={{ backgroundImage: `url("${product.image || grade.art}")` }}
        />
        <div className="book-words">
          <span>أ / عمرو محروس</span>
          <div>
            <small>
              {product.kind === 'NOTES'
                ? 'التدريب والمراجعة'
                : product.kind === 'BUNDLE'
                  ? 'بكدج التفوق'
                  : 'رحلتك لفهم'}
            </small>
            <strong>التاريخ</strong>
            <p>{grade.label}</p>
          </div>
          <span>
            شرح · فهم · تفوق <b>٢٠٢٦ / ٢٠٢٧</b>
          </span>
        </div>
      </div>
    </div>
  );
}
export function Storefront() {
  const { products } = useStore();
  return (
    <div className="store-page">
      <div className="container-page">
        <section className="store-grade-intro">
          <span className="store-eyebrow">مكتبة المستر</span>
          <h1>اختار صفّك الدراسي</h1>
          <p>
            كتب الشرح، ملازم التدريب، وبكدجات المراجعة الخاصة بسنتك، كلها في
            مكان واحد.
          </p>
        </section>
        <div className="store-grade-cards">
          {STORE_GRADES.map((grade) => {
            const count = products.filter(
              (p) => p.active && p.grade === grade.key,
            ).length;
            return (
              <Link
                href={`/store/grades/${grade.key}`}
                key={grade.key}
                className="store-grade-card"
                style={{ '--grade-accent': grade.accent } as CSSProperties}
              >
                <div
                  className="store-grade-art"
                  style={{ backgroundImage: `url("${grade.art}")` }}
                >
                  <span>التاريخ</span>
                </div>
                <div className="store-grade-card-body">
                  <span className="store-eyebrow">كتب · ملازم · بكدجات</span>
                  <h2>{grade.label}</h2>
                  <p>{count} منتجات متاحة لصفّك</p>
                  <span className="store-grade-cta">
                    افتح مكتبة الصف <b>←</b>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
            تمت إضافة {added} للعربة.{' '}
            <Link href="/store/cart">راجع طلبك ←</Link>
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
              <small>
                {STORE_KINDS.find((k) => k.key === product.kind)?.label} · نسخة
                مطبوعة
              </small>
              <h3>
                <Link href={`/store/products/${product.id}`}>
                  {product.title}
                </Link>
              </h3>
              <p>{product.highlights[0]}</p>
              <div className="store-price">
                <strong>{formatEgp(product.priceMinor)}</strong>
                {product.compareAtMinor && (
                  <del>{formatEgp(product.compareAtMinor)}</del>
                )}
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
                {product.allowCod
                  ? 'متاح الدفع عند الاستلام'
                  : 'دفع إلكتروني فقط'}
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

export function ProductDetails({ id }: { id: string }) {
  const { products, addToCart, ready } = useStore();
  const [added, setAdded] = useState(false);
  const product = products.find((p) => p.id === id && p.active);
  if (!ready)
    return <div className="container-page store-page">جاري تجهيز المكتبة…</div>;
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
            {STORE_GRADES.find((g) => g.key === product.grade)?.label} ·{' '}
            {product.pages} صفحة
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
            {product.compareAtMinor && (
              <del>{formatEgp(product.compareAtMinor)}</del>
            )}
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
          <p role="status">
            {added && <Link href="/store/cart">تمت الإضافة — كمل طلبك ←</Link>}
          </p>
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

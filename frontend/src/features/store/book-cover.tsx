'use client';
import { type CSSProperties } from 'react';
import { STORE_GRADES, type StoreProduct } from './store-data';
import { platformConfig } from '@/config/platform.config';
export function BookCover({ product, small = false }: { product: StoreProduct; small?: boolean }) {
  const grade = STORE_GRADES.find((g) => g.key === product.grade)!;
  return (
    <div
      className={`book-stage ${small ? 'book-small' : ''}`}
      style={{ '--book-accent': grade.accent } as CSSProperties}
    >
      <div className={`store-book ${product.kind === 'BUNDLE' ? 'book-bundle' : ''}`}>
        <div
          className="book-art"
          style={{ backgroundImage: `url("${product.image || grade.art}")` }}
        />
        <div className="book-words">
          <span>{platformConfig.teacher.displayName}</span>
          <div>
            <small>
              {product.kind === 'NOTES'
                ? 'التدريب والمراجعة'
                : product.kind === 'BUNDLE'
                  ? 'بكدج التفوق'
                  : 'رحلتك لفهم'}
            </small>
            <strong>{platformConfig.subject.name}</strong>
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

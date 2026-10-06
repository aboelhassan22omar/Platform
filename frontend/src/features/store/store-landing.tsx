'use client';
import Link from 'next/link';
import { type CSSProperties } from 'react';
import { useStore } from './store-provider';
import { STORE_GRADES } from './store-data';
import { platformConfig } from '@/config/platform.config';
export function Storefront() {
  const { products } = useStore();
  return (
    <div className="store-page">
      <div className="container-page">
        <section className="store-grade-intro">
          <span className="store-eyebrow">مكتبة المستر</span>
          <h1>اختار صفّك الدراسي</h1>
          <p>كتب الشرح، ملازم التدريب، وبكدجات المراجعة الخاصة بسنتك، كلها في مكان واحد.</p>
        </section>
        <div className="store-grade-cards">
          {STORE_GRADES.map((grade) => {
            const count = products.filter((p) => p.active && p.grade === grade.key).length;
            return (
              <Link
                href={`/store/grades/${grade.key}`}
                key={grade.key}
                className="store-grade-card"
                style={{ '--grade-accent': grade.accent } as CSSProperties}
              >
                <div className="store-grade-art" style={{ backgroundImage: `url("${grade.art}")` }}>
                  <span>{platformConfig.subject.name}</span>
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

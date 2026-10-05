'use client';

import { useState } from 'react';

export function LessonPricingFields({ priceMinor, centerPriceMinor }: { priceMinor?: number | null; centerPriceMinor?: number | null }) {
  const [custom, setCustom] = useState(centerPriceMinor != null);
  const [centerFree, setCenterFree] = useState(centerPriceMinor === 0);
  const [centerPrice, setCenterPrice] = useState(String((centerPriceMinor ?? priceMinor ?? 0) / 100));
  return <fieldset className="grid gap-2 rounded-xl border border-gold-500/25 p-3 sm:col-span-2 sm:grid-cols-2">
    <legend className="px-1 text-sm font-black">سعر الحصة</legend>
    <label className="block"><span className="editor-label">{custom ? 'سعر الأونلاين بالجنيه' : 'السعر للسنتر والأونلاين بالجنيه'}</span><input name="price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={(priceMinor ?? 0) / 100} className="editor-input" /></label>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl bg-gold-500/5 px-3"><input name="customCenterPrice" type="checkbox" checked={custom} onChange={(event) => setCustom(event.target.checked)} className="h-5 w-5 accent-gold-600" /><span className="text-sm font-bold">سعر مختلف لطلبة السنتر</span></label>
    {custom && <div className="grid items-end gap-2 border-t border-gold-500/20 pt-2 sm:col-span-2 sm:grid-cols-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-emerald-500/10 px-3"><input name="centerFree" type="checkbox" checked={centerFree} onChange={(event) => setCenterFree(event.target.checked)} className="h-5 w-5 accent-emerald-600" /><span className="text-sm font-bold">مجاني لطلبة السنتر</span></label>
      {!centerFree && <label className="block"><span className="editor-label">سعر السنتر بالجنيه</span><input name="centerPrice" type="number" required min="0.01" step="0.01" inputMode="decimal" value={centerPrice} onChange={(event) => setCenterPrice(event.target.value)} className="editor-input" /></label>}
      <p className="text-xs text-midnight-500 dark:text-ivory-300 sm:col-span-2">{centerFree ? 'طالب السنتر يفتح الحصة مجانًا، والأونلاين بالسعر المكتوب فوق.' : 'كل طالب بيشوف ويدفع السعر الخاص بنوع حسابه.'}</p>
    </div>}
  </fieldset>;
}

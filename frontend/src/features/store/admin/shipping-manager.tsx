'use client';
import { useStore } from '../store-provider';
export function StoreShippingManager({ onMessage }: { onMessage: (message: string) => void }) {
  const store = useStore();
  const setMessage = onMessage;
  return (
    <section className="store-panel">
      <h2>الشحن حسب المحافظة</h2>
      <p>اختيار المحافظة في العربة بيحدد التكلفة تلقائيًا.</p>
      {Array.from(new Set(store.rates.map((r) => r.region))).map((region) => (
        <form
          className="store-shipping-region"
          key={region}
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get('price');
            store.updateRates(region, Math.round(Number(value) * 100));
            setMessage('تم تحديث تكلفة الشحن.');
          }}
        >
          <div>
            <h3>{region}</h3>
            <p>
              {store.rates
                .filter((r) => r.region === region)
                .map((r) => r.name)
                .join(' · ')}
            </p>
          </div>
          <label className="store-field">
            <span>الشحن بالجنيه</span>
            <input
              name="price"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              required
              defaultValue={store.rates.find((r) => r.region === region)!.priceMinor / 100}
            />
          </label>
          <button className="store-secondary">حفظ</button>
        </form>
      ))}
    </section>
  );
}

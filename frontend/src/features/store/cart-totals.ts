import type { StoreProduct } from './store.types';

export function cartTotals(
  items: { product: StoreProduct; quantity: number }[],
  shippingMinor = 0,
) {
  const subtotalMinor = items.reduce(
    (sum, item) => sum + item.product.priceMinor * item.quantity,
    0,
  );
  return {
    subtotalMinor,
    shippingMinor,
    totalMinor: subtotalMinor + shippingMinor,
    codAllowed: items.length > 0 && items.every((item) => item.product.allowCod),
  };
}

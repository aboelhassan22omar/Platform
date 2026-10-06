import { test, expect } from '@playwright/test';
import {
  initialStoreState,
  loadStoreState,
} from '../../../frontend/src/features/store/store-persistence';
import {
  createOrderSnapshot,
  storeReducer,
} from '../../../frontend/src/features/store/store-model';
import {
  EMPTY_DELIVERY,
  validateDeliveryDetails,
} from '../../../frontend/src/features/store/delivery-details';

const delivery = {
  ...EMPTY_DELIVERY,
  customerName: 'أحمد محمد',
  phone: '01012345678',
  governorate: 'CAIRO',
  city: 'مدينة نصر',
  address: 'شارع عباس العقاد',
  building: '12',
  floor: '2',
  apartment: '5',
};
function cartState() {
  let state = initialStoreState();
  state = storeReducer(state, { type: 'cart.add', id: state.products[0].id });
  return state;
}
test('placing an order snapshots totals, clears cart and reduces inventory atomically', () => {
  const state = cartState();
  const order = createOrderSnapshot(state, delivery, 'COD', 'TEST-1', '2026-10-06T00:00:00Z');
  const placed = storeReducer(state, { type: 'order.place', order });
  expect(placed.cart).toHaveLength(0);
  expect(placed.products[0].stock).toBe(state.products[0].stock - 1);
  expect(placed.orders[0].totalMinor).toBe(24000);
  const changed = storeReducer(placed, {
    type: 'product.save',
    product: { ...placed.products[0], priceMinor: 99900, highlights: ['different'] },
  });
  expect(changed.orders[0].totalMinor).toBe(24000);
  expect(changed.orders[0].items[0].product.highlights).toEqual(state.products[0].highlights);
});
test('cancelling twice only restores inventory once', () => {
  const state = cartState();
  const order = createOrderSnapshot(state, delivery, 'COD', 'TEST-2', '2026-10-06T00:00:00Z');
  const placed = storeReducer(state, { type: 'order.place', order });
  const cancelled = storeReducer(placed, {
    type: 'order.update',
    reference: order.reference,
    status: 'CANCELLED',
  });
  const again = storeReducer(cancelled, {
    type: 'order.update',
    reference: order.reference,
    status: 'CANCELLED',
  });
  expect(again.products[0].stock).toBe(state.products[0].stock);
  expect(again).toBe(cancelled);
});
test('online-only products reject COD; unpaid transfers cannot be shipped', () => {
  let state = cartState();
  state = storeReducer(state, {
    type: 'product.save',
    product: { ...state.products[0], allowCod: false },
  });
  expect(() =>
    createOrderSnapshot(state, delivery, 'COD', 'TEST-3', '2026-10-06T00:00:00Z'),
  ).toThrow(/الإلكتروني/);
  const order = createOrderSnapshot(state, delivery, 'INSTAPAY', 'TEST-3', '2026-10-06T00:00:00Z');
  let placed = storeReducer(state, { type: 'order.place', order });
  expect(
    storeReducer(placed, { type: 'order.update', reference: order.reference, status: 'SHIPPED' }),
  ).toBe(placed);
  placed = storeReducer(placed, {
    type: 'payment.submit',
    reference: order.reference,
    transferReference: 'REF-123',
  });
  placed = storeReducer(placed, {
    type: 'order.update',
    reference: order.reference,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
  });
  expect(placed.orders[0].status).toBe('CONFIRMED');
});
test('quantity respects stock and checkout rechecks inventory changes', () => {
  let state = cartState();
  state = storeReducer(state, {
    type: 'product.save',
    product: { ...state.products[0], stock: 2 },
  });
  state = storeReducer(state, { type: 'cart.quantity', id: state.products[0].id, quantity: 999 });
  expect(state.cart[0].quantity).toBe(2);
  state = storeReducer(state, {
    type: 'product.save',
    product: { ...state.products[0], stock: 0 },
  });
  expect(() =>
    createOrderSnapshot(state, delivery, 'COD', 'TEST-4', '2026-10-06T00:00:00Z'),
  ).toThrow(/غير متاح/);
});
test('optional phone/landmark can be empty, while supplied alternate phone is validated', () => {
  expect(validateDeliveryDetails(delivery).delivery?.alternatePhone).toBe('');
  expect(validateDeliveryDetails({ ...delivery, phone: '٠١٠١٢٣٤٥٦٧٨' }).delivery?.phone).toBe(
    '01012345678',
  );
  expect(validateDeliveryDetails({ ...delivery, alternatePhone: '123' }).error).toBeTruthy();
  expect(validateDeliveryDetails({ ...delivery, alternatePhone: delivery.phone }).error).toContain(
    'مختلف',
  );
});
test('malformed browser storage falls back without blocking valid session orders', () => {
  const bad = { getItem: () => '{broken', setItem: () => {} };
  const empty = { getItem: () => null, setItem: () => {} };
  const loaded = loadStoreState(bad, empty);
  expect(loaded.ready).toBeTruthy();
  expect(loaded.products).toHaveLength(15);
  expect(loaded.orders).toHaveLength(3);
  const invalid = {
    getItem: () => JSON.stringify({ products: [{ id: 'bad' }], cart: [], rates: [] }),
    setItem: () => {},
  };
  expect(loadStoreState(invalid, empty).products).toHaveLength(15);
});

/** Public module interface; implementations live in focused files. */
export type * from './store.types';
export { STORE_GRADES } from './store-grades';
export { STORE_KINDS, METHOD_LABELS, STATUS_LABELS, PAYMENT_LABELS } from './store-labels';
export { INITIAL_PRODUCTS } from './catalog-seed';
export { INITIAL_RATES } from './shipping-rates';
export { demoOrders } from './order-fixtures';
export { cartTotals } from './cart-totals';

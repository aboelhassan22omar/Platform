import { platformConfig } from '../../config/platform.config';
import { INITIAL_PRODUCTS } from './catalog-seed';
import { INITIAL_RATES } from './shipping-rates';
import { demoOrders } from './order-fixtures';
import { catalogSnapshotSchema, orderSnapshotSchema } from './store-schemas';
import type { StoreState } from './store-model';
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;
const unavailableStorage: BrowserStorage = { getItem: () => null, setItem: () => {} };
export function browserStorage(kind: 'localStorage' | 'sessionStorage'): BrowserStorage {
  try {
    return window[kind];
  } catch {
    return unavailableStorage;
  }
}
const identity = `${platformConfig.subject.key}:${platformConfig.teacher.displayName}`;
const CATALOG_KEY = `platform-store-v2:${identity}`;
const ORDERS_KEY = `platform-store-orders-v2:${identity}`;
const canMigrateHistory =
  platformConfig.subject.key === 'history' &&
  platformConfig.teacher.displayName === 'مستر عمرو محروس';
export function initialStoreState(): StoreState {
  return { ready: false, products: INITIAL_PRODUCTS, rates: INITIAL_RATES, cart: [], orders: [] };
}
function readJson(storage: BrowserStorage, key: string, legacy?: string): unknown {
  try {
    const raw = storage.getItem(key) ?? (legacy ? storage.getItem(legacy) : null);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
/** Corrupt/disabled storage must not prevent other parts of the store from loading. */
export function loadStoreState(local: BrowserStorage, session: BrowserStorage): StoreState {
  const state = initialStoreState();
  const catalog = catalogSnapshotSchema.safeParse(
    readJson(local, CATALOG_KEY, canMigrateHistory ? 'amr-store-demo-v1' : undefined),
  );
  const orders = orderSnapshotSchema.safeParse(
    readJson(session, ORDERS_KEY, canMigrateHistory ? 'amr-store-demo-orders-v1' : undefined),
  );
  return {
    ...state,
    ...(catalog.success ? catalog.data : {}),
    orders: orders.success ? orders.data : demoOrders(),
    ready: true,
  };
}
export function persistStoreCatalog(storage: BrowserStorage, state: StoreState) {
  try {
    storage.setItem(
      CATALOG_KEY,
      JSON.stringify({ products: state.products, rates: state.rates, cart: state.cart }),
    );
  } catch {
    /* In-memory store remains usable. */
  }
}
export function persistStoreOrders(storage: BrowserStorage, state: StoreState) {
  try {
    storage.setItem(ORDERS_KEY, JSON.stringify(state.orders));
  } catch {
    /* Customer details remain in the current tab. */
  }
}

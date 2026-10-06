'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type {
  DeliveryDetails,
  StoreMethod,
  StoreProduct,
  StoreStatus,
  StoreOrder,
} from './store.types';
import {
  createOrderSnapshot,
  storeReducer,
  type StoreAction,
  type StoreState,
} from './store-model';
import {
  browserStorage,
  initialStoreState,
  loadStoreState,
  persistStoreCatalog,
  persistStoreOrders,
} from './store-persistence';
import { productSchema } from './store-schemas';
export interface StoreContext extends StoreState {
  cartCount: number;
  addToCart: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  saveProduct: (product: StoreProduct) => void;
  updateRates: (region: string, priceMinor: number) => void;
  placeOrder: (delivery: DeliveryDetails, method: StoreMethod) => StoreOrder;
  submitPayment: (reference: string, transferReference: string) => void;
  updateOrder: (
    reference: string,
    status: StoreStatus,
    paymentStatus?: StoreOrder['paymentStatus'],
    note?: string,
    trackingNumber?: string,
  ) => void;
}
const Context = createContext<StoreContext | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, undefined, initialStoreState);
  const current = useRef(state);
  // Synchronous reference prevents stale inventory in back-to-back checkout/cancel actions.
  const send = useCallback((action: StoreAction) => {
    current.current = storeReducer(current.current, action);
    dispatch(action);
  }, []);
  useEffect(() => {
    send({
      type: 'hydrate',
      state: loadStoreState(browserStorage('localStorage'), browserStorage('sessionStorage')),
    });
  }, [send]);
  useEffect(() => {
    if (state.ready) persistStoreCatalog(browserStorage('localStorage'), state);
  }, [state.ready, state.products, state.rates, state.cart]);
  useEffect(() => {
    if (state.ready) persistStoreOrders(browserStorage('sessionStorage'), state);
  }, [state.ready, state.orders]);
  const value = useMemo<StoreContext>(
    () => ({
      ...state,
      cartCount: state.cart.reduce((sum, item) => sum + item.quantity, 0),
      addToCart: (id) => send({ type: 'cart.add', id }),
      setQuantity: (id, quantity) => send({ type: 'cart.quantity', id, quantity }),
      removeFromCart: (id) => send({ type: 'cart.remove', id }),
      saveProduct: (product) =>
        send({ type: 'product.save', product: productSchema.parse(product) }),
      updateRates: (region, priceMinor) => send({ type: 'shipping.update', region, priceMinor }),
      placeOrder(delivery, method) {
        const order = createOrderSnapshot(
          current.current,
          delivery,
          method,
          `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          new Date().toISOString(),
        );
        send({ type: 'order.place', order });
        return order;
      },
      submitPayment: (reference, transferReference) =>
        send({ type: 'payment.submit', reference, transferReference }),
      updateOrder: (reference, status, paymentStatus, note, trackingNumber) =>
        send({ type: 'order.update', reference, status, paymentStatus, note, trackingNumber }),
    }),
    [state, send],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore() {
  const context = useContext(Context);
  if (!context) throw new Error('StoreProvider is required');
  return context;
}

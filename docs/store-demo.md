# Store presentation demo

The store is an interactive, browser-only preview requested for a client presentation. There are no store API endpoints, database writes, payment destinations, actual transfers, shipments, or payment-provider calls.

- `/store`: five grade selection cards. Product lists appear only after choosing a grade.
- `/store/grades/[id]`: books, notes, and bundles for that grade together in one searchable grid.
- `/store/products/[id]`: product details and cart addition.
- `/store/cart`: persistent cart, quantities, guest delivery information, governorate shipping, payment selection, and final review.
- `/store/orders/[reference]`: simulated order confirmation and transfer submission.
- `/admin/store`: staff UI for demo product editing, COD availability, shipping prices, transfer review, and fulfillment states. This uses the existing staff route guard; browser demo data is not a production authorization boundary.

Products, cart, and shipping rates use localStorage (`platform-store-v2:<subject>:<teacher>`). Orders and submitted delivery details use sessionStorage (`platform-store-orders-v2:<subject>:<teacher>`) and remain in the current browser tab session. Clear these keys to reset the presentation. Changes do not sync to other devices or browsers. Existing `amr-store-demo-v1` and `amr-store-demo-orders-v1` data is migrated only for the original history/Amr Mahrous identity. Malformed snapshots fall back safely to initial data. Use fictional customer information during presentations.

Store logic is independent of React: `store-model.ts` owns cart, stock and order transitions; `cart-totals.ts` computes totals; `delivery-details.ts` validates delivery fields; `store-schemas.ts` checks persisted snapshots; `store-persistence.ts` handles storage; `store-provider.tsx` connects this model to the interface. Repeated cancellation cannot restore stock twice. Landmark and alternate phone remain optional.

Shipping defaults: Greater Cairo 60 EGP; Delta 80 EGP; Upper Egypt and border governorates 100 EGP. All 27 governorates are available. Staff can change each region's demo price. An online-only item disables COD for the whole cart. Prices and order snapshots are computed in integer piastres; changing a product or shipping rate does not alter an existing order.

The presentation UI uses standard storefront wording without demo notices. Cart controls appear only under `/store`. Governorate options contain names only; shipping appears in the order summary, without a regional rate list. These presentation changes do not enable real payments or server-side orders.

Browser checks:

```powershell
npm --workspace tests/e2e test -- specs/store-demo.spec.ts --project=desktop-chrome --project=mobile-360
```

Live implementation will require server-side products, inventory, shipping, orders, validation and access controls, as well as actual payment configuration and payment verification. This demo does not change existing lesson payments.

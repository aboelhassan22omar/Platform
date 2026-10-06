import { StoreOrderView } from '@/features/store/store-order';
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <StoreOrderView reference={reference} />;
}

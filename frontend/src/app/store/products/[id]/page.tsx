import { ProductDetails } from '@/features/store/storefront';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetails id={id} />;
}

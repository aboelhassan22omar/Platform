import { redirect } from 'next/navigation';

/** The transfer review page became the payments log. */
export default function TransfersPage() {
  redirect('/admin/payments');
}

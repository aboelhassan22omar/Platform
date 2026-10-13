import { redirect } from 'next/navigation';

/** Transfer review lives at the top of the payments log. */
export default function TransfersPage() {
  redirect('/admin/payments');
}

export interface NavigationItem {
  href: string;
  label: string;
  /** Hidden in the store apps, which sell nothing (see lib/native-app.ts). */
  webOnly?: boolean;
}

export const primaryNavigation: readonly NavigationItem[] = Object.freeze([
  { href: '/', label: 'الرئيسية' },
  { href: '/grades', label: 'الصفوف الدراسية' },
  { href: '/store', label: 'المتجر', webOnly: true },
  { href: '/about', label: 'عن الأستاذ' },
  { href: '/contact', label: 'تواصل معنا' },
]);

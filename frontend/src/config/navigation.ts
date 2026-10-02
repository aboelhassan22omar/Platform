export interface NavigationItem {
  href: string;
  label: string;
}

export const primaryNavigation: readonly NavigationItem[] = Object.freeze([
  { href: '/', label: 'الرئيسية' },
  { href: '/grades', label: 'الصفوف الدراسية' },
  { href: '/about', label: 'عن الأستاذ' },
  { href: '/contact', label: 'تواصل معنا' },
]);


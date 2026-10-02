import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center bg-ivory-100">
      <div className="container-page max-w-md text-center">
        <p className="font-display text-7xl font-black text-gold-500">٤٠٤</p>
        <h1 className="mt-4 font-display text-2xl font-black text-midnight-900">
          الصفحة دي مش موجودة
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-midnight-500">
          يمكن الرابط اتغيّر أو الصفحة اتشالت. جرّب ترجع للرئيسية.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-midnight-900 px-6 text-sm font-bold text-ivory-50 transition-colors hover:bg-midnight-800"
          >
            الرئيسية
          </Link>
          <Link
            href="/grades"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ivory-400 px-6 text-sm font-bold text-midnight-700 transition-colors hover:border-gold-500"
          >
            الصفوف الدراسية
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { RoyalCartouche } from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

export const metadata: Metadata = {
  title: `الشروط والأحكام | ${platformConfig.brand.platformName}`,
  description: `القواعد والضوابط الرسمية لاستخدام ${platformConfig.brand.platformName} — شروط الحسابات، الملكية الفكرية، وحظر مشاركة الحسابات.`,
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#040913] text-[#f8fafc] selection:bg-amber-500 selection:text-slate-950">
      {/* Background Pharaonic Ambience */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 50% at 50% 0%, rgba(245, 158, 11, 0.18), transparent 75%),
            radial-gradient(circle 380px at 90% 85%, rgba(180, 83, 9, 0.14), transparent 70%),
            radial-gradient(circle 320px at 10% 70%, rgba(14, 116, 144, 0.14), transparent 70%)
          `,
        }}
      />

      {/* Header / Hero Section */}
      <header className="relative border-b border-amber-500/20 bg-gradient-to-b from-[#071322] via-[#050d18] to-[#040913] py-16 sm:py-24 overflow-hidden">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f59e0b08_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="container-page relative z-10 text-center">
          {/* Breadcrumb & Top Pill */}
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
            <Link href="/" className="hover:text-amber-300 transition-colors">
              الرئيسية
            </Link>
            <span>/</span>
            <span className="text-slate-400">الشروط والأحكام</span>
          </div>

          <div className="flex justify-center mb-4">
            <RoyalCartouche variant="gold">
              <span className="text-xs sm:text-sm font-extrabold tracking-wider">
                📜 وثيقة القواعد النظامية والتعاقدية الرسمية
              </span>
            </RoyalCartouche>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-4">
            الشروط والأحكام والسياسات العامة
          </h1>

          <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
            تحدد هذه الوثيقة القواعد الملزمة لاستخدام {platformConfig.brand.platformName}. تهدف هذه
            الشروط إلى صون حقوق الطلاب، وحماية الملكية الفكرية، وضمان تجربة تعليمية رائدة وعادلة
            للجميع.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 border border-amber-500/30 text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              آخر تحديث: سبتمبر ٢٠٢٦
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 border border-blue-500/30 text-blue-300">
              سارية على كافة الحسابات والاشتراكات
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container-page relative z-10 py-12 sm:py-20">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* ============================================================== */}
          {/* STRICT ACCOUNT SHARING WARNING BANNER (بند منع المشاركة الصارم) */}
          {/* ============================================================== */}
          <section className="relative overflow-hidden rounded-3xl border-2 border-red-500/70 bg-gradient-to-br from-red-950/60 via-[#180808] to-[#0d0404] p-6 sm:p-9 shadow-[0_0_50px_rgba(239,68,68,0.25)]">
            <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40 text-2xl shadow-inner">
                ⚠️
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-0.5 text-xs font-black text-red-300 border border-red-500/40">
                  بند أمني صارم لا تهاون فيه
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  حظر مشاركة الحسابات بين أكثر من شخص (الحق الكامل في الإغلاق النهائي)
                </h2>

                <p className="text-sm sm:text-base leading-relaxed text-red-100/90 font-medium">
                  <strong>الحساب المسجل على المنصة شخصي وفردي بالكامل وخاص بطالب واحد فقط</strong>.
                  يُحظر حظراً قاطعاً ومطلقاً مشاركة اسم المستخدم أو كلمة السر مع أي صديق أو زميل أو
                  أي شخص آخر، أو تشغيل الحساب بالتزامن أو بالتبادل على أجهزة متعددة غير مصرح بها.
                </p>

                <div className="rounded-xl border border-red-500/40 bg-red-950/80 p-4 text-xs sm:text-sm text-red-200 leading-relaxed font-bold space-y-2">
                  <p>
                    📌 <strong>المراقبة والتتبع التقني:</strong> زُوّدت منصة «
                    {platformConfig.brand.shortPlatformName}» بأنظمة ذكية متقدمة لرصد الجلسات
                    المتزامنة، وفحص عناوين الشبكات (IP Addresses)، وتتبع بصمات الأجهزة (Device
                    Fingerprinting).
                  </p>
                  <p className="text-amber-200">
                    ⚖️ <strong>القرار الإداري الباتّ:</strong> في حالة اكتشاف أو ثبوت استخدام الحساب
                    بواسطة أكثر من شخص أو تداوله بأي شكل،{' '}
                    <strong>
                      تمتلك إدارة المنصة الحق القانوني والإداري الكامل في إغلاق وحظر الحساب نهائياً
                      وفورياً ودون سابق إنذار، مع إسقاط وإلغاء كافة الاشتراكات والحصص المتبقية دون
                      أي التزام برد أي مبالغ مالية أو تقديم أي تعويضات
                    </strong>
                    ، فضلاً عن اتخاذ الإجراءات القانونية اللازمة في حال ثبوت تسريب المحتوى.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Jump Navigation */}
          <div className="rounded-2xl border border-amber-500/25 bg-[#071526]/80 p-4 sm:p-6 backdrop-blur-xl shadow-lg">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-3">
              فهرس المواد والبنود القانونية
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
              <a
                href="#section-1"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ١. شروط الحساب
              </a>
              <a
                href="#section-2"
                className="rounded-xl bg-red-500/15 hover:bg-red-500/25 p-2.5 text-center text-red-300 border border-red-500/30 transition-colors"
              >
                ٢. أمن الحساب والمشاركة
              </a>
              <a
                href="#section-3"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٣. الملكية الفكرية
              </a>
              <a
                href="#section-4"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٤. الاشتراكات والدفع
              </a>
              <a
                href="#section-5"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٥. الامتحانات والمشاهدة
              </a>
              <a
                href="#section-6"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٦. سياسة الاسترداد
              </a>
              <a
                href="#section-7"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٧. مدونة السلوك
              </a>
              <a
                href="#section-8"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٨. الدعم والتواصل
              </a>
            </div>
          </div>

          {/* Section 1: Account Registration */}
          <section
            id="section-1"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ١
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                إنشاء الحساب والبيانات المطلوبة
              </h2>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong>أهلية التسجيل:</strong> المنصة مخصصة لطلاب المرحلة الثانوية (الثانوية العامة
                والبكالوريا المصرية) المسجلين في الصفوف الدراسية المقررة.
              </li>
              <li>
                <strong>صحة البيانات:</strong> يلتزم الطالب بإدخال اسمه الحقيقي الكامل، ورقم هاتفه
                الشخصي الفعلي، ورقم هاتف ولي الأمر الصحيح، وتحديد نظامه التعليمي بدقة.
              </li>
              <li>
                <strong>مسؤولية الحساب:</strong> يُعد الطالب وولي أمره مسؤولين مسؤولية تامة عن
                الحفاظ على سرية كلمة السر وكافة الأنشطة التي تتم من خلال الحساب.
              </li>
              <li>
                <strong>بيانات الاتصال بولي الأمر:</strong> تُعد وسيلة التواصل الأساسية لإرسال
                تقارير الغياب والحضور، ونتائج الامتحانات الدورية، وتحديثات الاشتراك.
              </li>
            </ul>
          </section>

          {/* Section 2: Account Sharing & Device Limits */}
          <section
            id="section-2"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/20 text-red-300 font-black text-sm border border-red-500/30">
                ٢
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                ضوابط الجلسات وتعدد الأجهزة وحظر المشاركة
              </h2>
            </div>
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                تسمح المنصة للطالب باستخدام جهاز شخصي واحد أساسي (هاتف ذكي، تابلت، أو جهاز حاسوب).
                في حال رغبة الطالب في تبديل جهازه بداعي التلف أو الترقية، يتم ذلك عبر التواصل مع
                الدعم الفني للتحقق من الهوية.
              </p>
              <div className="rounded-2xl bg-amber-500/10 p-4 border border-amber-500/25 space-y-2">
                <h4 className="text-amber-300 font-black text-xs sm:text-sm">
                  ⚡ المخالفات الصريحة التي توجب الغلق النهائي للحساب:
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-200">
                  <li>فتح الحساب في نفس التوقيت من محافظتين أو منطقتين جغرافيتين مختلفتين.</li>
                  <li>
                    تسجيل الدخول المتكرر من أجهزة متعددة ومختلفة خلال فترات زمنية قصيرة دون مبرر
                    تقني.
                  </li>
                  <li>تداول كلمة السر في مجموعات التليجرام أو الواتساب أو مع الأصدقاء.</li>
                  <li>محاولة تجاوز القيود البرمجية للأجهزة المعتمدة.</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400 italic">
                * عند اتخاذ قرار حظر الحساب نتيجة المشاركة، يسقط حق الطالب في المطالبة بأي مبالغ
                مالية متبقية، ولا يجوز إعادة فتح الحساب أو إنشاء حساب بديل لنفس الطالب إلا بموافقة
                خطية من إدارة المنصة.
              </p>
            </div>
          </section>

          {/* Section 3: Intellectual Property */}
          <section
            id="section-3"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٣
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                حقوق الملكية الفكرية وحماية المحتوى التعليمي
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                جميع المواد التعليمية المنشورة على المنصة — بما في ذلك الفيديوهات المصورة، المذكرات
                الرقمية (PDF)، بنوك الأسئلة، أسئلة الامتحانات، والتسجيلات الصوتية — هي{' '}
                <strong>ملك فكري حصري لـ{platformConfig.teacher.displayName}</strong> ومحمية بموجب
                القوانين المصرية والدولية لحماية الملكية الفكرية وحقوق المؤلف.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>يُحظر تماماً:</strong> تصوير الشاشة (Screen Recording)، أو التقاط لقطات
                  الشاشة للواجبات الحصرية، أو استخدام برامج تحميل الفيديو، أو إعادة رفع المحتوى على
                  منصات يوتيوب، تليجرام، تيك توك، فيسبوك، أو أي وسيط إلكتروني أو مطبوع.
                </li>
                <li>
                  <strong>العلامات المائية الرقمية:</strong> تشتمل جميع الفيديوهات على علامات مائية
                  ديناميكية غير قابلة للإزالة تظهر بيانات الطالب المسجل ورقم هاتفه بشكل دوري أثناء
                  العرض.
                </li>
                <li>
                  <strong>المساءلة القانونية والجنائية:</strong> أي تسريب أو قرصنة سيُقابل فوراً
                  بفتح بلاغ رسمي لدى الإدارة العامة لتكنولوجيا المعلومات ومباحث الإنترنت بوزارة
                  الداخلية المصرية للمطالبة بالتعويضات الجنائية والمدنية.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Subscriptions & Payments */}
          <section
            id="section-4"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٤
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                الاشتراكات، المشتريات، وبوابات الدفع
              </h2>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong>العملة والضرائب:</strong> تُعرض كافة الأسعار بالجنيه المصري (EGP) وتتضمن أية
                رسوم أو ضرائب مقررة قانوناً.
              </li>
              <li>
                <strong>أنواع الاشتراكات:</strong>
                <ul className="list-circle list-inside pe-6 mt-1.5 space-y-1 text-slate-300">
                  <li>
                    <strong>شراء الحصة المنفردة:</strong> يمنح الطالب حق مشاهدة الحصة وحل واجباتها
                    لعدد محدد من المشاهدات أو حتى نهاية العام الدراسي.
                  </li>
                  <li>
                    <strong>الاشتراك الشهري / باقة الفصل:</strong> يمنح وصولاً لكافة حصص الشهر
                    المحدد طوال سريان فترة الباقة.
                  </li>
                </ul>
              </li>
              <li>
                <strong>عدم التجديد التلقائي:</strong> حرصاً على راحة أولياء الأمور، لا تقوم المنصة
                بسحب مبالغ تجديد تلقائية دون موافقة مسبقة وإجراء دفع يدوي من المستخدم.
              </li>
              <li>
                <strong>أمان الدفع:</strong> تتم المعاملات من خلال المحافظ الإلكترونية أو إنستا باي،
                ولا تتيح المنصة الدفع بالبطاقات البنكية.
              </li>
            </ul>
          </section>

          {/* Section 5: Exams & Academic Attendance */}
          <section
            id="section-5"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٥
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                نظام الامتحانات والمتابعة الأكاديمية
              </h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              تتبنى المنصة منهجية تعليمية جادة تهدف إلى تحقيق الطالب للدرجة النهائية في التاريخ.
              بناءً عليه:
            </p>
            <ul className="space-y-2 text-sm text-slate-300 list-disc list-inside">
              <li>
                يُشترط حل الواجب الأسبوعي واجتياز امتحان الحصة بحد أدنى للدرجات لفتح الحصة التالية.
              </li>
              <li>
                في حالة التخلف عن أداء الامتحانات الشاملة، يتم إشعار ولي الأمر فورياً، وقد يتم تعليق
                الوصول للحصص مؤقتاً حتى أداء الامتحان التراكمي.
              </li>
              <li>
                يُمنع استخدام أي أدوات للغش الإلكتروني أثناء تأدية الاختبارات المؤقتة بزمن، وتُلغى
                نتيجة الامتحان في حال الخروج المتكرر من شاشة الاختبار.
              </li>
            </ul>
          </section>

          {/* Section 6: Refund Policy */}
          <section
            id="section-6"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٦
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                سياسة الاسترجاع والإلغاء
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>نظراً لطبيعة المنتجات الرقمية التعليمية وسهولة استهلاك المحتوى:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>قبل استهلاك الحصة:</strong> يحق للطالب طلب استرجاع قيمة الحصة أو الاشتراك
                  خلال ٤٨ ساعة من تاريخ الشراء، بشرط ألا يكون قد تم فتح الحصة أو تشغيل أكثر من ١٠٪
                  من الفيديو أو تحميل الملزمة.
                </li>
                <li>
                  <strong>الأعطال الفنية المثبتة:</strong> إذا واجه الطالب عطلاً فنياً من خوادم
                  المنصة حال دون تمكنه من مشاهدة الحصة بعد استنفاد محاولات الدعم الفني، يتم تعويضه
                  إما بمد فترة المشاهدة أو استرداد كامل للمبلغ.
                </li>
                <li>
                  <strong>استثناءات الاسترداد:</strong> لا يسري الاسترجاع على الحسابات المحظورة بسبب
                  مخالفة شروط الاستخدام أو مشاركة الحساب أو محاولات تسجيل الشاشة.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 7: Code of Conduct */}
          <section
            id="section-7"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٧
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                مدونة السلوك والانضباط الأخلاقي
              </h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              يُشترط في جميع غرف النقاش ومجتمعات الطلاب والتعليقات المباشرة مع المعلم وفريق الدعم:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-300">
              <li>الالتزام التام بالأدب والاحترام المتبادل بين الطلاب والمعلمين والمشرفين.</li>
              <li>منع نشر أي محتوى مسيء، سياسي، إعلاني، أو غير متعلق بالمادة العلمية المقررة.</li>
              <li>يحق لإدارة المنصة حظر أي طالب يثبت تورطه في التنمر أو الإساءة للغير.</li>
            </ul>
          </section>

          {/* Section 8: Support & Legal Contact */}
          <section
            id="section-8"
            className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#0c2238] via-[#071424] to-[#040a12] p-6 sm:p-9 shadow-2xl text-center space-y-4"
          >
            <h3 className="text-xl font-black text-white">
              هل لديك أي استفسار حول الشروط والأحكام؟
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              فريق الشؤون القانونية والدعم الفني لمنصة «{platformConfig.brand.shortPlatformName}»
              متاح يومياً لمساعدتك والإجابة على أية تساؤلات.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-xs sm:text-sm font-black text-slate-950 shadow-lg hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105"
              >
                <span>📞</span>
                <span>تواصل مع الدعم الفني</span>
              </Link>
              <Link
                href="/privacy"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                <span>🛡️</span>
                <span>الاطلاع على سياسة الخصوصية</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { RoyalCartouche } from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

export const metadata: Metadata = {
  title: `سياسة الخصوصية وحماية البيانات | ${platformConfig.brand.platformName}`,
  description: `ميثاق حماية البيانات الشخصية والخصوصية في ${platformConfig.brand.platformName} وفقاً للقانون المصري رقم ١٥١ لسنة ٢٠٢٠.`,
};

export default function PrivacyPage() {
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
            <span className="text-slate-400">سياسة الخصوصية</span>
          </div>

          <div className="flex justify-center mb-4">
            <RoyalCartouche variant="gold">
              <span className="text-xs sm:text-sm font-extrabold tracking-wider">
                🛡️ ميثاق الأمان الرقمي وحماية بيانات الطلاب
              </span>
            </RoyalCartouche>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-4">
            سياسة الخصوصية وسرية البيانات
          </h1>

          <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
            نلتزم في {platformConfig.brand.platformName} بصون خصوصية طلابنا وأولياء أمورهم بأعلى
            المعايير الأمنية، وبما يتوافق مع أحكام قانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة
            ٢٠٢٠.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 border border-amber-500/30 text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              آخر تحديث: سبتمبر ٢٠٢٦
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/30 text-emerald-300">
              ✓ متوافق مع قانون حماية البيانات الشخصية رقم ١٥١ لسنة ٢٠٢٠
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container-page relative z-10 py-12 sm:py-20">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* ============================================================== */}
          {/* THREE CORE PRIVACY PILLARS BANNER (المبادئ الثلاثة الكبرى)       */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#0b1c30] to-[#06101d] p-5 shadow-lg relative overflow-hidden">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="text-base font-black text-amber-300 mb-1">تشفير متطور وشامل</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                كلمات المرور مشفرة خوارزمياً عبر (Argon2id)، وكافة الاتصالات محمية ببروتوكول تشفير
                TLS 1.3 فائق الأمان.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#061f18] to-[#04100c] p-5 shadow-lg relative overflow-hidden">
              <div className="text-2xl mb-2">🚫</div>
              <h3 className="text-base font-black text-emerald-300 mb-1">
                عدم بيع البيانات قطيعاً
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                بيانات الطلاب وأرقام الهواتف ملك حصري لهم، ولا يتم بيعها أو تأجيرها أو تمريرها لأي
                شركات إعلانية أو جهات خارجية.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#071d33] to-[#040e1a] p-5 shadow-lg relative overflow-hidden">
              <div className="text-2xl mb-2">💳</div>
              <h3 className="text-base font-black text-blue-300 mb-1">معاملات بنكية آمنة</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                المنصة لا تخزن بيانات البطاقات المصرفية على الإطلاق؛ وتُدار المدفوعات عبر بوابات
                رسمية مرخصة من البنك المركزي المصري.
              </p>
            </div>
          </div>

          {/* Quick Jump Navigation */}
          <div className="rounded-2xl border border-amber-500/25 bg-[#071526]/80 p-4 sm:p-6 backdrop-blur-xl shadow-lg">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-3">
              فهرس سياسة الخصوصية
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
              <a
                href="#section-1"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ١. البيانات المجمعة
              </a>
              <a
                href="#section-2"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٢. أغراض الاستخدام
              </a>
              <a
                href="#section-3"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٣. بيانات القاصرين
              </a>
              <a
                href="#section-4"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٤. التدابير الأمنية
              </a>
              <a
                href="#section-5"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٥. ملفات الكوكيز
              </a>
              <a
                href="#section-6"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٦. أطراف المعالجة
              </a>
              <a
                href="#section-7"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٧. حفظ البيانات وحذفها
              </a>
              <a
                href="#section-8"
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-center text-amber-300 border border-amber-500/20 transition-colors"
              >
                ٨. حقوق المستخدم
              </a>
            </div>
          </div>

          {/* Section 1: Data Collected */}
          <section
            id="section-1"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ١
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                البيانات التي نقوم بجمعها
              </h2>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              نجمع الحد الأدنى والضروري فقط من البيانات لتوفير الخدمات التعليمية والتحقق من هوية
              الطالب المسجل:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-2xl border border-amber-500/15 bg-slate-900/60 p-4 space-y-2">
                <h4 className="text-sm font-bold text-amber-400">👤 بيانات الحساب الشخصي:</h4>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>الاسم الرباعي الكامل للطالب (كما هو في السجلات الرسمية).</li>
                  <li>رقم هاتف الطالب الفعلي (لتأكيد التسجيل والدخول واستعادة الحساب).</li>
                  <li>رقم هاتف ولي الأمر (لإرسال درجات الامتحانات والتقارير الدورية).</li>
                  <li>الصف الدراسي والشعبة (للتحكم في المقررات المتاحة).</li>
                  <li>المحافظة والمدينة (للتنسيق اللوجستي والمجموعات الجغرافية).</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-500/15 bg-slate-900/60 p-4 space-y-2">
                <h4 className="text-sm font-bold text-amber-400">
                  📊 بيانات النشاط الأكاديمي والتقني:
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>سجل مشاهدة الحصص التعليمية ونسبة الإنجاز (لدعم ميزة الإكمال من حيث وقفت).</li>
                  <li>نتائج الامتحانات والواجبات الدورية والإجابات النموذجية.</li>
                  <li>معرفات الجلسة وبصمة الجهاز وعنوان IP (لرصد مشاركة الحساب ومنع الاختراق).</li>
                  <li>
                    سجلات المعاملات المالية وأكواد الدفع وتأكيد العمليات (دون بيانات البطاقة).
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Usage Purposes */}
          <section
            id="section-2"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٢
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                أغراض واستخدامات البيانات
              </h2>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong>تشغيل الخدمة التعليمية:</strong> إتاحة الوصول للحصص المشترك بها، وتحميل
                المذكرات المخصصة، وإجراء الاختبارات التقييمية التراكمية.
              </li>
              <li>
                <strong>إخطار ومتابعة أولياء الأمور:</strong> إرسال تقارير الغياب، والدرجات المحققة
                في امتحانات الحصص عبر الرسائل النصية القصيرة (SMS) أو رسائل الواتساب الرسمية.
              </li>
              <li>
                <strong>الحماية ومكافحة القرصنة:</strong> استخدام البصمة التقنية للتحقق من عدم تداول
                الحساب بين أكثر من طالب والحفاظ على سلامة المنصة.
              </li>
              <li>
                <strong>الدعم الفني والأكاديمي:</strong> الرد على استفسارات الطالب، ومعالجة أية
                مشكلات تقنية تواجهه أثناء المشاهدة أو الدفع.
              </li>
            </ul>
          </section>

          {/* Section 3: Protection of Minors */}
          <section
            id="section-3"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٣
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                حماية بيانات الطلاب القاصرين (أقل من ١٨ عاماً)
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                نظراً لأن {platformConfig.brand.platformName} موجهة لطلاب المرحلة الثانوية الذين تقل
                أعمار أغلبهم عن ١٨ عاماً، فإننا نولي حماية بيانات القاصرين أقصى درجات العناية
                والرعاية القانونية:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>اشتراط رقم ولي الأمر:</strong> يُشترط إدخال رقم هاتف ولي الأمر كشرط إلزامي
                  لإنشاء الحساب، ويُعد تسجيل الحساب موافقة صريحة من ولي الأمر على شروط الخدمة وسياسة
                  الخصوصية.
                </li>
                <li>
                  <strong>حق الرقابة والمتابعة لولي الأمر:</strong> يحق لولي الأمر في أي وقت طلب كشف
                  كامل بسجلات نشاط ابنه الأكاديمي، أو الاستفسار عن درجاته ومرات حضوره.
                </li>
                <li>
                  <strong>حظر الإعلانات الموجهة:</strong> لا تحتوي المنصة على أية إعلانات تجارية
                  موجهة أو غير موجهة للأطفال أو المراهقين.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Security & Video Protection */}
          <section
            id="section-4"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٤
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                التدابير الأمنية وحماية المحتوى المرئي
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                تعتمد بنيتنا التحتية أحدث تقنيات الأمن السيبراني لحماية البيانات من الاختراق أو
                التسريب:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>تشفير كلمات المرور:</strong> تُحفظ كلمات المرور باستخدام خوارزمية التشفير
                  المتطورة <code>Argon2id</code>، ولا يمكن فك تشفيرها أو رؤيتها حتى من قِبل مهندسي
                  ومطوري المنصة.
                </li>
                <li>
                  <strong>بروتوكول الاتصال المشفر:</strong> تتم جميع الاتصالات ونقل البيانات بين
                  متصفح الطالب وخوادم المنصة عبر شهادات أمان SSL/TLS 1.3 المتقدمة المشفرة.
                </li>
                <li>
                  <strong>تقنية العلامة المائية الديناميكية:</strong> تُعرض علامة مائية عشوائية
                  متحركة تتضمن اسم الطالب ورقم هاتفه داخل مشغل الفيديو لردع محاولات التصوير
                  والقرصنة.
                </li>
                <li>
                  <strong>سجلات التدقيق الأمني (Audit Logs):</strong> يتم تسجيل أية محاولات دخول
                  مريبة أو نشاط غير معتاد مع منع الهجمات تلقائياً عبر جدران حماية متطورة (WAF).
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5: Cookies & Storage */}
          <section
            id="section-5"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٥
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                ملفات تعريف الارتباط (Cookies)
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                نستخدم في المنصة ملفات تعريف الارتباط التشغيلية الفنية الضرورية فقط، والتي تهدف إلى
                ضمان عمل الحساب بسلاسة وأمان:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>كوكيز الجلسة الآمنة (Session Cookies):</strong> تُصنف بخاصية{' '}
                  <code>HttpOnly</code> و <code>Secure</code>، مما يمنع نصوص الجافاسكربت الضارة من
                  الوصول إليها أو استغلالها (الحماية ضد هجمات XSS).
                </li>
                <li>
                  <strong>تفضيلات واجهة المستخدم:</strong> لحفظ إعدادات المظهر المفضل للطالب وحجم
                  الخط المناسب للقراءة.
                </li>
                <li>
                  <strong>غياب كوكيز التتبع الخارجي:</strong> لا نستخدم أي ملفات تعريف ارتباط خاصة
                  بشركات الإعلانات أو شبكات تتبع سلوك المستخدم عبر المواقع الأخرى.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 6: Third-Party Processors */}
          <section
            id="section-6"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٦
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                الشركاء والجهات المعالجة للبيانات
              </h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              نتعامل فقط مع شركاء تقنيين موثوقين ومصرح لهم بالعمل لتشغيل خدمات المنصة، مع التزامهم
              التام بضوابط السرية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-300">
              <li>
                <strong>خدمات الدفع الإلكتروني:</strong> مزودو خدمات المحافظ الإلكترونية وإنستا باي
                لإتمام عمليات الدفع والتحقق منها بأمان.
              </li>
              <li>
                <strong>مزودو الرسائل النصية وخدمات الواتساب:</strong> لإرسال رسائل التحقق (OTP)
                وتقارير المتابعة الدورية لأولياء الأمور.
              </li>
              <li>
                <strong>الجهات القضائية والرسمية:</strong> لا يتم الإفصاح عن أي بيانات للجهات
                الحكومية إلا في حال وجود طلب رسمي مبرر قانوناً أو أمر قضائي صادر من النيابة العامة
                المصرية طبقاً لأحكام القانون.
              </li>
            </ul>
          </section>

          {/* Section 7: Data Retention & Deletion */}
          <section
            id="section-7"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٧
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                فترة الاحتفاظ بالبيانات وسياسة الحذف
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                نحتفظ ببيانات الطالب الأكاديمية والشخصية طوال فترة تسجيله ونشاطه على المنصة خلال
                العام الدراسي.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>نهاية العام الدراسي:</strong> بعد انتهاء ماراثون امتحانات الثانوية العامة،
                  تتم أرشفة السجلات الأكاديمية وحذف البيانات غير الضرورية مع الاحتفاظ بالبيانات
                  المحاسبية وفقاً للمدد المقررة قانوناً.
                </li>
                <li>
                  <strong>طلب حذف الحساب:</strong> يحق للطالب أو ولي أمره التقدم بطلب إغلاق وحذف
                  الحساب نهائياً عبر قنوات الدعم الفني، ويتم معالجة الطلب ومحو كافة البيانات الشخصية
                  خلال مدة أقصاها ٧ أيام عمل.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 8: User Legal Rights */}
          <section
            id="section-8"
            className="rounded-3xl border border-amber-500/20 bg-[#071322]/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-amber-500/15 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/30">
                ٨
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                حقوق الطالب وولي الأمر (وفقاً للقانون رقم ١٥١ لسنة ٢٠٢٠)
              </h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              يضمن القانون المصري المنظم لحماية البيانات الشخصية للمستخدمين وأولياء أمورهم باقة من
              الحقوق الأساسية التي نلتزم بها التزاماً كاملاً:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-200">
              <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                ✓ <strong>الحق في المعرفة والاطلاع:</strong> معرفة نوعية البيانات التي نجمعها وسبب
                جمعها.
              </div>
              <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                ✓ <strong>الحق في التصحيح والتحديث:</strong> تعديل أي بيانات غير صحيحة مسجلة
                بالحساب.
              </div>
              <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                ✓ <strong>الحق في محو البيانات:</strong> طلب حذف البيانات الشخصية عند انتهاء الغرض
                منها.
              </div>
              <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
                ✓ <strong>الحق في الأمان:</strong> الحصول على إخطار فوري في حال حدوث أي اختراق أمني
                للبيانات.
              </div>
            </div>
          </section>

          {/* Section 9: Support & Contact */}
          <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#0c2238] via-[#071424] to-[#040a12] p-6 sm:p-9 shadow-2xl text-center space-y-4">
            <h3 className="text-xl font-black text-white">هل لديك استفسار حول خصوصية بياناتك؟</h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              مسؤول حماية البيانات وفريق الدعم الفني في {platformConfig.brand.platformName} يسعدهم
              الرد على كافة استفساراتكم وملاحظاتكم.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-xs sm:text-sm font-black text-slate-950 shadow-lg hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105"
              >
                <span>📞</span>
                <span>تواصل مع مسؤول الخصوصية والدعم</span>
              </Link>
              <Link
                href="/terms"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                <span>📜</span>
                <span>الاطلاع على الشروط والأحكام</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

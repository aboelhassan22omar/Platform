'use client';

import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { fadeUp } from '@/lib/motion';
import {
  RoyalCartouche,
  HieroglyphCorner,
} from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

const CHANNELS = [
  {
    type: 'facebook',
    title: 'الصفحة الرسمية على فيسبوك',
    value: platformConfig.teacher.displayName,
    hint: 'المذكرات، البثوث المباشرة، جداول السناتر وتحديثات المواعيد أولاً بأول',
    link: platformConfig.contact.facebookUrl,
    btnText: 'زيارة الصفحة الرسمية',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    type: 'whatsapp1',
    title: 'واتساب الدعم الفني والاشتراكات',
    value: platformConfig.contact.supportWhatsAppLabel,
    hint: 'لتفعيل الحصص، حل مشاكل المشاهدة، وتأكيد الدفع',
    link: `https://wa.me/${platformConfig.contact.supportWhatsApp}`,
    btnText: 'محادثة فورية (دعم فني)',
    badge: 'متاح ٩ص - ١١م',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    type: 'whatsapp2',
    title: 'واتساب فريق المساعدين والمتابعة',
    value: platformConfig.contact.followUpWhatsAppLabel,
    hint: 'لإرسال الواجبات، الاستفسارات المنهجية، وتقارير أولياء الأمور',
    link: `https://wa.me/${platformConfig.contact.followUpWhatsApp}`,
    btnText: 'تواصل مع المساعدين',
    badge: 'متابعة الطلاب',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    type: 'phone',
    title: 'الخط الساخن للمكالمات المباشرة',
    value: platformConfig.contact.phoneLabel,
    hint: 'للاتصال الهاتفي السريع واستفسارات أولياء الأمور ومواعيد السناتر',
    link: `tel:${platformConfig.contact.phone}`,
    btnText: 'اتصال هاتفي',
    badge: 'مكالمات صوتية',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
];

interface CenterClass {
  grade: string;
  day?: string;
  time: string;
  subject: string;
}

interface CenterLocation {
  name: string;
  area: string;
  address: string;
  schedule: CenterClass[];
}

const CENTERS: CenterLocation[] = [
  {
    name: 'سنتر الأفضل',
    area: 'مؤسسة الزكاة — المرج / عين شمس',
    address: 'شارع مؤسسة الزكاة الرئيسي',
    schedule: [
      {
        grade: 'الصف الأول الثانوي',
        day: 'الخميس',
        time: '٥:٠٠ مساءً',
        subject: 'تاريخ — تأسيس ونواتج التعلم',
      },
      {
        grade: 'الصف الثاني الثانوي',
        day: 'الخميس',
        time: '٧:٠٠ مساءً',
        subject: 'تاريخ — شرح وتحليل بنك الأسئلة',
      },
    ],
  },
  {
    name: 'سنتر شيماء الزهراء التعليمي',
    area: 'مدينة نصر / زهراء مدينة نصر',
    address: 'أمام مدرسة مودرن سكول الزهراء، أعلى مسجد نور الإسلام',
    schedule: [
      {
        grade: 'الصف الثالث الثانوي (ثانوية عامة)',
        day: 'السبت',
        time: '٤:٠٠ عصراً',
        subject: 'تاريخ عامة — خرائط الربط ونواتج التعلم الوزارية',
      },
      {
        grade: 'الصف الثاني الثانوي',
        time: 'السبت ٦:٠٠ مساءً | الخميس ٥:٠٠ مساءً',
        subject: 'تاريخ — تدريبات الفهم المتقدم وبنك الأسئلة',
      },
    ],
  },
  {
    name: 'سنتر الحرية',
    area: 'جسر السويس / النزهة',
    address: 'أول شارع الحرية من جسر السويس، خلف محطة مترو النزهة، أعلى مسجد عبد الله بن مسعود',
    schedule: [
      {
        grade: 'الصف الثالث الثانوي (ثانوية عامة)',
        day: 'الثلاثاء',
        time: '٥:٠٠ مساءً',
        subject: 'تاريخ عامة — شرح تفصيلي وتطبيقات المستويات العليا',
      },
      {
        grade: 'الصف الأول الثانوي',
        day: 'الثلاثاء',
        time: '٧:٠٠ مساءً',
        subject: 'تاريخ — تأسيس وامتحانات تقييم أسبوعية',
      },
    ],
  },
  {
    name: 'سنتر الشمس التعليمي',
    area: 'جسر السويس — محطة مترو نادي الشمس',
    address: 'شارع الوحدة العربية، متفرع من جسر السويس',
    schedule: [
      {
        grade: 'الصف الثالث الثانوي (ثانوية عامة)',
        day: 'الأربعاء',
        time: '٤:٣٠ عصراً',
        subject: 'تاريخ — مراجعات جزئية وشاملة وتأهيل امتحانات الجمهورية',
      },
      {
        grade: 'الصف الثاني الثانوي',
        day: 'الأربعاء',
        time: '٦:٣٠ مساءً',
        subject: 'تاريخ — شرح وتحليل نواتج التعلم المتقدمة',
      },
    ],
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf8f0] via-[#f7f2e4] to-[#eee2c6] dark:from-[#030712] dark:via-[#05131f] dark:to-[#081726] text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      {/* --- الهيدر الملكي الفخم لصفحة تواصل معنا — بالعرض الكامل مثل باقي صفحات الموقع --- */}
      <section className="relative overflow-hidden min-h-[520px] sm:min-h-[580px] lg:min-h-[640px] xl:min-h-[680px] flex items-center bg-[#070e1a] text-ivory-50 py-16 sm:py-20 lg:py-24 border-b border-gold-500/20">
        {/* خلفية صالون النهضة التاريخي ومستر عمرو محروس بالبدلة الأنيقة على اليسار — مقاس بانورامي 4K فائق الدقة (ديسكتوب وتابلت فقط >= md) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          <Image
            src="/images/contact-hero-banner.jpg"
            alt={`${platformConfig.teacher.displayName} في ${platformConfig.brand.platformName}`}
            fill
            priority
            unoptimized
            className="object-cover object-[left_70%] sm:object-[left_65%] lg:object-[left_65%]"
          />
        </div>

        {/* دمج ناعم وسلس يضمن وضوح النصوص في اليمين مع إبقاء مستر عمرو وصالون القصر التاريخي بوضوح فائق في اليسار */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block bg-[linear-gradient(to_top,#070e1a_0%,rgb(7_14_26/0.75)_50%,rgb(7_14_26/0.15)_100%)] sm:bg-[linear-gradient(to_left,#070e1a_0%,#070e1a_20%,rgb(7_14_26/0.85)_35%,rgb(7_14_26/0.3)_55%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf8f0] dark:from-[#030712] via-transparent to-transparent"
        />

        <div className="container-page relative z-10 w-full">
          <Reveal variants={fadeUp}>
            <div className="max-w-2xl sm:mr-auto lg:mr-0 ml-auto text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/15 px-4 py-1.5 text-xs font-black text-gold-300 mb-4 shadow-sm backdrop-blur-xs">
                <span className="text-gold-400 text-sm">🏛️</span>
                عصر النهضة والتاريخ الحديث — قنوات التواصل والإرشاد المعتمدة
              </span>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ivory-50 leading-tight">
                تواصل مع <span className="text-gradient-gold">فريق {platformConfig.teacher.displayName}</span>
              </h1>

              <p className="mt-4 text-base sm:text-lg leading-relaxed text-ivory-200/90 font-medium max-w-xl">
                موجودين لمساعدتك في كل خطوة؛ سواء كنت محتاج دعم فني، استفسار عن الكورسات، تأكيد اشتراك، أو معرفة مواعيد السناتر ومتابعة مستوى الطالب الدراسي.
              </p>

              {/* شريط تميز خدمة الطلاب على الهاتف (< md) */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gold-500/30 bg-[#071322]/90 p-3 shadow-lg backdrop-blur-md md:hidden">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gold-500/50 shadow-md">
                  <Image
                    src="/images/eras/modern-portrait.jpg"
                    alt={platformConfig.teacher.displayName}
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-black text-ivory-50 truncate">
                    فريق دعم {platformConfig.teacher.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-400 font-bold truncate">
                    متاحون للرد على استفساراتكم ومساعدتكم
                  </p>
                </div>
              </div>

              {/* أوسمة خدمة الطلاب */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-200 backdrop-blur-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>استجابة ومتابعة سريعة</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-200 backdrop-blur-xs">
                  <span>⭐</span>
                  <span>فريق دعم أكاديمي وتقني متكامل</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-200 backdrop-blur-xs">
                  <span>📍</span>
                  <span>تواجد ميداني في ٤ سناتر كبرى</span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- محتوى الصفحة وقنوات التواصل --- */}
      <div className="container-page py-12 sm:py-20">
        {/* Contact Channels Grid */}
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <RoyalCartouche variant="gold">
              <span className="text-xs font-bold tracking-wider">قنوات التواصل المباشرة</span>
            </RoyalCartouche>
            <h2 className="mt-4 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
              طرق التواصل الرسمية المعتمدة
            </h2>
            <p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/75">
              اختر القناة المناسبة لاستفسارك لتحصل على أسرع استجابة من فريق العمل.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {CHANNELS.map((ch, idx) => (
              <Reveal key={ch.title} variants={fadeUp} delay={idx * 0.08}>
                <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gold-500/25 bg-white/85 dark:bg-[#071322]/85 backdrop-blur-md p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(200,149,42,0.18)]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold-500/15 text-gold-600 dark:text-gold-400 border border-gold-500/20 shadow-xs">
                        {ch.icon}
                      </span>
                      {ch.badge && (
                        <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-700 dark:text-gold-300">
                          {ch.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 font-display text-base font-black text-midnight-950 dark:text-ivory-50">
                      {ch.title}
                    </h3>
                    <p className="mt-1 font-mono text-lg font-bold text-gold-600 dark:text-gold-400" dir="ltr">
                      {ch.value}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-midnight-600 dark:text-ivory-300/80">
                      {ch.hint}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gold-500/15">
                    <a
                      href={ch.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-midnight-950 hover:brightness-110 px-4 py-2.5 text-xs font-black shadow-sm transition-all"
                    >
                      <span>{ch.btnText}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* أماكن التواجد وجداول السناتر المعتمدة — عرض كامل بديل للكاردين وبدون سلايدر وبدون شارات */}
        <div className="mx-auto mt-16 max-w-5xl w-full">
          <Reveal variants={fadeUp}>
            <div className="relative rounded-3xl border border-gold-500/35 bg-white/90 dark:bg-[#071322]/90 backdrop-blur-md p-6 sm:p-9 shadow-card overflow-hidden">
              <HieroglyphCorner position="top-left" />
              <HieroglyphCorner position="top-right" />
              <HieroglyphCorner position="bottom-left" />
              <HieroglyphCorner position="bottom-right" />

              <div className="flex items-center gap-3.5 pb-6 border-b border-gold-500/20">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-gold-500/25 to-amber-500/10 text-gold-500 dark:text-gold-400 border border-gold-500/30 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-black text-midnight-950 dark:text-ivory-50">
                    أماكن التواجد وجداول السناتر
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-midnight-600 dark:text-ivory-300/80">
                    الحصص المباشرة لـ{platformConfig.teacher.displayName} في كبرى السناتر التعليمية
                  </p>
                </div>
              </div>

              {/* شبكة السناتر كاملة بدون سلايدر — 4 سناتر معروضة بالتفصيل معاً في شبكة متناسقة */}
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {CENTERS.map((center, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-gold-500/25 bg-[#faf5e8]/70 dark:bg-[#040c17]/70 p-5 sm:p-6 transition-all duration-300 hover:border-gold-500/50 hover:bg-gold-500/5 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div>
                      <h4 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
                        {center.name}
                      </h4>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-midnight-700 dark:text-ivory-200">
                        <span className="text-gold-500 text-sm">📍</span>
                        <span>{center.area}</span>
                      </p>
                      <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-400/70 leading-relaxed">
                        {center.address}
                      </p>

                      {/* قائمة الحصص والمواعيد المحددة بدقة لكل صف */}
                      <div className="mt-5 space-y-2.5 border-t border-gold-500/15 pt-4">
                        {center.schedule.map((item, sIdx) => (
                          <div
                            key={sIdx}
                            className="rounded-xl border border-ivory-200/90 dark:border-midnight-800/90 bg-white/90 dark:bg-midnight-900/90 p-3 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-midnight-950 dark:text-ivory-50">
                                <span className="text-gold-500 text-sm">🎓</span>
                                {item.grade}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-gold-500/15 border border-gold-500/30 px-2.5 py-1 text-xs font-black text-gold-700 dark:text-gold-300">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 6v6l4 2" />
                                </svg>
                                {item.day ? `${item.day} — ${item.time}` : item.time}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-midnight-600 dark:text-ivory-300/80 pr-5 leading-normal">
                              {item.subject}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

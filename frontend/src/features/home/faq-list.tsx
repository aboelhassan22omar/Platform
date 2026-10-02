'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_ENTRANCE } from '@/lib/motion';

const FAQS = [
  {
    q: 'إزاي أبدأ على المنصة؟',
    a: 'اعمل حساب، اختار نظامك التعليمي وصفك الدراسي، وهتلاقي كل كورسات صفك. في حصص مجانية في كل صف تقدر تجربها قبل ما تدفع أي حاجة.',
  },
  {
    q: 'أقدر أشتري حصة واحدة بس؟',
    a: 'أيوه. تقدر تشتري الحصة اللي محتاجها لوحدها، أو تشتري باقة الفصل، أو تشترك بالشهر أو بالسنة وتفتح كل حصص الصف.',
  },
  {
    q: 'الحصة اللي اشتريتها بتفضل معايا لحد إمتى؟',
    a: 'الحصة اللي بتشتريها لوحدها بتفضل متاحة ليك من غير تاريخ انتهاء. أما الاشتراك الشهري أو السنوي فبيديك وصول طول مدة الاشتراك بس.',
  },
  {
    q: 'أقدر أتفرج من أكتر من جهاز؟',
    a: 'أيوه، تقدر تفتح حسابك من الموبايل واللابتوب، والمنصة بتفتكر آخر مكان وقفت عنده في كل حصة. بس الحساب شخصي وممنوع تشاركه مع حد تاني.',
  },
  {
    q: 'نسيت كلمة السر، أعمل إيه؟',
    a: 'من صفحة تسجيل الدخول اضغط على "نسيت كلمة السر؟" واتبع الخطوات باستخدام رقم موبايلك المسجل.',
  },
  {
    q: 'أقدر أغيّر صفي الدراسي؟',
    a: 'تغيير الصف بيأثر على المحتوى المتاح ليك، عشان كده بيتم من خلال الدعم مش من الملف الشخصي. تواصل معانا وهنساعدك.',
  },
  {
    q: 'الفيديو مش شغال عندي، إيه الحل؟',
    a: 'جرّب تحدّث الصفحة الأول — رابط المشاهدة بينتهي بعد فترة قصيرة لأسباب أمنية. لو المشكلة استمرت، جرّب متصفح تاني أو كلّم الدعم.',
  },
];

export function FaqList() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04, duration: 0.4, ease: EASE_ENTRANCE }}
              className="overflow-hidden rounded-2xl border border-ivory-300 dark:border-gold-500/20 bg-white dark:bg-midnight-900 shadow-sm"
            >
              <h2>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${index}`}
                  className="flex w-full items-center gap-4 p-5 text-start transition-colors hover:bg-ivory-50 dark:hover:bg-midnight-800/60"
                >
                  <span className="flex-1 font-display text-base font-bold text-midnight-900 dark:text-ivory-50">
                    {faq.q}
                  </span>
                  <motion.span
                    aria-hidden
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.22 }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold-50 dark:bg-gold-500/15 text-gold-600 dark:text-gold-400"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 3.5v9M3.5 8h9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.span>
                </button>
              </h2>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-panel-${index}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE_ENTRANCE }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-ivory-200 dark:border-midnight-800 px-5 py-4 leading-relaxed text-midnight-600 dark:text-ivory-300/85">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

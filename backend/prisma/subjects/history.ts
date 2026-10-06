/**
 * ============================================================================
 * CURRICULUM SEED DATA — منهج التاريخ
 * ============================================================================
 *
 * This file is DATA, not application logic. Nothing in src/ hardcodes a course
 * or lesson title; the admin dashboard is the long-term source of truth and
 * can edit everything seeded here without a redeploy.
 *
 * SOURCING AND ACCURACY
 * ---------------------
 * Unit and lesson titles below were compiled in September 2026 from Egyptian
 * education-press coverage of the 2026/2027 curriculum and from published
 * curriculum-distribution (توزيع المنهج) summaries. They were NOT taken from a
 * machine-readable Ministry of Education source, because none was accessible.
 *
 * Each course therefore carries an `isProvisional` flag:
 *
 *   isProvisional: false — structure corroborated by more than one published
 *                          source and stable across them.
 *   isProvisional: true  — partially reconstructed, or the official breakdown
 *                          was not published in enough detail to confirm every
 *                          lesson title. The admin UI shows a warning badge on
 *                          these so they are reviewed before going live.
 *
 * BEFORE LAUNCH: Mr Amr Mahrous (or the content manager) must review every
 * course marked provisional against the official printed curriculum and
 * correct it from the dashboard.
 *
 * Prices are placeholders in piastres (قرش). 1 EGP = 100 piastres.
 * They exist so the commerce flow is exercisable end-to-end; the real price
 * list is a commercial decision for the teacher and is set from the dashboard.
 * ============================================================================
 */

import type { SeedUnit, SeedCourse, GradeKey } from '../curriculum-types';

// ---------------------------------------------------------------------------
// الصف الأول الثانوي — حضارة مصر والعالم القديم
//
// The first secondary year is shared between the الثانوية العامة and
// البكالوريا pathways: published 2026/2027 curriculum distributions list it as
// "عام وبكالوريا" with no divergence. It is seeded for both grades, but as two
// separate Course rows so the teacher can let them drift apart later.
// ---------------------------------------------------------------------------

const ANCIENT_CIVILISATIONS_UNITS: SeedUnit[] = [
  {
    title: 'الوحدة الأولى: مدخل لدراسة حضارة مصر والعالم القديم',
    description: 'تعريف الحضارة والتاريخ، ومصادر دراستهما، وعوامل قيام الحضارات.',
    chapters: [
      {
        title: 'الفصل الأول: مفاهيم أساسية',
        priceMinor: 9000,
        lessons: [
          {
            title: 'الحضارة والتاريخ',
            description: 'الفرق بين الحضارة والتاريخ، ومفهوم كل منهما.',
            priceMinor: 3500,
            // First lesson of the platform is free so a student can judge the
            // teaching style before paying anything.
            isFreePreview: true,
          },
          {
            title: 'مصادر دراسة الحضارات',
            description: 'المصادر الأثرية والمكتوبة والروايات الشفهية.',
            priceMinor: 3500,
          },
          {
            title: 'عوامل قيام الحضارات',
            description: 'العوامل الجغرافية والبشرية والاقتصادية.',
            priceMinor: 3500,
          },
        ],
      },
    ],
  },
  {
    title: 'الوحدة الثانية: حضارة مصر القديمة (الفرعونية)',
    description: 'ملامح الحضارة المصرية القديمة في جوانبها المختلفة.',
    chapters: [
      {
        title: 'الفصل الأول: ملامح وتاريخ',
        priceMinor: 9000,
        lessons: [
          { title: 'ملامح من تاريخ مصر القديمة', priceMinor: 3500 },
          { title: 'الحياة الاقتصادية', priceMinor: 3500 },
          { title: 'الحياة السياسية والإدارية', priceMinor: 3500 },
        ],
      },
      {
        title: 'الفصل الثاني: المجتمع والفكر',
        priceMinor: 9000,
        lessons: [
          { title: 'الحياة الاجتماعية', priceMinor: 3500 },
          { title: 'الحياة الدينية', priceMinor: 3500 },
          { title: 'الحياة الثقافية والفكرية', priceMinor: 3500 },
        ],
      },
    ],
  },
  {
    title: 'الوحدة الثالثة: حضارات الشرق الأدنى القديم',
    description: 'حضارات وادي الرافدين وبلاد الشام وشبه الجزيرة العربية.',
    chapters: [
      {
        title: 'الفصل الأول: حضارات الشرق الأدنى',
        priceMinor: 9000,
        lessons: [
          { title: 'حضارة وادي الرافدين', priceMinor: 3500 },
          { title: 'حضارات بلاد الشام', priceMinor: 3500 },
          { title: 'حضارة شبه الجزيرة العربية القديمة', priceMinor: 3500 },
        ],
      },
    ],
  },
  {
    title: 'الوحدة الرابعة: حضارة اليونان وحضارة الرومان',
    description: 'الحضارة اليونانية (الإغريقية) والحضارة الرومانية وأثرهما.',
    chapters: [
      {
        title: 'الفصل الأول: الحضارة اليونانية',
        priceMinor: 9000,
        lessons: [
          { title: 'الحضارة اليونانية (الإغريقية)', priceMinor: 3500 },
          { title: 'مظاهر الحضارة اليونانية', priceMinor: 3500 },
        ],
      },
      {
        title: 'الفصل الثاني: الحضارة الرومانية',
        priceMinor: 9000,
        lessons: [
          { title: 'قيام الحضارة الرومانية', priceMinor: 3500 },
          { title: 'مظاهر الحضارة الرومانية', priceMinor: 3500 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Course definitions per grade
// ---------------------------------------------------------------------------

export const HISTORY_CURRICULUM: Record<GradeKey, SeedCourse[]> = {
  // -------------------------------------------------------------------------
  SEC_1: [
    {
      title: 'التاريخ — الصف الأول الثانوي',
      description:
        'رحلة في حضارة مصر والعالم القديم: من مفهوم الحضارة، لمصر الفرعونية، لحضارات الشرق الأدنى، لليونان والرومان.',
      isProvisional: false,
      sourceNote: 'بنية الوحدات مؤكدة من أكثر من مصدر منشور لتوزيع منهج 2026/2027 (عام وبكالوريا).',
      priceMinor: 45000,
      units: ANCIENT_CIVILISATIONS_UNITS,
    },
  ],

  // -------------------------------------------------------------------------
  // Second secondary. Detailed published unit/lesson titles for 2026/2027 were
  // not available at seed time, so this is an outline only.
  SEC_2: [
    {
      title: 'التاريخ — الصف الثاني الثانوي',
      description:
        'التاريخ الأوروبي الحديث وأثره على العالم العربي، وصولاً إلى بدايات التاريخ المصري الحديث.',
      isProvisional: true,
      sourceNote:
        'مسودة أولية: لم يتوفر توزيع رسمي مفصّل لمنهج 2026/2027 وقت الإعداد. يجب مراجعة العناوين من لوحة التحكم قبل النشر.',
      priceMinor: 45000,
      units: [
        {
          title: 'الوحدة الأولى: أوروبا في مطلع العصر الحديث',
          description: 'مسودة — تحتاج مراجعة مقابل الكتاب الرسمي.',
          chapters: [
            {
              title: 'الفصل الأول: ملامح عامة',
              priceMinor: 9000,
              lessons: [
                { title: 'أوروبا قبل العصر الحديث', priceMinor: 3500, isFreePreview: true },
                { title: 'حركة الكشوف الجغرافية', priceMinor: 3500 },
                { title: 'عصر النهضة الأوروبية', priceMinor: 3500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الثانية: العالم العربي والدولة العثمانية',
          description: 'مسودة — تحتاج مراجعة مقابل الكتاب الرسمي.',
          chapters: [
            {
              title: 'الفصل الأول: مصر تحت الحكم العثماني',
              priceMinor: 9000,
              lessons: [
                { title: 'قيام الدولة العثمانية', priceMinor: 3500 },
                { title: 'مصر ولاية عثمانية', priceMinor: 3500 },
                { title: 'الأوضاع الاقتصادية والاجتماعية', priceMinor: 3500 },
              ],
            },
          ],
        },
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Third secondary — the exam year. History is taken by the literary
  // section (الشعبة الأدبية) only.
  SEC_3: [
    {
      title: 'التاريخ — الصف الثالث الثانوي',
      description:
        'تاريخ مصر الحديث والمعاصر: من الحملة الفرنسية وبناء الدولة الحديثة، إلى الكفاح الوطني وثورتي 1919 و1952.',
      isProvisional: true,
      sourceNote:
        'الوحدة الأولى (الحملة الفرنسية) مؤكدة من مصادر منشورة؛ باقي الوحدات مسودة تحتاج مراجعة مقابل الكتاب الرسمي 2027.',
      priceMinor: 60000,
      units: [
        {
          title: 'الوحدة الأولى: الحملة الفرنسية على مصر والشام',
          description: 'ظروف الحملة ووصولها وأثرها على مصر.',
          chapters: [
            {
              title: 'الفصل الأول: الحملة الفرنسية',
              priceMinor: 12000,
              lessons: [
                {
                  title: 'الظروف التي سبقت الحملة الفرنسية',
                  priceMinor: 4500,
                  isFreePreview: true,
                },
                { title: 'وصول الحملة الفرنسية إلى مصر', priceMinor: 4500 },
                { title: 'أثر الحملة الفرنسية على مصر', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الثانية: بناء الدولة المصرية الحديثة',
          description: 'مسودة — تحتاج مراجعة مقابل الكتاب الرسمي.',
          chapters: [
            {
              title: 'الفصل الأول: محمد علي ومشروع الدولة',
              priceMinor: 12000,
              lessons: [
                { title: 'تولي محمد علي حكم مصر', priceMinor: 4500 },
                { title: 'الإصلاحات الداخلية', priceMinor: 4500 },
                { title: 'السياسة الخارجية والتوسع', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الثالثة: الكفاح الوطني المصري',
          description: 'مسودة — تحتاج مراجعة مقابل الكتاب الرسمي.',
          chapters: [
            {
              title: 'الفصل الأول: من الاحتلال إلى الثورة',
              priceMinor: 12000,
              lessons: [
                { title: 'الاحتلال البريطاني لمصر', priceMinor: 4500 },
                { title: 'الحركة الوطنية وثورة 1919', priceMinor: 4500 },
                { title: 'ثورة 23 يوليو 1952', priceMinor: 4500 },
              ],
            },
          ],
        },
      ],
    },
  ],

  // -------------------------------------------------------------------------
  BACC_1: [
    {
      title: 'التاريخ — الصف الأول (البكالوريا المصرية)',
      description:
        'حضارة مصر والعالم القديم ضمن نظام البكالوريا المصرية، مع التركيز على مهارات التفكير التاريخي والتحليل.',
      isProvisional: false,
      sourceNote:
        'توزيع منهج 2026/2027 المنشور يذكر الصف الأول الثانوي كمنهج مشترك "عام وبكالوريا".',
      priceMinor: 45000,
      units: ANCIENT_CIVILISATIONS_UNITS,
    },
  ],

  // -------------------------------------------------------------------------
  // Second baccalaureate. Press coverage confirms the shape: two parts, six
  // units, four lessons each = 24 lessons, focused on modern Egypt. Two lesson
  // titles were published verbatim; the rest are reconstructed placeholders.
  BACC_2: [
    {
      title: 'التاريخ — الصف الثاني (البكالوريا المصرية)',
      description:
        'تاريخ مصر الحديث والمعاصر وعلاقتها بالعالم: ثورة 23 يوليو والتحولات الكبرى، وصمود الشعب المصري ومقاومة الاحتلال.',
      isProvisional: true,
      sourceNote:
        'البنية مؤكدة (٦ وحدات × ٤ دروس على جزأين) وعنوانا درسين منشوران حرفيًا؛ باقي العناوين مسودة تحتاج مراجعة مقابل كتاب الطالب الرسمي.',
      priceMinor: 60000,
      units: [
        {
          title: 'الوحدة الأولى: مصر في مطلع القرن العشرين',
          description: 'الجزء الأول — مسودة تحتاج مراجعة.',
          chapters: [
            {
              title: 'الفصل الأول: الأوضاع قبل الثورة',
              priceMinor: 12000,
              lessons: [
                { title: 'مصر تحت الاحتلال البريطاني', priceMinor: 4500, isFreePreview: true },
                { title: 'الأوضاع الاقتصادية والاجتماعية', priceMinor: 4500 },
                { title: 'الحركة الوطنية وتطورها', priceMinor: 4500 },
                { title: 'ثورة 1919 ونتائجها', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الثانية: صمود الشعب المصري ومقاومة الاحتلال',
          description: 'الجزء الأول — عنوان الوحدة منشور حرفيًا.',
          chapters: [
            {
              title: 'الفصل الأول: المقاومة الوطنية',
              priceMinor: 12000,
              lessons: [
                { title: 'أشكال المقاومة الشعبية', priceMinor: 4500 },
                { title: 'معاهدة 1936 وما بعدها', priceMinor: 4500 },
                { title: 'حرب فلسطين 1948 وأثرها', priceMinor: 4500 },
                { title: 'الكفاح المسلح في القناة', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الثالثة: ثورة 23 يوليو والتحولات الكبرى في مصر',
          description: 'الجزء الأول — عنوان الوحدة منشور حرفيًا.',
          chapters: [
            {
              title: 'الفصل الأول: الثورة وتحولاتها',
              priceMinor: 12000,
              lessons: [
                { title: 'قيام ثورة 23 يوليو 1952', priceMinor: 4500 },
                { title: 'مبادئ الثورة وأهدافها', priceMinor: 4500 },
                { title: 'الإصلاح الزراعي والتحول الاقتصادي', priceMinor: 4500 },
                { title: 'جلاء الاحتلال البريطاني', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الرابعة: مصر والعالم العربي',
          description: 'الجزء الثاني — مسودة تحتاج مراجعة.',
          chapters: [
            {
              title: 'الفصل الأول: الدور الإقليمي',
              priceMinor: 12000,
              lessons: [
                { title: 'تأميم قناة السويس', priceMinor: 4500 },
                { title: 'العدوان الثلاثي 1956', priceMinor: 4500 },
                { title: 'الوحدة المصرية السورية', priceMinor: 4500 },
                { title: 'مصر وحركات التحرر العربية', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة الخامسة: من النكسة إلى النصر',
          description: 'الجزء الثاني — مسودة تحتاج مراجعة.',
          chapters: [
            {
              title: 'الفصل الأول: 1967 إلى 1973',
              priceMinor: 12000,
              lessons: [
                { title: 'نكسة 1967 وأسبابها', priceMinor: 4500 },
                { title: 'حرب الاستنزاف', priceMinor: 4500 },
                { title: 'نصر أكتوبر 1973', priceMinor: 4500 },
                { title: 'نتائج حرب أكتوبر', priceMinor: 4500 },
              ],
            },
          ],
        },
        {
          title: 'الوحدة السادسة: مصر المعاصرة',
          description: 'الجزء الثاني — مسودة تحتاج مراجعة.',
          chapters: [
            {
              title: 'الفصل الأول: مصر الحديثة',
              priceMinor: 12000,
              lessons: [
                { title: 'مصر بعد حرب أكتوبر', priceMinor: 4500 },
                { title: 'التحولات الاقتصادية المعاصرة', priceMinor: 4500 },
                { title: 'مصر ودورها الدولي', priceMinor: 4500 },
                { title: 'تحديات مصر المعاصرة', priceMinor: 4500 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Grade definitions
//
// `themeKey` selects one of the five visual identities in the frontend theme
// registry (frontend/src/themes). Each is designed around what that grade
// actually studies — see the notes in the registry.
// ---------------------------------------------------------------------------

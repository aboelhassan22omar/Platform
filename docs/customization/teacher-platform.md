# تخصيص المنصة لمدرس أو مادة جديدة

الهدف أن تظل وظائف المنصة (الحسابات، المحتوى، الفيديو، الدفع، الاختبارات،
والصلاحيات) مستقلة عن هوية المدرس والمادة.

## تغيير سريع بدون تعديل الكود

1. انسخ `.env.example` إلى `.env`.
2. غيّر مجموعة `Platform identity` فقط.
3. ضع ملفات الشعار والصور داخل `frontend/public/brand` أو استخدم مسارات عامة.
4. أعد بناء الواجهة: `docker compose build frontend`.
5. شغّلها: `docker compose up -d frontend`.

مثال الكيمياء:

```env
PLATFORM_NAME=منصة مستر أحمد التعليمية
TEACHER_NAME=مستر أحمد
SUBJECT_KEY=chemistry
SUBJECT_NAME=الكيمياء
NEXT_PUBLIC_PLATFORM_NAME=منصة مستر أحمد التعليمية
NEXT_PUBLIC_PLATFORM_SHORT_NAME=منصة مستر أحمد
NEXT_PUBLIC_TEACHER_NAME=مستر أحمد
NEXT_PUBLIC_TEACHER_SHORT_NAME=أحمد
NEXT_PUBLIC_TEACHER_TAGLINE=الكيمياء ببساطة
NEXT_PUBLIC_SUBJECT_KEY=chemistry
NEXT_PUBLIC_SUBJECT_NAME=الكيمياء
NEXT_PUBLIC_SUBJECT_ADJECTIVE=الكيميائية
NEXT_PUBLIC_LOGO_LIGHT=/brand/chemistry-logo-light.png
NEXT_PUBLIC_LOGO_DARK=/brand/chemistry-logo-dark.png
```

## حدود الوحدات

- `frontend/src/config`: هوية النسخة، التنقل، وإعدادات العرض العامة.
- `frontend/src/components`: مكونات عامة لا تعرف مادة أو مدرسًا بعينه.
- `frontend/src/features`: منطق وواجهات كل ميزة مستقلة.
- `frontend/src/app`: تركيب الصفحات والتوجيه فقط؛ لا يوضع منطق أعمال كبير هنا.
- `backend/src/config`: إعدادات الخادم وهوية النسخة.
- وحدات backend (`auth`, `payments`, `courses`, ...): كل وحدة تملك controller/service/DTOs الخاصة بها.
- `backend/prisma`: مخطط البيانات وبيانات المناهج الأولية فقط.

## قاعدة مهمة

أي قيمة تتغير بين مدرس وآخر لا تكتب داخل JSX أو service. إن كانت هوية عامة توضع
في `platform.config`; وإن كانت محتوى دراسيًا توضع في قاعدة البيانات أو ملفات seed؛
وإن كانت سرًا توضع في متغير بيئة غير عام.

## قائمة فحص نسخة جديدة

- الاسم، المادة، الوصف، الشعار، وروابط التواصل.
- ألوان وصور المادة والثيمات الخاصة بالصفوف.
- بيانات المناهج والباقات والأسعار.
- الصفحات القانونية وبيانات جهة التحكم في البيانات.
- مفاتيح الدفع والتخزين والرسائل في بيئة الإنتاج.
- تشغيل build وunit tests وE2E على الهاتف وسطح المكتب.

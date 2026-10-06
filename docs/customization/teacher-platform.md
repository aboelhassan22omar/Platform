# تخصيص المنصة لمدرس أو مادة جديدة

هوية المنصة مستقلة عن الحسابات والمحتوى والدفع واللايف. التاريخ هو الإعداد الافتراضي؛ الكيمياء والأحياء والفيزياء لها نصوص وصور وألوان مستقلة. استخدم `custom` لمادة أخرى.

## تغيير الهوية

من جذر المشروع، اعرض الإعدادات أولًا:

```powershell
npm run platform:configure -- --subject chemistry --teacher "مستر أحمد"
```

لحفظها في `.env`:

```powershell
npm run platform:configure -- --subject chemistry --teacher "مستر أحمد" --write
docker compose up -d --no-deps --build backend frontend
docker compose exec -T proxy nginx -s reload
```

الأمر يحدّث إعدادات الهوية في الخادم والواجهة معًا، ويستبدل النصوص والشعار والصور الافتراضية بما يناسب المادة. يحافظ على إعدادات قاعدة البيانات والدفع والواتساب والتخزين. بدون `--write` يعرض القيم فقط.

خيارات إضافية:

```powershell
npm run platform:configure -- --subject custom --subject-name "الجيولوجيا" --teacher "دكتور أحمد" --short-name "أحمد" --logo /brand/my-logo.svg --image /brand/my-portrait.webp --env-file .env --write
```

ضع الصور في `frontend/public/brand` ثم استخدم مسارها العام. راجع روابط وأرقام التواصل في `NEXT_PUBLIC_*` عند تجهيز نسخة لمدرس آخر. متغيرات الواجهة تُقرأ أثناء البناء؛ تغيير `.env` يحتاج إعادة بناء الواجهة.

## المحتوى والبيانات

تغيير الهوية لا يحوّل دروس التاريخ الموجودة في قاعدة البيانات إلى كيمياء. للمنصة الجديدة استخدم قاعدة بيانات مستقلة، وأضف منهجها من لوحة التحكم. بيانات seed للتاريخ محفوظة في `backend/prisma/subjects/history.ts`. المواد الأخرى تبدأ بالصفوف الخمسة دون إنشاء دروس تاريخ أو اختراع منهج جديد.

منتجات المتجر الأولية تتبع المادة المختارة. المتجر الحالي يعمل داخل المتصفح حسب نطاق العرض المطلوب، ولا يحفظ طلبات أو مدفوعات فعلية على الخادم. لكل مادة ومدرس مساحة تخزين مستقلة؛ تفاصيل الطلبات تبقى في جلسة التبويب. راجع [المتجر](../store-demo.md).

## أماكن التعديل

| التعديل                               | المكان                                              |
| ------------------------------------- | --------------------------------------------------- |
| الأسماء والشعارات والصور الافتراضية   | `frontend/src/config/platform-identity.ts`          |
| إعدادات البيئة العامة وروابط التواصل  | `frontend/src/config/platform.config.ts`            |
| نصوص الرئيسية وفوائد كل مادة وألوانها | `frontend/src/config/subject-profile.ts`            |
| الصفوف الدراسية                       | `frontend/src/config/academic-levels.ts`            |
| صور وثيمات التاريخ                    | `frontend/src/themes/presets/history.ts`            |
| اختيار ثيم المادة                     | `frontend/src/themes/registry.ts`                   |
| هوية الخادم                           | `backend/src/config/platform-identity.ts`           |
| قواعد المتجر والعربة والطلبات         | `frontend/src/features/store/store-model.ts`        |
| خدمات إدارة المحتوى                   | `backend/src/admin/content`                         |
| معالجة الفيديو                        | `workers/src/media` و`workers/src/process-video.ts` |

## التحقق قبل التسليم

```powershell
npm run check
npm run format:check
npm run audit:source
npm --workspace tests/e2e test -- specs/store-demo.spec.ts --project=desktop-chrome --project=mobile-360
```

`audit:source` يكشف الملفات التي لا تصل إليها نقاط تشغيل المصدر؛ نتيجته تحتاج مراجعة قبل الحذف، خصوصًا الملفات التي يقرأها النظام بالاسم أثناء التشغيل. لا يشمل الملفات المولّدة من Prisma أو Next.js.

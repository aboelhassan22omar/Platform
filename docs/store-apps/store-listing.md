# بيانات صفحة التطبيق في المتجرين

انسخ النصوص دي زي ما هي. ممنوع أي كلام عن الأسعار أو الاشتراك أو الدفع أو «اشترك من الموقع» في وصف التطبيق، لأن Apple وGoogle بيرفضوا بسببه.

---

## المعلومات الأساسية

| الحقل                               | القيمة                                 |
| ----------------------------------- | -------------------------------------- |
| اسم التطبيق (حد أقصى ٣٠ حرف)        | منصة مستر X                            |
| العنوان الفرعي، Apple بس (٣٠ حرف)   | حصص وامتحانات ومتابعة                  |
| الفئة                               | التعليم (Education)                    |
| الفئة الثانوية، Apple               | مرجع (Reference)                       |
| رابط الدعم (Support URL)            | https://mr.x.aurexis.cc/contact        |
| سياسة الخصوصية (Privacy Policy URL) | https://mr.x.aurexis.cc/privacy        |
| رابط حذف الحساب، Google             | https://mr.x.aurexis.cc/delete-account |
| الموقع (Marketing URL)              | https://mr.x.aurexis.cc                |
| السعر                               | مجاني                                  |
| حقوق النشر، Apple (Copyright)       | ‎© 2026 منصة مستر X                   |

## الوصف المختصر، Google (حد أقصى ٨٠ حرف)

```
حصص مستر X وامتحاناته ومتابعتك في مكان واحد، وشوف حصصك حتى من غير نت.
```

## الوصف الكامل (للمتجرين)

```
التطبيق الرسمي لمنصة مستر X التعليمية لطلاب الثانوية العامة والبكالوريا المصرية.

كل حاجة محتاجها في مذاكرتك في مكان واحد:

• حصص فيديو منظمة بنفس ترتيب المنهج: وحدات وفصول وحصص، والتطبيق بيفتكر إنت وقفت فين في كل حصة.
• نزّل حصصك على موبايلك واتفرج عليها في «مكتبتي» حتى لو مفيش نت.
• واجبات وامتحانات إلكترونية بتتصحح على طول، ومراجعة لكل سؤال بعد الحل.
• اسأل تحت أي حصة، ويوصلك إشعار أول ما المستر أو فريقه يرد.
• إشعارات بالحصص الجديدة ومواعيد اللايف والامتحانات.
• كارنيه حضور بكود QR لطلاب السنتر.
• لوحة المتصدرين وشهادات تقدير للمتفوقين.
• حصص مجانية في كل صف تقدر تتفرج عليها على طول.

التطبيق لطلاب منصة مستر X. سجّل دخولك بنفس حسابك على المنصة، أو اعمل حساب جديد في دقيقة.
```

## الكلمات المفتاحية، Apple (حد أقصى ١٠٠ حرف، مفصولة بفواصل من غير مسافات)

```
ثانوية عامة,بكالوريا,تاريخ,مستر X,حصص,امتحانات,مذاكرة,منصة تعليمية,دروس,تعليم
```

## نص «ما الجديد» لأول نسخة

```
أول نسخة من تطبيق المنصة: الحصص والامتحانات والإشعارات وتنزيل الحصص للمشاهدة من غير نت.
```

---

## الصور المطلوبة (جاهزة في `mobile/store/`)

| المتجر | المطلوب                                          | الملفات                                        |
| ------ | ------------------------------------------------ | ---------------------------------------------- |
| Apple  | لقطات آيفون 6.9 بوصة (1320×2868)، من ٣ لـ ١٠ صور | `mobile/store/app-store/*.png`                 |
| Google | لقطات موبايل (1080×1920)، من ٢ لـ ٨ صور          | `mobile/store/google-play/screenshots/*.png`   |
| Google | أيقونة 512×512                                   | `mobile/store/google-play/icon-512.png`        |
| Google | صورة الواجهة (Feature graphic) 1024×500          | `mobile/store/google-play/feature-graphic.png` |

أيقونة Apple بتتاخد من التطبيق نفسه تلقائيًا.

---

## Apple: App Privacy (خصوصية التطبيق)

**Do you or your third-party partners collect data from this app?** ← **Yes**

اختار الأنواع دي بس. وفي كل نوع: **Used for: App Functionality**، و**Linked to the user: Yes**، و**Used for tracking: No**:

- Contact Info ← **Name**
- Contact Info ← **Phone Number**
- Identifiers ← **User ID**
- Identifiers ← **Device ID** (رمز الإشعارات)
- User Content ← **Other User Content** (الأسئلة تحت الحصص وإجابات الامتحانات)
- Usage Data ← **Product Interaction** (مدة مشاهدة الحصص للمتابعة وتقرير ولي الأمر)

**Tracking:** No (مفيش تتبّع ولا إعلانات).

## Google: Data safety (أمان البيانات)

- **Does your app collect or share any of the required user data types?** ← Yes
- **Is all of the user data collected by your app encrypted in transit?** ← Yes
- **Do you provide a way for users to request that their data is deleted?** ← Yes
  - من التطبيق، والرابط: https://mr.x.aurexis.cc/delete-account
- البيانات اللي بنجمعها، **Collected** بس، و**Shared: No**:

| النوع                                       | ليه                                   | اختياري؟ |
| ------------------------------------------- | ------------------------------------- | -------- |
| Personal info ← Name                        | App functionality, Account management | لأ       |
| Personal info ← Phone number                | App functionality, Account management | لأ       |
| Personal info ← User IDs                    | App functionality, Account management | لأ       |
| App activity ← App interactions             | App functionality, Analytics          | لأ       |
| App activity ← Other user-generated content | App functionality                     | أيوه     |
| Device or other IDs                         | App functionality (الإشعارات)         | أيوه     |

- **Is data processed ephemerally?** ← No
- **Advertising ID:** التطبيق مش بيستخدمه (اتشال من التطبيق).

## Google: باقي الأسئلة

| السؤال                | الإجابة                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ads                   | No, my app does not contain ads                                                                                                                                                                  |
| Target audience       | 13–15، و16–17، و18 وأكبر (**متختارش أقل من ١٣**)                                                                                                                                                 |
| Appeal to children    | No                                                                                                                                                                                               |
| Content rating (IARC) | Category: Reference, News, or Educational. وكل الأسئلة No، لأن مفيش عنف ولا محتوى للكبار. التفاعل بين المستخدمين: الأسئلة تحت الحصص بتتراجع من فريق المستر ← Yes, users can interact، مع الإشراف |
| News app              | No                                                                                                                                                                                               |
| Government app        | No                                                                                                                                                                                               |
| Financial features    | My app doesn't provide any financial features                                                                                                                                                    |

## Apple: باقي الأسئلة

| السؤال             | الإجابة                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| Age Rating         | كل حاجة None ← النتيجة 4+                                              |
| Export compliance  | اتجاوب في التطبيق نفسه (ITSAppUsesNonExemptEncryption = NO) ومش هيتسأل |
| Content Rights     | No, it does not contain, show, or access third-party content           |
| Sign in with Apple | مش مطلوب، لأننا مش بنستخدم تسجيل دخول بجوجل أو فيسبوك                  |

---

## بيانات الحساب التجريبي

**Apple (App Review Information) / Google (App access ← All or some functionality is restricted):**

- Username: `appreview` (أو اللي عملته في الخطوة ٧)
- Password: (الباسورد)

### ملاحظات للمراجع، Apple (انسخها بالإنجليزي)

```
This is the official app of Mr X's education platform for Egyptian secondary-school students.
Students sign in with the account they use on the platform. The demo account above already has lessons, homework and exams unlocked.

What to try:
1. Sign in with the demo account.
2. Open any course and play a lesson video.
3. Tap "نزّل الحصة وشوفها من غير نت" under the video to save it on the device, then turn on Airplane Mode and open "مكتبتي" (My library) to watch it offline.
4. Open "الواجبات والامتحانات" (Homework & exams) and solve an exam; it is graded instantly.
5. Notifications: Profile ("بياناتي") > turn on notifications.
6. Account deletion: Profile ("بياناتي") > scroll to the bottom > "حذف حسابي".

The app does not sell anything: there is no purchase, price or payment anywhere in the app. Access to lessons is managed by the teacher for enrolled students.
The camera is only used by center staff to scan students' attendance QR codes.
```

### ملاحظات للمراجع، Google (App access ← Instructions)

```
Sign in with the username and password above. The account has lessons and exams unlocked. Downloads for offline viewing are under each lesson video; the offline library is "مكتبتي" in the account tabs.
```

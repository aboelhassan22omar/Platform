const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
});
const { createPlatformIdentity } = require('../frontend/src/config/platform-identity.ts');
const { SUBJECT_KEYS } = require('../frontend/src/config/subject.types.ts');

const { values } = parseArgs({
  options: {
    subject: { type: 'string' },
    teacher: { type: 'string' },
    'short-name': { type: 'string' },
    'subject-name': { type: 'string' },
    logo: { type: 'string' },
    image: { type: 'string' },
    write: { type: 'boolean', default: false },
    'env-file': { type: 'string', default: '.env' },
  },
});
if (!values.subject || !SUBJECT_KEYS.includes(values.subject))
  throw new Error(`Choose --subject ${SUBJECT_KEYS.join('|')}`);
if (!values.teacher?.trim()) throw new Error('--teacher is required');
const config = createPlatformIdentity({
  subjectKey: values.subject,
  subjectName: values['subject-name'],
  teacherName: values.teacher,
  teacherShortName: values['short-name'],
  logoLight: values.logo,
  logoDark: values.logo,
  teacherImage: values.image,
});
const settings = {
  PLATFORM_NAME: config.brand.platformName,
  TEACHER_NAME: config.teacher.displayName,
  SUBJECT_KEY: config.subject.key,
  SUBJECT_NAME: config.subject.name,
  NEXT_PUBLIC_PLATFORM_NAME: config.brand.platformName,
  NEXT_PUBLIC_PLATFORM_SHORT_NAME: config.brand.shortPlatformName,
  NEXT_PUBLIC_PLATFORM_DESCRIPTION: config.brand.description,
  NEXT_PUBLIC_TEACHER_NAME: config.teacher.displayName,
  NEXT_PUBLIC_TEACHER_SHORT_NAME: config.teacher.shortName,
  NEXT_PUBLIC_TEACHER_TITLE: config.teacher.title,
  NEXT_PUBLIC_TEACHER_TAGLINE: config.teacher.tagline,
  NEXT_PUBLIC_SUBJECT_KEY: config.subject.key,
  NEXT_PUBLIC_SUBJECT_NAME: config.subject.name,
  NEXT_PUBLIC_SUBJECT_ADJECTIVE: config.subject.adjective,
  NEXT_PUBLIC_LOGO_LIGHT: config.brand.logoLight,
  NEXT_PUBLIC_LOGO_DARK: config.brand.logoDark,
  NEXT_PUBLIC_LOGO_ALT: config.brand.logoAlt,
  NEXT_PUBLIC_TEACHER_IMAGE: config.assets.teacher,
  NEXT_PUBLIC_AUTH_BACKGROUND: config.assets.authBackground,
};
if (Object.values(settings).some((value) => /[\r\n]/.test(value)))
  throw new Error('Identity fields must be single-line values');
if (values.write) {
  const target = path.resolve(values['env-file']);
  let contents = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  for (const [key, value] of Object.entries(settings)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    contents = pattern.test(contents)
      ? contents.replace(pattern, () => line)
      : `${contents.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(target, contents.endsWith('\n') ? contents : `${contents}\n`, 'utf8');
  console.log(
    `Updated ${Object.keys(settings).length} public identity fields in ${target}. Payment/database/OTP credentials were preserved.`,
  );
} else {
  console.log('# Preview only. Add --write to update the chosen env file.');
  for (const [key, value] of Object.entries(settings)) console.log(`${key}=${value}`);
}

// Run inside the backend image; JSON content export arrives on stdin.
// Matches existing rows, preserves production IDs and never deletes content.
const { PrismaClient } = require('/app/dist/src/generated/prisma/client');
const { PrismaPg } = require('/app/node_modules/@prisma/adapter-pg');
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (input.version !== 1 || !input.tables) throw Error('Unsupported content export');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const tables = ['academicYear', 'grade', 'course', 'unit', 'chapter', 'lesson', 'attachment', 'videoAsset', 'plan', 'assessment', 'assessmentQuestion', 'assessmentOption', 'product'];
const maps = Object.fromEntries(tables.map(t => [t, new Map()]));
const relations = { course: { gradeId: 'grade', academicYearId: 'academicYear' }, unit: { courseId: 'course' }, chapter: { unitId: 'unit' }, lesson: { chapterId: 'chapter' }, attachment: { lessonId: 'lesson' }, videoAsset: { lessonId: 'lesson' }, plan: { gradeId: 'grade', academicYearId: 'academicYear' }, assessment: { lessonId: 'lesson', unitId: 'unit' }, assessmentQuestion: { assessmentId: 'assessment' }, assessmentOption: { questionId: 'assessmentQuestion' }, product: { lessonId: 'lesson', chapterId: 'chapter', courseId: 'course', planId: 'plan', assessmentId: 'assessment' } };
function match(table, d) {
  switch (table) {
    case 'academicYear': return { label: d.label };
    case 'grade': return { educationSystem: d.educationSystem, level: d.level };
    case 'course': return { gradeId: d.gradeId, slug: d.slug };
    case 'unit': return { courseId: d.courseId, title: d.title };
    case 'chapter': return { unitId: d.unitId, title: d.title };
    case 'lesson': return { chapterId: d.chapterId, slug: d.slug };
    case 'attachment': return { lessonId: d.lessonId, storageKey: d.storageKey };
    case 'videoAsset': return { lessonId: d.lessonId };
    case 'plan': return { gradeId: d.gradeId, academicYearId: d.academicYearId, kind: d.kind, title: d.title };
    case 'assessment': return { lessonId: d.lessonId, unitId: d.unitId, kind: d.kind, title: d.title };
    case 'assessmentQuestion': return { assessmentId: d.assessmentId, sortOrder: d.sortOrder, prompt: d.prompt };
    case 'assessmentOption': return { questionId: d.questionId, sortOrder: d.sortOrder, text: d.text };
    case 'product': {
      const key = Object.keys(relations.product).find(k => d[k]);
      if (!key) throw Error('Product without content target');
      return { [key]: d[key] };
    }
  }
}
async function main() {
  const stats = {};
  await prisma.$transaction(async tx => {
    // Serialize imports; application orders and entitlements remain untouched.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(192746001)`;
    for (const table of tables) {
      stats[table] = { created: 0, updated: 0 };
      for (const source of input.tables[table] || []) {
        const data = { ...source };
        for (const [field, parent] of Object.entries(relations[table] || {})) {
          if (data[field]) {
            const mapped = maps[parent].get(data[field]);
            if (!mapped) throw Error(`Missing ${parent} for ${table}`);
            data[field] = mapped;
          }
        }
        if (table === 'videoAsset' && data.sizeBytes != null) data.sizeBytes = BigInt(data.sizeBytes);
        const existingById = await tx[table].findUnique({ where: { id: data.id } });
        const matches = existingById ? [existingById] : await tx[table].findMany({ where: match(table, data), take: 2 });
        if (matches.length > 1) throw Error(`Ambiguous ${table}: ${source.id}`);
        let saved;
        if (matches[0]) {
          const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...changes } = data;
          saved = await tx[table].update({ where: { id: matches[0].id }, data: changes });
          stats[table].updated++;
        } else {
          saved = await tx[table].create({ data });
          stats[table].created++;
        }
        maps[table].set(source.id, saved.id);
      }
    }
    if (!process.argv.includes('--apply')) throw Object.assign(Error('preview'), { preview: true });
  }, { timeout: 120000, maxWait: 30000 }).catch(e => { if (!e.preview) throw e; });
  console.log(JSON.stringify({ applied: process.argv.includes('--apply'), stats }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

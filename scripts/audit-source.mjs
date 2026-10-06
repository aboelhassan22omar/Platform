import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const scopes = ['frontend/src', 'backend/src', 'backend/prisma', 'workers/src'];
const ignored = new Set(['generated', 'node_modules', '.next', 'dist']);
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
const files = scopes.flatMap((scope) => sourceFiles(path.join(root, scope)));
const edges = new Map();
function resolveImport(file, name) {
  let target;
  if (name.startsWith('.')) target = path.resolve(path.dirname(file), name);
  else if (name.startsWith('@/')) target = path.join(root, 'frontend/src', name.slice(2));
  else if (name.startsWith('src/')) target = path.join(root, 'backend', name);
  else return;
  return [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    path.join(target, 'index.ts'),
    path.join(target, 'index.tsx'),
  ].find((candidate) => files.includes(candidate));
}
for (const file of files) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === 'require') &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  edges.set(file, imports.map((name) => resolveImport(file, name)).filter(Boolean));
}
const entries = files.filter(
  (file) =>
    /frontend[\\/]src[\\/]app[\\/]/.test(file) ||
    /[\\/]main\.ts$|[\\/]transcode\.worker\.ts$|\.spec\.ts$|backend[\\/]prisma[\\/](seed|bootstrap-admin)\.ts$/.test(
      file,
    ),
);
const reached = new Set();
function walk(file) {
  if (reached.has(file)) return;
  reached.add(file);
  for (const child of edges.get(file) || []) walk(child);
}
entries.forEach(walk);
const unused = files.filter((file) => !reached.has(file));
console.log('Source modules not reachable from app, server, worker, seed or test entries:');
unused.forEach((file) => console.log(path.relative(root, file)));
console.log(
  `Reviewed ${files.length} source modules; ${unused.length} require manual review. No files were deleted.`,
);

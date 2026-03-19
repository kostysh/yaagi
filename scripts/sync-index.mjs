#!/usr/bin/env node
/**
 * Regenerates docs/ssot/index.md from Feature Dossier frontmatter.
 * - No external dependencies.
 *
 * Usage:
 *   node scripts/sync-index.mjs
 *   node scripts/sync-index.mjs --dossiers-dir docs/features --index-file docs/ssot/index.md
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_DOSSIERS_DIR = 'docs/features';
const DEFAULT_INDEX_FILE = 'docs/ssot/index.md';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const get = (name, fallback) => {
    const idx = args.indexOf(name);
    if (idx === -1) return fallback;
    const value = args[idx + 1];
    if (!value || value.startsWith('--')) return fallback;
    return value;
  };

  return {
    dossiersDir: get('--dossiers-dir', DEFAULT_DOSSIERS_DIR),
    indexFile: get('--index-file', DEFAULT_INDEX_FILE),
    root: get('--root', process.cwd()),
  };
};

const readText = async (filePath) => fs.readFile(filePath, 'utf8');

const writeTextAtomic = async (filePath, text) => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpFile = `${filePath}.tmp-${Date.now()}`;
  await fs.writeFile(tmpFile, text, 'utf8');
  await fs.rename(tmpFile, filePath);
};

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseYamlValue = (rawValue) => {
  const trimmed = rawValue.trim();
  if (trimmed === '[]') return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((item) => stripQuotes(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return stripQuotes(trimmed);
};

const parseFrontmatter = (markdown) => {
  if (!markdown.startsWith('---')) return null;
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return null;

  const raw = markdown.slice(3, end).trim();
  const lines = raw.split(/\r?\n/);

  /** @type {Record<string, unknown>} */
  const frontmatter = {};
  /** @type {string | null} */
  let currentParent = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indentMatch = line.match(/^(\s+)(.+)$/);
    if (indentMatch && currentParent) {
      const nested = indentMatch[2];
      const keyValue = nested.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!keyValue) continue;
      const key = keyValue[1];
      const value = parseYamlValue(keyValue[2]);
      if (
        typeof frontmatter[currentParent] !== 'object' ||
        frontmatter[currentParent] === null ||
        Array.isArray(frontmatter[currentParent])
      ) {
        frontmatter[currentParent] = {};
      }
      frontmatter[currentParent][key] = value;
      continue;
    }

    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyValue) continue;

    const key = keyValue[1];
    const rawValue = keyValue[2];

    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      currentParent = key;
      frontmatter[key] = {};
      continue;
    }

    currentParent = null;
    frontmatter[key] = parseYamlValue(rawValue);
  }

  return frontmatter;
};

const isDossierFile = (fileName) =>
  /^F-\d{4}-.+\.md$/i.test(fileName) || /^F-\d{4}\.md$/i.test(fileName);

const listDossiers = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isDossierFile)
    .sort();
};

const ensureIndexSkeleton = () => `# SSOT Index

> Single-file navigation source of truth.  
> **Do not duplicate requirements here.** Link to Feature Dossiers instead.

_Last sync: ${new Date().toISOString()}_

## Features

<!-- BEGIN GENERATED FEATURES -->
<!-- END GENERATED FEATURES -->

## Dependency graph

<!-- BEGIN GENERATED DEP_GRAPH -->
<!-- END GENERATED DEP_GRAPH -->

## Red flags

<!-- BEGIN GENERATED RED_FLAGS -->
<!-- END GENERATED RED_FLAGS -->
`;

const replaceBlock = (content, beginMarker, endMarker, block) => {
  const begin = content.indexOf(beginMarker);
  const end = content.indexOf(endMarker);
  if (begin === -1 || end === -1 || end < begin) {
    return `${content.trim()}\n\n${beginMarker}\n${block}\n${endMarker}\n`;
  }

  const before = content.slice(0, begin + beginMarker.length);
  const after = content.slice(end);
  return `${before}\n${block}\n${after}`;
};

const escapePipe = (value) => String(value).replace(/\|/g, '\\|');
const escapeQuotes = (value) => String(value).replace(/"/g, '\\"');

const featureRow = (dossier) => {
  const dependsOn =
    Array.isArray(dossier.depends_on) && dossier.depends_on.length
      ? dossier.depends_on.join(', ')
      : '—';
  const impacts =
    Array.isArray(dossier.impacts) && dossier.impacts.length ? dossier.impacts.join(',') : '—';

  return `| ${dossier.id} | ${escapePipe(dossier.title ?? '')} | ${dossier.status ?? ''} | ${dossier.area ?? ''} | ${dependsOn} | ${impacts} | \`${dossier.__relPath}\` |`;
};

const buildMermaidGraph = (dossiers) => {
  const nodes = dossiers.map((dossier) => {
    const nodeId = dossier.id.replace('-', '');
    const label = `${dossier.id} ${dossier.title ?? ''}`.trim();
    return `  ${nodeId}["${escapeQuotes(label)}"]`;
  });

  const edges = [];
  for (const dossier of dossiers) {
    const from = dossier.id.replace('-', '');
    const dependsOn = Array.isArray(dossier.depends_on) ? dossier.depends_on : [];
    for (const dep of dependsOn) {
      edges.push(`  ${from} --> ${String(dep).replace('-', '')}`);
    }
  }

  return ['```mermaid', 'graph TD', ...nodes, ...edges, '```'].join('\n');
};

const main = async () => {
  const { dossiersDir, indexFile, root } = parseArgs();
  const absDossiersDir = path.resolve(root, dossiersDir);
  const absIndexFile = path.resolve(root, indexFile);

  let dossierFiles = [];
  try {
    dossierFiles = await listDossiers(absDossiersDir);
  } catch (error) {
    console.error(`[sync-index] ERROR: cannot read dossiers directory: ${absDossiersDir}`);
    console.error(error?.stack ?? String(error));
    process.exit(1);
  }

  const dossiers = [];
  for (const fileName of dossierFiles) {
    const absFile = path.join(absDossiersDir, fileName);
    const markdown = await readText(absFile);
    const frontmatter = parseFrontmatter(markdown);
    if (!frontmatter) {
      console.warn(
        `[sync-index] WARN: missing or invalid frontmatter: ${path.join(dossiersDir, fileName)}`,
      );
      continue;
    }

    const relPath = path.relative(path.dirname(absIndexFile), absFile).split(path.sep).join('/');

    dossiers.push({
      ...frontmatter,
      __file: fileName,
      __abs: absFile,
      __relPath: relPath,
    });
  }

  dossiers.sort((left, right) => String(left.id).localeCompare(String(right.id)));

  const tableHeader = [
    '| ID | Title | Status | Area | Depends on | Impacts | Dossier |',
    '|---|---|---|---|---|---|---|',
  ].join('\n');

  const rows = dossiers.map(featureRow).join('\n');
  const featuresBlock = `${tableHeader}\n${rows || '| — | — | — | — | — | — | — |'}`;
  const graphBlock = buildMermaidGraph(dossiers);

  let content;
  try {
    content = await readText(absIndexFile);
  } catch {
    content = ensureIndexSkeleton();
  }

  content = replaceBlock(
    content,
    '<!-- BEGIN GENERATED FEATURES -->',
    '<!-- END GENERATED FEATURES -->',
    featuresBlock,
  );
  content = replaceBlock(
    content,
    '<!-- BEGIN GENERATED DEP_GRAPH -->',
    '<!-- END GENERATED DEP_GRAPH -->',
    graphBlock,
  );
  content = content.replace(/_Last sync: .*?_\n/, `_Last sync: ${new Date().toISOString()}_\n`);

  await writeTextAtomic(absIndexFile, content);
  console.log(`[sync-index] Updated ${indexFile} from ${dossierFiles.length} dossier(s).`);
};

main().catch((error) => {
  console.error('[sync-index] FATAL:', error?.stack ?? String(error));
  process.exit(1);
});

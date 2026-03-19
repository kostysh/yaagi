#!/usr/bin/env node
/**
 * Validates Feature Dossiers and updates the "Red flags" block in docs/ssot/index.md.
 *
 * Usage:
 *   node scripts/lint-dossiers.mjs
 *   node scripts/lint-dossiers.mjs --dossiers-dir docs/features --index-file docs/ssot/index.md
 *   node scripts/lint-dossiers.mjs --no-update-index
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_DOSSIERS_DIR = 'docs/features';
const DEFAULT_INDEX_FILE = 'docs/ssot/index.md';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const has = (name) => args.includes(name);
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
    updateIndex: !has('--no-update-index'),
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

const ALLOWED_STATUS = new Set(['proposed', 'shaped', 'planned', 'in_progress', 'done', 'parked']);

const extractFeatureNumericId = (featureId) => {
  const match = String(featureId).match(/^F-(\d{4})$/);
  return match ? match[1] : null;
};

const extractAcIds = (markdown) => {
  const ids = new Set();
  const regex = /\bAC-F(\d{4})-(\d{1,2})\b/g;
  for (;;) {
    const match = regex.exec(markdown);
    if (!match) break;
    ids.add(`AC-F${match[1]}-${match[2].padStart(2, '0')}`);
  }
  return [...ids].sort();
};

const extractCoverageAcIds = (markdown) => {
  const ids = new Set();
  const regex = /^\|\s*(AC-F\d{4}-\d{1,2})\s*\|/gm;
  for (;;) {
    const match = regex.exec(markdown);
    if (!match) break;
    ids.add(match[1].replace(/-(\d{1,2})$/, (_, value) => `-${String(value).padStart(2, '0')}`));
  }
  return [...ids].sort();
};

const hasChangeLogEntry = (markdown) => /##\s+.*Change log|##\s+Change log/i.test(markdown);

const replaceBlock = (content, beginMarker, endMarker, block) => {
  const begin = content.indexOf(beginMarker);
  const end = content.indexOf(endMarker);
  if (begin === -1 || end === -1 || end < begin) return content;

  const before = content.slice(0, begin + beginMarker.length);
  const after = content.slice(end);
  return `${before}\n${block}\n${after}`;
};

const main = async () => {
  const { dossiersDir, indexFile, root, updateIndex } = parseArgs();
  const absDossiersDir = path.resolve(root, dossiersDir);
  const absIndexFile = path.resolve(root, indexFile);

  let files = [];
  try {
    files = await listDossiers(absDossiersDir);
  } catch (error) {
    console.error(`[lint-dossiers] ERROR: cannot read dossiers directory: ${absDossiersDir}`);
    console.error(error?.stack ?? String(error));
    process.exit(1);
  }

  /** @type {{ level: "error" | "warn", feature?: string, message: string }[]} */
  const findings = [];
  /** @type {Set<string>} */
  const featureIds = new Set();

  for (const fileName of files) {
    const absFile = path.join(absDossiersDir, fileName);
    const markdown = await readText(absFile);
    const frontmatter = parseFrontmatter(markdown);

    if (!frontmatter) {
      findings.push({
        level: 'error',
        feature: fileName,
        message: 'Missing or invalid YAML frontmatter (must start with --- and end with ---).',
      });
      continue;
    }

    const id = frontmatter.id;
    const title = frontmatter.title;
    const status = frontmatter.status;
    const area = frontmatter.area;
    const owners = frontmatter.owners;
    const created = frontmatter.created;
    const updated = frontmatter.updated;

    const requiredKeys = [
      ['id', id],
      ['title', title],
      ['status', status],
      ['area', area],
      ['owners', owners],
      ['created', created],
      ['updated', updated],
    ];

    for (const [key, value] of requiredKeys) {
      if (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        findings.push({
          level: 'error',
          feature: String(id ?? fileName),
          message: `Missing required frontmatter key: ${key}`,
        });
      }
    }

    if (typeof id !== 'string' || !/^F-\d{4}$/.test(id)) {
      findings.push({
        level: 'error',
        feature: String(id ?? fileName),
        message: `Invalid feature id "${String(id)}" (expected F-0001).`,
      });
    } else {
      if (featureIds.has(id)) {
        findings.push({
          level: 'error',
          feature: id,
          message: `Duplicate feature id across dossiers: ${id}`,
        });
      }
      featureIds.add(id);
    }

    if (typeof status !== 'string' || !ALLOWED_STATUS.has(status)) {
      findings.push({
        level: 'error',
        feature: String(id ?? fileName),
        message: `Invalid status "${String(status)}" (allowed: ${[...ALLOWED_STATUS].join(', ')}).`,
      });
    }

    if (!Array.isArray(owners) || owners.length === 0) {
      findings.push({
        level: 'error',
        feature: String(id ?? fileName),
        message: 'owners must be a non-empty array (for example owners: ["@you"]).',
      });
    }

    for (const [key, value] of [
      ['created', created],
      ['updated', updated],
    ]) {
      if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        findings.push({
          level: 'warn',
          feature: String(id ?? fileName),
          message: `${key} should be YYYY-MM-DD (got "${value}").`,
        });
      }
    }

    const acIds = extractAcIds(markdown);
    if (acIds.length === 0) {
      findings.push({
        level: 'error',
        feature: String(id ?? fileName),
        message: 'No acceptance criteria IDs found. Add at least one AC-F....-.. entry.',
      });
    }

    const featureNumber = extractFeatureNumericId(id);
    if (featureNumber) {
      for (const acId of acIds) {
        if (!acId.startsWith(`AC-F${featureNumber}-`)) {
          findings.push({
            level: 'error',
            feature: id,
            message: `AC ID "${acId}" does not match feature numeric id ${featureNumber}.`,
          });
        }
      }
    }

    const coverageIds = extractCoverageAcIds(markdown);
    const needsCoverage = ['planned', 'in_progress', 'done'].includes(String(status));
    if (needsCoverage) {
      if (coverageIds.length === 0) {
        findings.push({
          level: 'error',
          feature: id,
          message: 'Missing Coverage map table (expected rows like "| AC-F....-.. |").',
        });
      } else {
        const missingCoverage = acIds.filter((acId) => !coverageIds.includes(acId));
        if (missingCoverage.length) {
          findings.push({
            level: 'error',
            feature: id,
            message: `Coverage map is missing AC rows: ${missingCoverage.join(', ')}`,
          });
        }
      }
    } else if (coverageIds.length === 0) {
      findings.push({
        level: 'warn',
        feature: id,
        message:
          'Coverage map is recommended even for early statuses (planned/in_progress requires it).',
      });
    }

    if (!hasChangeLogEntry(markdown)) {
      findings.push({
        level: 'warn',
        feature: id,
        message: 'Missing Change log section. Add at least an initial entry for traceability.',
      });
    }

    const dependsOn = Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [];
    for (const dep of dependsOn) {
      if (typeof dep !== 'string' || !/^F-\d{4}$/.test(dep)) {
        findings.push({
          level: 'error',
          feature: id,
          message: `Invalid depends_on entry "${String(dep)}" (expected F-0002).`,
        });
      }
    }
  }

  for (const fileName of files) {
    const absFile = path.join(absDossiersDir, fileName);
    const markdown = await readText(absFile);
    const frontmatter = parseFrontmatter(markdown);
    if (!frontmatter || typeof frontmatter.id !== 'string') continue;

    const dependsOn = Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [];
    for (const dep of dependsOn) {
      if (typeof dep === 'string' && /^F-\d{4}$/.test(dep) && !featureIds.has(dep)) {
        findings.push({
          level: 'error',
          feature: frontmatter.id,
          message: `depends_on references missing dossier: ${dep}`,
        });
      }
    }
  }

  const errors = findings.filter((finding) => finding.level === 'error');
  const warnings = findings.filter((finding) => finding.level === 'warn');
  const byFeature = new Map();

  for (const finding of findings) {
    const key = finding.feature ?? 'global';
    if (!byFeature.has(key)) byFeature.set(key, []);
    byFeature.get(key).push(finding);
  }

  const summaryLines = [];
  summaryLines.push(
    `Found ${errors.length} error(s), ${warnings.length} warning(s) across ${files.length} dossier(s).`,
  );

  for (const [feature, items] of [...byFeature.entries()].sort((left, right) =>
    String(left[0]).localeCompare(String(right[0])),
  )) {
    for (const item of items) {
      summaryLines.push(`- [${item.level.toUpperCase()}] ${feature}: ${item.message}`);
    }
  }

  console.log(summaryLines.join('\n'));

  if (updateIndex) {
    try {
      const indexText = await readText(absIndexFile);
      const redFlags = findings.length
        ? findings
            .map(
              (finding) =>
                `- **${finding.level.toUpperCase()}** ${finding.feature ?? 'global'} — ${finding.message}`,
            )
            .join('\n')
        : '- ✅ No red flags detected.';

      const updatedIndex = replaceBlock(
        indexText,
        '<!-- BEGIN GENERATED RED_FLAGS -->',
        '<!-- END GENERATED RED_FLAGS -->',
        redFlags,
      );
      await writeTextAtomic(absIndexFile, updatedIndex);
      console.log(`[lint-dossiers] Updated Red flags block in ${indexFile}.`);
    } catch {
      console.warn(`[lint-dossiers] WARN: Could not update index red flags block (${indexFile}).`);
    }
  }

  if (errors.length) process.exit(2);
};

main().catch((error) => {
  console.error('[lint-dossiers] FATAL:', error?.stack ?? String(error));
  process.exit(1);
});

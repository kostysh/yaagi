#!/usr/bin/env node
/**
 * Outputs a Mermaid dependency graph from Feature Dossier frontmatter.
 *
 * Usage:
 *   node scripts/dependency-graph.mjs
 *   node scripts/dependency-graph.mjs --dossiers-dir docs/features
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_DOSSIERS_DIR = "docs/features";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const get = (name, fallback) => {
    const idx = args.indexOf(name);
    if (idx === -1) return fallback;
    const value = args[idx + 1];
    if (!value || value.startsWith("--")) return fallback;
    return value;
  };

  return {
    root: get("--root", process.cwd()),
    dossiersDir: get("--dossiers-dir", DEFAULT_DOSSIERS_DIR),
  };
};

const readText = async (filePath) => fs.readFile(filePath, "utf8");

const parseYamlValue = (rawValue) => {
  const trimmed = rawValue.trim();
  if (trimmed === "[]") return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((item) => item.trim())
      .map((item) => item.replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^['"]|['"]$/g, "");
};

const parseFrontmatter = (markdown) => {
  if (!markdown.startsWith("---")) return null;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return null;

  const raw = markdown.slice(3, end).trim();
  const lines = raw.split(/\r?\n/);

  /** @type {Record<string, unknown>} */
  const frontmatter = {};
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    frontmatter[match[1]] = parseYamlValue(match[2]);
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

const escapeQuotes = (value) => String(value).replace(/"/g, '\\"');

const main = async () => {
  const { root, dossiersDir } = parseArgs();
  const absDossiersDir = path.resolve(root, dossiersDir);
  const fileNames = await listDossiers(absDossiersDir);

  const dossiers = [];
  for (const fileName of fileNames) {
    const markdown = await readText(path.join(absDossiersDir, fileName));
    const frontmatter = parseFrontmatter(markdown);
    if (!frontmatter || typeof frontmatter.id !== "string") continue;
    dossiers.push(frontmatter);
  }

  const nodes = dossiers.map((dossier) => {
    const nodeId = String(dossier.id).replace("-", "");
    const label = `${dossier.id} ${dossier.title ?? ""}`.trim();
    return `  ${nodeId}["${escapeQuotes(label)}"]`;
  });

  const edges = [];
  for (const dossier of dossiers) {
    const from = String(dossier.id).replace("-", "");
    const dependsOn = Array.isArray(dossier.depends_on) ? dossier.depends_on : [];
    for (const dep of dependsOn) {
      edges.push(`  ${from} --> ${String(dep).replace("-", "")}`);
    }
  }

  console.log(["```mermaid", "graph TD", ...nodes, ...edges, "```"].join("\n"));
};

main().catch((error) => {
  console.error("[dependency-graph] FATAL:", error?.stack ?? String(error));
  process.exit(1);
});

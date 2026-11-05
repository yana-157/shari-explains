import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { slugPattern } from "./posts.mjs";
export function validateSettings(site) {
  if (
    !Array.isArray(site.categories) ||
    site.categories.length < 1 ||
    site.categories.length > 20
  )
    throw new Error("Keep between 1 and 20 categories.");
  const ids = new Set(),
    labels = new Set();
  for (const category of site.categories) {
    if (!slugPattern.test(category.id) || category.id.length > 50)
      throw new Error(
        "Category IDs need lowercase letters, numbers, and hyphens.",
      );
    if (
      typeof category.label !== "string" ||
      !category.label.trim() ||
      category.label.length > 40
    )
      throw new Error("Category names need 1–40 characters.");
    if (ids.has(category.id) || labels.has(category.label.trim().toLowerCase()))
      throw new Error("Each category needs a unique name and ID.");
    ids.add(category.id);
    labels.add(category.label.trim().toLowerCase());
  }
  for (const key of ["description", "heroIntro", "aboutIntro"])
    if (
      typeof site[key] !== "string" ||
      !site[key].trim() ||
      site[key].length > 1500
    )
      throw new Error("Homepage text must be between 1 and 1500 characters.");
  for (const key of ["background", "text", "accent", "muted", "soft"])
    if (!/^#[a-fA-F0-9]{6}$/.test(site.theme?.[key]))
      throw new Error("Use six-digit hex colors.");
  if (
    typeof site.theme.fontScale !== "number" ||
    site.theme.fontScale < 0.8 ||
    site.theme.fontScale > 1.3
  )
    throw new Error("Text size must be between 80% and 130%.");
  return site;
}
export async function readSettings(root) {
  const content = await readFile(path.join(root, "content/site.json"), "utf8");
  return {
    ...validateSettings(JSON.parse(content)),
    revision: createHash("sha256").update(content).digest("hex"),
  };
}
export async function saveSettings(root, { settings, expectedRevision }) {
  const old = await readSettings(root);
  if (old.revision !== expectedRevision)
    throw new Error(
      "Site settings changed outside the Studio. Reopen settings before saving.",
    );
  // Existing IDs stay stable in the UI. The category command performs deliberate migrations.
  if (
    old.categories.some(
      (c) => !settings.categories?.some((next) => next.id === c.id),
    )
  )
    throw new Error(
      "Use the category rename command to change an existing ID.",
    );
  const next = {
    ...old,
    description: settings.description,
    heroIntro: settings.heroIntro,
    aboutIntro: settings.aboutIntro,
    categories: settings.categories.map((c) => ({
      id: c.id,
      label: c.label.trim(),
    })),
    theme: settings.theme,
  };
  delete next.revision;
  validateSettings(next);
  const file = path.join(root, "content/site.json"),
    temp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2) + "\n");
  await rename(temp, file);
  return readSettings(root);
}
export function themeCSS(theme) {
  return `/* Generated from content/site.json. Edit through Post Studio → Site settings & design. */\n:root{--paper:${theme.background};--ink:${theme.text};--orange:${theme.accent};--muted:${theme.muted};--soft:${theme.soft};--font-scale:${theme.fontScale}}\n`;
}

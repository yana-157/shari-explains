import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listPosts } from "./studio-store.mjs";
import { readSettings, validateSettings } from "./site-config.mjs";
import { slugPattern } from "./posts.mjs";
import { build, root } from "./build.mjs";

/** Deliberately migrate an ID, updating the config and every affected post together. */
export async function renameCategory(projectRoot, oldId, newId) {
  if (!slugPattern.test(oldId) || !slugPattern.test(newId) || newId.length > 50)
    throw new Error(
      "IDs use lowercase letters, numbers, and hyphens, up to 50 characters.",
    );
  const config = await readSettings(projectRoot);
  if (!config.categories.some((c) => c.id === oldId))
    throw new Error(`No category has ID ${oldId}.`);
  if (config.categories.some((c) => c.id === newId))
    throw new Error(`Category ID ${newId} already exists.`);
  const posts = (await listPosts(projectRoot)).filter(
    (p) => p.category === oldId,
  );
  config.categories = config.categories.map((c) =>
    c.id === oldId ? { ...c, id: newId } : c,
  );
  delete config.revision;
  validateSettings(config);
  const changes = [
    {
      file: path.join(projectRoot, "content/site.json"),
      next: JSON.stringify(config, null, 2) + "\n",
    },
  ];
  for (const post of posts) {
    post.category = newId;
    delete post.revision;
    changes.push({
      file: path.join(projectRoot, "posts", post.id, "post.json"),
      next: JSON.stringify(post, null, 2) + "\n",
    });
  }
  for (const change of changes)
    change.previous = await readFile(change.file, "utf8");
  // Prepare every file before replacing any originals; roll back on a write failure.
  const changed = [];
  try {
    for (const change of changes)
      await writeFile(change.file + ".category-tmp", change.next);
    for (const change of changes) {
      await rename(change.file + ".category-tmp", change.file);
      changed.push(change);
    }
  } catch (error) {
    for (const change of changed) await writeFile(change.file, change.previous);
    throw error;
  }
  return posts.map((p) => p.id);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [action, oldId, newId] = process.argv.slice(2);
  if (action !== "rename" || !oldId || !newId) {
    console.error("Usage: npm run category -- rename old-id new-id");
    process.exitCode = 1;
  } else
    try {
      const affected = await renameCategory(root, oldId, newId);
      await build();
      console.log(
        `Renamed ${oldId} → ${newId}. Updated ${affected.length} posts.\nReview and commit content/site.json plus the affected post.json files together, then push.\n${affected.map((id) => "posts/" + id + "/post.json").join("\n")}`,
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
}

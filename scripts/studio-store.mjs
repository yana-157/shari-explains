import {
  mkdir,
  readFile,
  writeFile,
  rename,
  lstat,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { slugPattern, validatePost } from "./posts.mjs";
import { readSettings } from "./site-config.mjs";
const revision = (content) =>
  createHash("sha256").update(content).digest("hex");
export async function safeFolder(root, id, create = false) {
  if (!slugPattern.test(id) || id.length > 100)
    throw new Error("Invalid post address.");
  const folder = path.join(root, "posts", id);
  if (create) await mkdir(folder, { recursive: true });
  if ((await lstat(folder)).isSymbolicLink())
    throw new Error("Post folders cannot be symbolic links.");
  return folder;
}
export async function readPost(root, id) {
  const folder = await safeFolder(root, id);
  const content = await readFile(path.join(folder, "post.json"), "utf8");
  return { ...JSON.parse(content), revision: revision(content) };
}
export async function listPosts(root) {
  const entries = await readdir(path.join(root, "posts"), {
    withFileTypes: true,
  });
  const posts = [];
  for (const entry of entries)
    if (entry.isDirectory() && slugPattern.test(entry.name))
      posts.push(await readPost(root, entry.name));
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}
function imageBytes(image) {
  if (!/^cover\.(jpg|png|webp|avif)$/.test(image.name))
    throw new Error("Invalid cover filename.");
  const match =
    /^data:image\/(jpeg|png|webp|avif);base64,([A-Za-z0-9+/=]+)$/.exec(
      image.data || "",
    );
  if (!match) throw new Error("Invalid image data.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw new Error("Cover images must be smaller than 8 MB.");
  const expected = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif" }[
    match[1]
  ];
  if (image.name !== `cover.${expected}`)
    throw new Error("Image extension and type do not match.");
  const signature =
    match[1] === "jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : match[1] === "png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : match[1] === "webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          : bytes.toString("ascii", 4, 8) === "ftyp" &&
            /avif|avis/.test(bytes.toString("ascii", 8, 32));
  if (!signature)
    throw new Error(
      "The cover file is not a valid image of the selected type.",
    );
  return bytes;
}
async function atomicWrite(file, content) {
  const temp = `${file}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temp, content);
  await rename(temp, file);
}
export async function savePost(
  root,
  { post, coverData, existing, expectedRevision },
) {
  validatePost(post);
  const settings = await readSettings(root);
  if (!settings.categories.some((c) => c.id === post.category))
    throw new Error(
      "This category no longer exists. Reload the Studio and choose a category.",
    );
  let previous = null;
  try {
    previous = await readPost(root, post.id);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous && !existing)
    throw new Error(
      "A post already uses that address. Choose a different article address or open the existing post.",
    );
  if (existing && (!previous || expectedRevision !== previous.revision))
    throw new Error(
      "This post changed outside the Studio. Reload it before saving to avoid overwriting newer work.",
    );
  const bytes = coverData ? imageBytes(coverData) : null;
  if (coverData && coverData.name !== post.cover)
    throw new Error("Cover filename mismatch.");
  if (!bytes && !previous) throw new Error("Please choose a cover image.");
  const folder = await safeFolder(root, post.id, true);
  if (!bytes) {
    const info = await lstat(path.join(folder, post.cover));
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error("The existing cover image is unavailable.");
  }
  // Explicit fields prevent arbitrary paths or editor-only values entering the post format.
  const clean = {
    id: post.id,
    title: post.title.trim(),
    excerpt: post.excerpt || "",
    date: post.date,
    category: post.category,
    author: post.author || "Shari Explains",
    cover: post.cover,
    coverAlt: post.coverAlt || post.title,
    body: post.body,
    caption: post.caption || "",
    archived: Boolean(post.archived),
    status: post.status || "published",
    sources: post.sources || [],
  };
  if (previous?.originalUrl) clean.originalUrl = previous.originalUrl;
  if (bytes) await atomicWrite(path.join(folder, post.cover), bytes);
  await atomicWrite(
    path.join(folder, "post.json"),
    JSON.stringify(clean, null, 2) + "\n",
  );
  return readPost(root, post.id);
}

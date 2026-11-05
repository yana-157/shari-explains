import {
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
  rm,
  stat,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  escapeHTML,
  renderArticle,
  readingTime,
} from "../src/shared/article.mjs";
import { validatePost } from "./posts.mjs";
import { readSettings, themeCSS } from "./site-config.mjs";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export async function build() {
  const out = path.join(root, "dist");
  await mkdir(out, { recursive: true });
  await cp(path.join(root, "src"), out, { recursive: true });
  await cp(path.join(root, "studio"), path.join(out, "studio"), {
    recursive: true,
  });
  await mkdir(path.join(out, "posts"), { recursive: true });
  const config = await readSettings(root);
  const homepage = await readFile(path.join(root, "src/index.html"), "utf8");
  await writeFile(
    path.join(out, "index.html"),
    homepage
      .replaceAll("{{SITE_DESCRIPTION}}", escapeHTML(config.description))
      .replaceAll("{{REQUEST_FORM_URL}}", escapeHTML(config.requestFormUrl))
      .replaceAll("{{INSTAGRAM_URL}}", escapeHTML(config.instagramUrl))
      .replaceAll("{{HERO_INTRO}}", escapeHTML(config.heroIntro))
      .replaceAll("{{ABOUT_INTRO}}", escapeHTML(config.aboutIntro))
      .replace(
        "{{CATEGORY_FILTERS}}",
        config.categories
          .map(
            (c) =>
              `<button data-category="${escapeHTML(c.id)}" aria-pressed="false">${escapeHTML(c.label)}</button>`,
          )
          .join(""),
      )
      .replace(
        "{{CATEGORY_RIBBON}}",
        config.categories
          .map((c) => escapeHTML(c.label.toUpperCase()))
          .join(" <b>✳</b> "),
      ),
  );
  await writeFile(path.join(out, "theme.css"), themeCSS(config.theme));
  await writeFile(path.join(out, "site.json"), JSON.stringify(config));
  const entries = await readdir(path.join(root, "posts"), {
    withFileTypes: true,
  });
  const posts = [];
  // Rebuild only generated article output; never alter source post folders.
  await rm(path.join(out, "posts"), { recursive: true, force: true });
  await mkdir(path.join(out, "posts"), { recursive: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folder = path.join(root, "posts", entry.name);
    const post = JSON.parse(
      await readFile(path.join(folder, "post.json"), "utf8"),
    );
    validatePost(post);
    const category = config.categories.find((c) => c.id === post.category);
    if (!category)
      throw new Error(`Unknown category ${post.category} in ${post.id}`);
    post.categoryLabel = category.label;
    if (post.id !== entry.name)
      throw new Error(`Post folder and id must match: ${entry.name}`);
    const file = await stat(path.join(folder, post.cover));
    if (!file.isFile()) throw new Error(`Cover missing: ${post.id}`);
    if (post.status === "draft") continue;
    const dest = path.join(out, "posts", post.id);
    await cp(folder, dest, { recursive: true });
    // Editorial provenance stays in Git, not in the public generated data.
    await rm(path.join(dest, "post.json"), { force: true });
    await rm(path.join(dest, "editorial-notes.md"), { force: true });
    const article = renderArticle(post, post.cover);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(post.title)} — Shari Explains</title><meta name="description" content="${escapeHTML(post.excerpt || post.title)}"><meta name="theme-color" content="#f5f2eb"><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../theme.css"><link rel="icon" href="../../assets/favicon.svg"></head><body><a class="skip-link" href="#article">Skip to article</a><header class="site-header wrap"><a class="wordmark" href="../../">shari<span>explains<span class="orange">.</span></span></a><nav aria-label="Article navigation" class="article-navigation"><a href="../../#explainers">The explainers</a><a href="../../#research">Research notes</a></nav><a class="button button-small header-request" href="${escapeHTML(config.requestFormUrl)}" target="_blank" rel="noopener noreferrer">Request a topic ↗</a></header><main class="wrap" id="article"><div class="article-header"><a class="back-link" href="../../#explainers">← Back to the explainers</a></div><article>${article}</article></main><aside class="article-bottom"><p class="eyebrow">There’s always more to understand</p><h2>Stay <em>curious.</em></h2><a class="button" href="../../#explainers">More explainers ↗</a></aside><footer class="site-footer"><div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} Shari Explains</span><span>For education and discussion. Not individual legal advice.</span><a href="../../studio/">Post Studio ↗</a></div></footer></body></html>`;
    await writeFile(path.join(dest, "index.html"), html);
    posts.push({ ...post, readingMinutes: readingTime(post) });
  }
  posts.sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
  );
  await writeFile(
    path.join(out, "posts.json"),
    JSON.stringify(
      posts.map(({ originalUrl, sourceNote, importNotes, ...post }) => post),
      null,
      2,
    ),
  );
  await writeFile(
    path.join(out, "posts/index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All explainers — Shari Explains</title><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../theme.css"><main class="wrap section"><a href="../">← Home</a><h1>All explainers</h1><ul>${posts.map((p) => `<li><a href="${p.id}/">${escapeHTML(p.title)}</a></li>`).join("")}</ul></main></html>`,
  );
  console.log(`Built ${posts.length} articles → dist/`);
  return posts;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();

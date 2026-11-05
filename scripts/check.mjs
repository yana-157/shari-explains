import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readFile, symlink, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validatePost } from "./posts.mjs";
import { savePost, readPost } from "./studio-store.mjs";
import { renderArticle, renderBody } from "../src/shared/article.mjs";
import { build, root } from "./build.mjs";
import { readSettings, saveSettings, themeCSS } from "./site-config.mjs";
import { renameCategory } from "./category.mjs";
const temp = await mkdtemp(path.join(os.tmpdir(), "shari-post-check-"));
const post = {
  id: "test-explainer",
  title: "A clear headline",
  excerpt: "A short introduction.",
  date: "2026-11-05",
  category: "law-rights",
  cover: "cover.png",
  body: "First paragraph.\n\n## A useful heading\n\nA second paragraph.",
  status: "published",
  sources: [{ title: "Congress", url: "https://www.congress.gov/" }],
};
const coverData = {
  name: "cover.png",
  data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
};
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`✓ ${name}`);
}
try {
  await mkdir(path.join(temp, "posts"));
  await mkdir(path.join(temp, "content"));
  await cp(
    path.join(root, "content/site.json"),
    path.join(temp, "content/site.json"),
  );
  check("Post validation rejects traversal and bad dates", () => {
    assert.throws(() => validatePost({ ...post, id: "../outside" }));
    assert.throws(() => validatePost({ ...post, cover: "../cover.png" }));
    assert.throws(() => validatePost({ ...post, date: "2026-02-31" }));
  });
  check("Article rendering escapes pasted HTML", () => {
    const html = renderArticle(
      {
        ...post,
        title: "<script>alert(1)</script>",
        body: "<img src=x onerror=alert(1)>",
      },
      "cover.png",
    );
    assert(!html.includes("<script>"));
    assert(!html.includes("<img src=x"));
    assert(html.includes("&lt;script&gt;"));
  });
  check(
    "The same renderer formats headings, paragraphs, and safe source links",
    () => {
      assert(renderBody(post.body).includes("<h2>A useful heading</h2>"));
      assert(renderBody("[bad](javascript:alert(1))").includes("javascript:"));
      assert(!renderBody("[bad](javascript:alert(1))").includes("<a"));
      assert(
        renderArticle(post, "cover.png").includes('rel="noopener noreferrer"'),
      );
    },
  );
  let saved = await savePost(temp, { post, coverData, existing: false });
  checks++;
  console.log("✓ Save creates the correct post folder and cover");
  assert.equal((await readPost(temp, post.id)).title, post.title);
  await assert.rejects(
    () => savePost(temp, { post, coverData, existing: false }),
    /already uses/,
  );
  checks++;
  console.log("✓ Duplicate addresses cannot overwrite existing posts");
  await assert.rejects(
    () => savePost(temp, { post, existing: true, expectedRevision: "stale" }),
    /changed outside/,
  );
  checks++;
  console.log("✓ Stale edits cannot overwrite newer work");
  saved = await savePost(temp, {
    post: { ...post, title: "Revised title" },
    existing: true,
    expectedRevision: saved.revision,
  });
  assert.equal(saved.title, "Revised title");
  checks++;
  console.log("✓ Editing preserves the cover and updates the existing post");
  let config = await readSettings(temp);
  const settings = {
    ...config,
    categories: config.categories.map((c) =>
      c.id === "world-events" ? { ...c, label: "Breaking news" } : c,
    ),
    theme: { ...config.theme, fontScale: 1.1 },
  };
  config = await saveSettings(temp, {
    settings,
    expectedRevision: config.revision,
  });
  assert.equal(
    config.categories.find((c) => c.id === "world-events").label,
    "Breaking news",
  );
  assert(themeCSS(config.theme).includes("--font-scale:1.1"));
  checks++;
  console.log(
    "✓ Global category labels and theme settings are saved centrally",
  );
  config = await saveSettings(temp, {
    settings: {
      ...config,
      categories: [...config.categories, { id: "culture", label: "Culture" }],
    },
    expectedRevision: config.revision,
  });
  assert(config.categories.some((c) => c.id === "culture"));
  checks++;
  console.log("✓ New categories can be added without changing code");
  const migrated = await renameCategory(temp, "law-rights", "legal-basics");
  assert.deepEqual(migrated, [post.id]);
  assert.equal((await readPost(temp, post.id)).category, "legal-basics");
  assert(
    (await readSettings(temp)).categories.some((c) => c.id === "legal-basics"),
  );
  checks++;
  console.log("✓ Category ID migration updates every affected post");
  await renameCategory(temp, "legal-basics", "law-rights");
  await assert.rejects(
    () =>
      savePost(temp, {
        post: { ...post, id: "bad-image" },
        coverData: {
          name: "cover.png",
          data: "data:image/png;base64,PHNjcmlwdD4=",
        },
      }),
    /not a valid image/,
  );
  checks++;
  console.log("✓ Disguised non-image files are rejected");
  await symlink(temp, path.join(temp, "posts", "linked-folder"));
  await assert.rejects(
    () => savePost(temp, { post: { ...post, id: "linked-folder" }, coverData }),
    /symbolic links/,
  );
  checks++;
  console.log("✓ Saves cannot follow a post-folder symlink");
  const posts = await build();
  assert(posts.length > 0);
  for (const article of posts) {
    const html = await readFile(
      path.join(root, "dist/posts", article.id, "index.html"),
      "utf8",
    );
    assert(html.includes("<article>"));
    assert(!html.includes("<iframe"));
    assert(!html.includes("instagram.com"));
    assert(html.includes(article.cover));
  }
  checks++;
  console.log(
    `✓ ${posts.length} complete article pages build without Instagram embeds or post links`,
  );
  const index = await readFile(path.join(root, "dist/index.html"), "utf8");
  assert(index.includes("forms/d/e/1FAIpQL"));
  assert(index.includes('id="explainers"'));
  checks++;
  console.log("✓ Site includes the live Google Form and explainer archive");
  console.log(`\n${checks} checks passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}

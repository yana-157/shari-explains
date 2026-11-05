import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build, root } from "./build.mjs";
import { listPosts, readPost, savePost, safeFolder } from "./studio-store.mjs";
import { slugPattern } from "./posts.mjs";
import { readSettings, saveSettings } from "./site-config.mjs";
const exec = promisify(execFile);
const port = Number(process.env.STUDIO_PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString("hex");
let busy = false;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
async function payload(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12 * 1024 * 1024)
      throw new Error("The post is too large. Use a cover under 8 MB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const git = async (...args) =>
  (
    await exec("git", args, {
      cwd: root,
      maxBuffer: 1024 * 1024,
      timeout: 90000,
    })
  ).stdout.trim();
async function publish(id, settingsOnly = false) {
  if (!settingsOnly && !slugPattern.test(id)) throw new Error("Invalid post.");
  const post = settingsOnly ? null : await readPost(root, id);
  if (post?.status === "draft")
    throw new Error("Set this post to Ready for the site first.");
  const branch = await git("branch", "--show-current");
  if (branch !== "main")
    throw new Error(
      `Publishing expects the main branch. You are on ${branch || "a detached checkout"}. Save your post, then switch to main.`,
    );
  const remote = await git("remote", "get-url", "origin");
  if (
    !/^(https:\/\/github\.com\/yana-157\/shari-explains(?:\.git)?|git@github\.com:yana-157\/shari-explains(?:\.git)?)$/.test(
      remote,
    )
  )
    throw new Error(
      "The GitHub remote must be yana-157/shari-explains before publishing.",
    );
  if (await git("diff", "--cached", "--name-only"))
    throw new Error(
      "There are already staged Git changes. Commit or unstage them before publishing a post.",
    );
  const selectedPaths = settingsOnly
    ? ["content/site.json"]
    : [`posts/${id}`, "content/site.json"];
  await git("add", "--", ...selectedPaths);
  const staged = await git("diff", "--cached", "--name-only");
  if (
    staged
      .split("\n")
      .filter(Boolean)
      .some(
        (name) =>
          name !== "content/site.json" &&
          (settingsOnly || !name.startsWith(`posts/${id}/`)),
      )
  )
    throw new Error("Unrelated staged files detected. Publishing stopped.");
  if (staged)
    await git(
      "commit",
      "-m",
      settingsOnly
        ? "Update site categories, copy, and design"
        : `Publish explainer: ${post.title}`,
    );
  try {
    await git("push", "origin", "HEAD:main");
  } catch (error) {
    throw new Error(
      "Your post is saved and its commit is kept locally, but GitHub could not be reached or needs sign-in/synchronization. Check your GitHub login or sync the repo, then try Publish again. No changes were discarded.",
    );
  }
  return {
    message:
      "Published to GitHub. The live site will update when the Pages build finishes. You can check progress in the repository’s Actions tab.",
  };
}
await build();
const server = http.createServer(async (req, res) => {
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) {
    res.writeHead(403);
    return res.end("Local requests only.");
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, origin).pathname);
  } catch {
    return json(res, 400, { error: "Invalid URL" });
  }
  try {
    if (pathname.startsWith("/__studio/")) {
      if (req.method === "POST") {
        if (
          ![origin, `http://localhost:${port}`].includes(req.headers.origin) ||
          req.headers["x-studio-token"] !== token ||
          req.headers["content-type"] !== "application/json"
        )
          return json(res, 403, {
            error: "This request must come from your local Post Studio.",
          });
        if (busy)
          return json(res, 409, {
            error: "A save or publish is already in progress. Please wait.",
          });
        const data = await payload(req);
        busy = true;
        try {
          if (pathname === "/__studio/save") {
            const post = await savePost(root, data);
            await build();
            return json(res, 200, { post });
          }
          if (pathname === "/__studio/settings") {
            const settings = await saveSettings(root, data);
            await build();
            return json(res, 200, { settings });
          }
          if (pathname === "/__studio/publish")
            return json(res, 200, await publish(data.id));
          if (pathname === "/__studio/publish-settings")
            return json(res, 200, await publish(null, true));
          return json(res, 404, { error: "Unknown action" });
        } finally {
          busy = false;
        }
      }
      if (req.method !== "GET")
        return json(res, 405, { error: "Method not allowed" });
      if (pathname === "/__studio/session") return json(res, 200, { token });
      if (pathname === "/__studio/settings")
        return json(res, 200, await readSettings(root));
      if (pathname === "/__studio/posts")
        return json(res, 200, await listPosts(root));
      const record = /^\/__studio\/posts\/([a-z0-9-]+)$/.exec(pathname);
      if (record) return json(res, 200, await readPost(root, record[1]));
      const image =
        /^\/__studio\/image\/([a-z0-9-]+)\/([a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif))$/.exec(
          pathname,
        );
      if (image) {
        const folder = await safeFolder(root, image[1]);
        const bytes = await readFile(path.join(folder, image[2]));
        res.writeHead(200, {
          "Content-Type": mime[path.extname(image[2])],
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(bytes);
      }
      return json(res, 404, { error: "Not found" });
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const base = path.join(root, "dist");
    let file = path.resolve(base, "." + pathname);
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch (error) {
    if (pathname.startsWith("/__studio/"))
      return json(res, error.code === "ENOENT" ? 404 : 400, {
        error: error.message,
      });
    res.writeHead(error.code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain",
    });
    res.end("Page not found.");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `\nSite: ${origin}\nPost Studio: ${origin}/studio/\nSave posts directly into this repo. Press Ctrl+C to stop.\n`,
  ),
);

import { renderArticle } from "../shared/article.mjs";
const $ = (id) => document.getElementById(id);
const fieldNames = [
  "title",
  "excerpt",
  "category",
  "date",
  "coverAlt",
  "body",
  "caption",
  "sources",
  "slug",
  "author",
  "status",
];
let connection = null,
  currentPost = null,
  coverData = null,
  coverURL = null,
  dirty = false,
  lockedSlug = false,
  siteConfig = null;
const slugify = (text) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function collect() {
  return {
    id: $("slug").value,
    title: $("title").value.trim(),
    excerpt: $("excerpt").value.trim(),
    category: $("category").value,
    date: $("date").value,
    author: $("author").value.trim() || "Shari Explains",
    cover: coverData?.name || currentPost?.cover || "cover.jpg",
    coverAlt: $("coverAlt").value.trim(),
    body: $("body").value.trim(),
    caption: $("caption").value.trim(),
    archived: $("archived").checked,
    status: $("status").value,
    sources: $("sources")
      .value.split("\n")
      .filter((s) => s.trim())
      .map((line) => {
        const separator = line.indexOf("|");
        return separator < 0
          ? { title: line.trim(), url: line.trim() }
          : {
              title: line.slice(0, separator).trim(),
              url: line.slice(separator + 1).trim(),
            };
      }),
  };
}
function preview() {
  if (!lockedSlug) $("slug").value = slugify($("title").value);
  const post = collect();
  post.categoryLabel =
    siteConfig?.categories.find((c) => c.id === post.category)?.label ||
    post.category;
  $("article-preview").innerHTML = renderArticle(post, coverURL);
}
function changed() {
  dirty = true;
  $("draft-status").textContent = "Unsaved changes";
  preview();
  try {
    sessionStorage.setItem("shari-studio-text", JSON.stringify(collect()));
  } catch {}
}
function message(text, error = false) {
  $("save-status").textContent = text;
  $("save-status").classList.toggle("error", error);
}
function reset(post = null) {
  currentPost = post;
  coverData = null;
  lockedSlug = Boolean(post);
  fieldNames.forEach((key) => ($(key).value = ""));
  $("category").value = post?.category || siteConfig?.categories[0]?.id || "";
  $("date").value = post?.date || localDate();
  $("author").value = post?.author || "Shari Explains";
  $("status").value = post?.status || "published";
  if (post) {
    for (const key of [
      "title",
      "excerpt",
      "date",
      "coverAlt",
      "body",
      "caption",
    ])
      $(key).value = post[key] || "";
    $("slug").value = post.id;
    $("sources").value = (post.sources || [])
      .map((s) => `${s.title} | ${s.url}`)
      .join("\n");
  }
  $("archived").checked = post?.archived || false;
  $("cover").value = "";
  coverURL = post
    ? `/__studio/image/${post.id}/${post.cover}?v=${Date.now()}`
    : null;
  $("cover-info").textContent = post ? `Current image: ${post.cover}` : "";
  $("draft-status").textContent = post ? "Saved post" : "New post";
  $("caption-details").open = Boolean(post?.caption);
  dirty = false;
  message("");
  preview();
}
async function api(endpoint, body) {
  const response = await fetch(
    `/__studio/${endpoint}`,
    body
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Studio-Token": connection.token,
          },
          body: JSON.stringify(body),
        }
      : {},
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The request could not be completed.");
  return result;
}
async function listPosts() {
  const records = await api("posts");
  const select = $("existing-post");
  const selected = select.value;
  select.replaceChildren(new Option("Start a new post", ""));
  records.forEach((p) =>
    select.add(
      new Option(`${p.status === "draft" ? "Draft: " : ""}${p.title}`, p.id),
    ),
  );
  select.value = selected;
}
async function save() {
  if (!connection)
    throw new Error(
      "Open the Studio locally with npm run studio to save directly into your repo.",
    );
  if (!$("post-form").reportValidity())
    throw new Error("Please complete the required fields.");
  const post = collect();
  const result = await api("save", {
    post,
    coverData,
    existing: Boolean(currentPost),
    expectedRevision: currentPost?.revision || null,
  });
  currentPost = result.post;
  lockedSlug = true;
  coverData = null;
  dirty = false;
  $("draft-status").textContent = "Saved locally";
  sessionStorage.removeItem("shari-studio-text");
  await listPosts();
  $("existing-post").value = post.id;
  message(
    `Saved to posts/${post.id}/\n${post.status === "draft" ? "This draft is kept out of the public site." : "Your local site is updated. Publish when you’re ready."}`,
  );
  return post;
}
fieldNames.forEach((id) => $(id).addEventListener("input", changed));
$("archived").addEventListener("change", changed);
$("slug").addEventListener("input", () => {
  lockedSlug = true;
});
$("cover").addEventListener("change", async () => {
  const file = $("cover").files[0];
  if (!file) return;
  if (
    file.size > 8 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  ) {
    message("Choose a JPG, PNG, WebP, or AVIF smaller than 8 MB.", true);
    $("cover").value = "";
    return;
  }
  const ext = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  }[file.type];
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  coverData = { name: `cover.${ext}`, data };
  coverURL = data;
  $("cover-info").textContent =
    `${file.name} · ${(file.size / 1024).toFixed(0)} KB`;
  changed();
});
$("add-heading").addEventListener("click", () => {
  const field = $("body");
  field.setRangeText(
    "\n\n## Section heading\n\n",
    field.selectionStart,
    field.selectionEnd,
    "end",
  );
  field.focus();
  changed();
});
$("post-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("save").disabled = true;
  try {
    await save();
  } catch (error) {
    message(error.message, true);
  } finally {
    $("save").disabled = !connection;
  }
});
$("publish").addEventListener("click", async () => {
  if ($("status").value === "draft") {
    message(
      "Change the status to “Ready for the site” before publishing.",
      true,
    );
    return;
  }
  if (
    !confirm(
      `Publish “${$("title").value}”? This will save the post, commit its folder and any saved site settings, and push them to the GitHub repository. GitHub will then rebuild the live site.`,
    )
  )
    return;
  $("publish").disabled = true;
  $("save").disabled = true;
  try {
    const post = await save();
    message("Publishing your post to GitHub…");
    const result = await api("publish", { id: post.id });
    message(result.message);
  } catch (error) {
    message(error.message, true);
  } finally {
    $("publish").disabled = !connection;
    $("save").disabled = !connection;
  }
});
$("existing-post").addEventListener("change", async () => {
  if (dirty && !confirm("Discard unsaved changes and open another post?")) {
    $("existing-post").value = currentPost?.id || "";
    return;
  }
  try {
    reset(
      $("existing-post").value
        ? await api(`posts/${$("existing-post").value}`)
        : null,
    );
  } catch (error) {
    message(error.message, true);
  }
});
$("new-post").addEventListener("click", () => {
  if (dirty && !confirm("Discard unsaved changes and start a new post?"))
    return;
  reset();
  $("existing-post").value = "";
  $("title").focus();
});
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
function refreshCategories() {
  const selected = $("category").value;
  $("category").replaceChildren(
    ...siteConfig.categories.map((c) => new Option(c.label, c.id)),
  );
  $("category").value = siteConfig.categories.some((c) => c.id === selected)
    ? selected
    : siteConfig.categories[0].id;
}
function categoryRow(category, isNew = false) {
  const row = document.createElement("div");
  row.className = "category-setting";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Display name";
  const name = document.createElement("input");
  name.value = category.label;
  name.className = "category-name";
  name.maxLength = 40;
  name.required = true;
  nameLabel.append(name);
  const idLabel = document.createElement("label");
  idLabel.textContent = isNew ? "ID (generated)" : "ID (stable)";
  const id = document.createElement("input");
  id.value = category.id;
  id.className = "category-id";
  id.readOnly = true;
  idLabel.append(id);
  if (isNew)
    name.addEventListener("input", () => {
      id.value = slugify(name.value).slice(0, 50);
    });
  row.append(nameLabel, idLabel);
  $("category-settings").append(row);
}
function settingsMessage(text, error = false) {
  $("settings-status").textContent = text;
  $("settings-status").classList.toggle("error", error);
}
async function saveSiteSettings() {
  if (!connection)
    throw new Error(
      "Open the local Studio with npm run studio to save these settings.",
    );
  const settings = {
    categories: [...document.querySelectorAll(".category-setting")].map(
      (row) => ({
        id: row.querySelector(".category-id").value,
        label: row.querySelector(".category-name").value,
      }),
    ),
    theme: {},
  };
  for (const key of ["description", "heroIntro", "aboutIntro"])
    settings[key] = $(`setting-${key}`).value;
  for (const key of ["background", "text", "accent", "muted", "soft"])
    settings.theme[key] = $(`theme-${key}`).value;
  settings.theme.fontScale = Number($("theme-fontScale").value) / 100;
  const result = await api("settings", {
    settings,
    expectedRevision: siteConfig.revision,
  });
  siteConfig = result.settings;
  refreshCategories();
  preview();
  const vars = {
    background: "--paper",
    text: "--ink",
    accent: "--orange",
    muted: "--muted",
    soft: "--soft",
    fontScale: "--font-scale",
  };
  for (const [key, name] of Object.entries(vars))
    document.documentElement.style.setProperty(name, siteConfig.theme[key]);
  settingsMessage(
    "Saved. Categories, homepage copy, and design are updated across your local website. Refresh the site tab to see them.",
  );
}
$("open-settings").addEventListener("click", async () => {
  try {
    if (connection) siteConfig = await api("settings");
    $("category-settings").replaceChildren();
    siteConfig.categories.forEach((c) => categoryRow(c));
    for (const key of ["description", "heroIntro", "aboutIntro"])
      $(`setting-${key}`).value = siteConfig[key];
    for (const key of ["background", "text", "accent", "muted", "soft"])
      $(`theme-${key}`).value = siteConfig.theme[key];
    $("theme-fontScale").value = Math.round(siteConfig.theme.fontScale * 100);
    settingsMessage("");
    $("site-settings").showModal();
  } catch (error) {
    message(error.message, true);
  }
});
$("close-settings").addEventListener("click", () => {
  $("site-settings").close();
});
$("add-category").addEventListener("click", () =>
  categoryRow({ id: "", label: "" }, true),
);
$("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("save-settings").disabled = true;
  try {
    await saveSiteSettings();
  } catch (error) {
    settingsMessage(error.message, true);
  } finally {
    $("save-settings").disabled = !connection;
  }
});
$("publish-settings").addEventListener("click", async () => {
  if (
    !confirm(
      "Publish these global settings? This saves and commits content/site.json to GitHub, then rebuilds the live site.",
    )
  )
    return;
  $("publish-settings").disabled = true;
  try {
    await saveSiteSettings();
    settingsMessage("Publishing site settings…");
    const result = await api("publish-settings", {});
    settingsMessage(result.message);
  } catch (error) {
    settingsMessage(error.message, true);
  } finally {
    $("publish-settings").disabled = !connection;
  }
});
try {
  connection = await api("session");
  siteConfig = await api("settings");
  $("connection-status").textContent =
    "Connected to your repo. Save writes directly to posts/ and refreshes the local site.";
  await listPosts();
} catch {
  connection = null;
  siteConfig = await (await fetch("../site.json")).json();
  $("connection-status").classList.add("is-remote");
  $("connection-status").innerHTML =
    "This is a preview of the writing tool. To save directly into your repo, open the project on your computer and run <code>npm run studio</code>. Then use the local Studio link it shows. You can try writing and formatting here.";
  for (const id of [
    "save",
    "publish",
    "existing-post",
    "save-settings",
    "publish-settings",
  ])
    $(id).disabled = true;
}
refreshCategories();
reset();

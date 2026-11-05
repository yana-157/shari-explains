/** Safe, dependency-free rendering shared by the website and Post Studio. */
export const escapeHTML = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const validURL = (value) => {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
export function inline(value) {
  return escapeHTML(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
      validURL(url.replace(/&amp;/g, "&"))
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
export function renderBody(body = "") {
  return String(body)
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      if (/^### /.test(block)) return `<h3>${inline(block.slice(4))}</h3>`;
      if (/^## /.test(block)) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.split("\n").every((line) => /^- /.test(line)))
        return `<ul>${block
          .split("\n")
          .map((line) => `<li>${inline(line.slice(2))}</li>`)
          .join("")}</ul>`;
      return `<p>${inline(block)}</p>`;
    })
    .join("\n");
}
export const readingTime = (post) =>
  Math.max(
    1,
    Math.ceil(
      [post.body, post.caption].filter(Boolean).join(" ").split(/\s+/).length /
        220,
    ),
  );
export function renderArticle(post, imageURL) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(post.date)
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(post.date + "T12:00:00Z"))
    : "Draft";
  return `<header class="article-masthead"><p class="eyebrow">${escapeHTML(post.categoryLabel || post.category || "Explainer")}</p><h1>${escapeHTML(post.title || "Your headline goes here")}</h1>${post.excerpt ? `<p class="article-deck">${escapeHTML(post.excerpt)}</p>` : ""}<div class="byline"><span>By ${escapeHTML(post.author || "Shari Explains")}</span><span>${date}</span><span>${readingTime(post)} min read</span></div></header>
  ${imageURL ? `<figure class="article-cover"><img src="${escapeHTML(imageURL)}" alt="${escapeHTML(post.coverAlt || post.title)}"></figure>` : ""}
  <div class="article-body">${post.archived ? '<p class="archive-note">From the Shari Explains archive. This article reproduces the text of the original post and reflects its publication date. It has not been updated to reflect later developments.</p>' : ""}
  ${post.caption ? `<div class="article-caption">${renderBody(post.caption)}</div>` : ""}
  ${renderBody(post.body || "")}
  ${
    post.sources?.length
      ? `<section class="article-sources"><p class="eyebrow">The paper trail</p><h2>Sources & further reading</h2><ul>${post.sources
          .filter((s) => validURL(s.url))
          .map(
            (s) =>
              `<li><a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title || s.url)} ↗</a></li>`,
          )
          .join("")}</ul></section>`
      : ""
  }</div>`;
}

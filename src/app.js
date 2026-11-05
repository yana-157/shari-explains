const grid = document.querySelector("#post-grid");
const search = document.querySelector("#search");
const count = document.querySelector("#result-count");
let posts = [];
let activeCategory = "All";
const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));

function renderPosts() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = posts.filter(
    (post) =>
      (activeCategory === "All" || post.category === activeCategory) &&
      [post.title, post.categoryLabel, post.excerpt, post.body, post.caption]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
  );
  grid.replaceChildren();
  matches.forEach((post) => {
    const card = document.createElement("a");
    card.className = "post-card";
    card.href = `posts/${post.id}/`;
    const picture = document.createElement("div");
    picture.className = "card-image";
    const img = document.createElement("img");
    img.src = `posts/${post.id}/${post.cover}`;
    img.alt = post.coverAlt || `Cover artwork for ${post.title}`;
    img.loading = "lazy";
    img.decoding = "async";
    const arrow = document.createElement("span");
    arrow.className = "read-circle";
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    picture.append(img, arrow);
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const category = document.createElement("span");
    category.className = "card-category";
    category.textContent = post.categoryLabel;
    const date = document.createElement("time");
    date.dateTime = post.date;
    date.textContent = formatDate(post.date);
    meta.append(category, date);
    const title = document.createElement("h3");
    title.textContent = post.title;
    const excerpt = document.createElement("p");
    excerpt.textContent = post.excerpt || "";
    const footer = document.createElement("span");
    footer.className = "card-footer";
    footer.textContent = `${post.readingMinutes} min read`;
    card.append(picture, meta, title, excerpt, footer);
    grid.append(card);
  });
  document.querySelector("#empty-state").hidden = matches.length !== 0;
  count.textContent = `${matches.length} ${matches.length === 1 ? "explainer" : "explainers"}${query ? ` matching “${search.value.trim()}”` : " to explore"}`;
}

document.querySelectorAll("[data-category]").forEach((button) =>
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    document
      .querySelectorAll("[data-category]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    renderPosts();
  }),
);
search.addEventListener("input", renderPosts);
document.querySelector("#clear-search").addEventListener("click", () => {
  search.value = "";
  activeCategory = "All";
  document
    .querySelectorAll("[data-category]")
    .forEach((item) =>
      item.setAttribute(
        "aria-pressed",
        String(item.dataset.category === "All"),
      ),
    );
  renderPosts();
  search.focus();
});
const menu = document.querySelector(".menu-toggle");
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.querySelector("#navigation").classList.toggle("is-open", open);
});
document.querySelectorAll("#navigation a").forEach((link) =>
  link.addEventListener("click", () => {
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Open menu");
    document.querySelector("#navigation").classList.remove("is-open");
  }),
);
document.querySelector("#year").textContent = new Date().getFullYear();
try {
  const response = await fetch("posts.json");
  if (!response.ok) throw new Error("Archive unavailable");
  posts = await response.json();
  renderPosts();
} catch {
  grid.textContent =
    "The reading list couldn’t load. Please refresh, or open the article index below.";
  const fallback = document.createElement("a");
  fallback.href = "posts/index.html";
  fallback.textContent = "Browse all articles →";
  grid.append(fallback);
}

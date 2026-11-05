export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validatePost(post) {
  if (!post || typeof post !== "object") throw new Error("A post is required.");
  if (!slugPattern.test(post.id) || post.id.length > 100)
    throw new Error(
      "Use a short URL with lowercase letters, numbers, and hyphens.",
    );
  for (const key of ["title", "date", "category", "body", "cover"])
    if (typeof post[key] !== "string" || !post[key].trim())
      throw new Error(`${key} is required.`);
  if (post.title.length > 240)
    throw new Error("Keep the headline under 240 characters.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
    Number.isNaN(Date.parse(post.date + "T12:00:00Z")) ||
    new Date(post.date + "T12:00:00Z").toISOString().slice(0, 10) !== post.date
  )
    throw new Error("Choose a valid publication date.");
  if (!slugPattern.test(post.category) || post.category.length > 50)
    throw new Error("Choose a topic category.");
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(post.cover))
    throw new Error("Choose a JPG, PNG, WebP, or AVIF cover image.");
  if (post.status && !["published", "draft"].includes(post.status))
    throw new Error("Invalid post status.");
  if (post.body.length > 150000) throw new Error("This article is too long.");
  if (
    post.sources &&
    (!Array.isArray(post.sources) ||
      post.sources.some(
        (s) =>
          !s ||
          typeof s.title !== "string" ||
          typeof s.url !== "string" ||
          !/^https?:\/\//.test(s.url),
      ))
  )
    throw new Error("Sources need a title and a full http(s) URL.");
  return post;
}

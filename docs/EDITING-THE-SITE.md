# Changing the site without hunting through files

Most everyday changes live in **Post Studio → Site settings & design**. Run `npm run studio`, open its local link, then click that button. Save previews your changes locally. Publish settings sends them to GitHub and rebuilds the live site.

## Rename a category everywhere

Change the **Display name** next to the category. For example:

| Stable ID | Old display name | New display name |
| --- | --- | --- |
| `world-events` | World events | Breaking news |

Click **Save site settings**. Every post with category ID `world-events` now displays **Breaking news**. The homepage filter, topic ribbon, cards, article labels, and Studio menu all use that same name. Existing article addresses do not change.

Then click **Publish settings** when ready. Refresh your local site tab after saving.

## Add a category

1. Open **Site settings & design**.
2. Click **Add category** and enter a name, such as `Culture`.
3. The Studio generates its ID, such as `culture`.
4. Save. The category is now available in the post editor and site filters.
5. Create a post in that category and publish. Publishing a post also includes any saved site settings, so the new category is included.

Existing categories cannot be accidentally removed in the Studio. To retire one, reassign its posts first, then remove its entry from `content/site.json`; the build rejects posts with missing categories.

## Change the underlying category ID

The ID is internal, so a display-name change is normally enough. If you deliberately want to change the ID too, close the Studio while running this command from the repository:

```sh
npm run category -- rename world-events breaking-news
```

This changes the ID in `content/site.json` and in **every affected post**, including drafts. It preserves the display name and article addresses, then rebuilds the site. It rejects duplicate or invalid IDs. The command prints exactly which post files changed.

Review and commit `content/site.json` and the listed `post.json` files **together**, then push using GitHub Desktop or Git. Do not publish only the settings file after an ID migration: the corresponding post changes belong in the same commit. Reopen the Studio after the migration.

## Colors and text size

In **Site settings & design → Colors & type**, change:

- **Page background:** the main page color.
- **Main text:** the main text and dark-section color.
- **Accent & buttons:** highlights, category labels, and primary buttons.
- **Secondary text:** supporting copy and metadata.
- **Soft backgrounds:** quieter panels and surfaces.
- **Overall text size:** 100% is the original scale; 110% makes text larger across the site. The allowed range is 80–130%.

Save to preview. Check a homepage, an article, and a narrow/mobile layout before publishing, especially with larger text. Choose colors with enough contrast for easy reading.

These settings are stored in the `theme` object in `content/site.json`. The build creates `dist/theme.css`; **never edit that generated file**.

## Change a particular font, size, or spacing

For more precise design edits, use the readable, sectioned stylesheet at `src/styles.css`:

| What you want to change | Where to look |
| --- | --- |
| Body font family | `:root` → `--sans` |
| Serif/italic font family | `:root` → `--serif` |
| Main homepage headline | `.hero h1` |
| Section headings | `h2` |
| Card titles | `.post-card h3` |
| Article headline | `.article-masthead h1` |
| Article paragraphs | `.article-body` |
| Gaps between cards | `.post-grid` |
| Mobile changes | The `@media (max-width: 760px)` section |

For example, adjust the `font-size` in `.post-card h3` to change only card headings. The existing `var(--font-scale, 1)` multiplier lets that size continue following the global size control. If you change a font family, also update the Google Fonts import or choose an installed system font.

## Homepage copy and structure

The Studio lets you edit the site description, homepage introduction, and about introduction. These live in `content/site.json` and are shared by the build.

For larger structural changes, `src/index.html` contains the homepage in this order:

1. Header and navigation
2. Hero introduction
3. Explainer grid (`id="explainers"`)
4. Research room (`id="research"`)
5. About section (`id="about"`)
6. Resource links (`id="resources"`)
7. Topic request section (`id="request"`)
8. Footer

To reorder sections, move the entire `<section>…</section>` block. Keep its `id` so navigation links still work. If you remove a section, remove the matching navigation link. The article page shell lives in `scripts/build.mjs`; the actual article renderer shared by published pages and the Studio is `src/shared/article.mjs`.

After source-code edits, run `npm run check`, then `npm run build`. Refresh the local site to inspect the result. Commit and push the changed source files through GitHub Desktop or Git; the Studio’s publish buttons intentionally publish content/settings, not unrelated code changes.

## External links

The Google Form and Instagram account URLs are in `content/site.json`. Learning-resource links are in `src/index.html`. The Google Form’s own question choices are managed in Google Forms and are separate from the site’s category list.

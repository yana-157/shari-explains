# Shari’s quick guide to posting

## Open your writing desk

Open the `shari-explains` folder in Terminal and run:

```sh
npm run studio
```

Leave that Terminal window running. Open the **Post Studio** link it prints (normally `http://127.0.0.1:4173/studio/`).

## Write a post

1. Click **New post**.
2. Add a headline, a short introduction, topic, and date.
3. Choose your cover image. Add a short image description for accessibility.
4. Paste your article. Leave a blank line between paragraphs. Use **Section heading** when you want a new section. Add sources at the bottom, one per line.
5. Watch the preview on the right. The website handles the type, spacing, headline, cover, date, and reading time.

## Save and publish

Click **Save post**. That is all you need to save locally: the Studio puts the text and image in `posts/your-article-address/` and rebuilds your local website automatically. Use **View site** to see it in the grid.

When ready for readers, click **Publish to live site** and confirm. It saves the post, commits its folder and any saved site settings to GitHub, and pushes it. GitHub then rebuilds the live website. Check the repository’s **Actions** tab for the green successful deployment if the live page has not updated yet.

Want to keep working privately? Under **Post settings**, choose **Draft** before saving. It stays in your folder but is left out of the website. Change it to **Ready for the site** when it is finished.

## Edit an existing post

Choose its title in **Edit a post**. Make your changes, click **Save post**, then **Publish to live site**. Keep its article address unchanged so existing links continue working.

## Images and sources

- Covers can be JPG, PNG, WebP, or AVIF, up to 8 MB. An image around 1200 pixels wide is a useful starting point.
- Source example: `Congress.gov | https://www.congress.gov/`
- Type `**important words**` for bold text. Use a blank line before and after section headings and lists.
- The original imported posts have an archival notice. You can uncheck **Reproduced from an older Instagram post** after rewriting and reviewing an article for current publication.

## If something goes wrong

- **Save says the post changed:** reopen it from the post list before editing. This protects changes made elsewhere.
- **The address is already used:** choose a different article address, or edit the existing post.
- **Publish needs sign-in:** your post is still saved. Sign in to GitHub on your computer, then retry. No password belongs in the Studio.
- **Publish reports staged changes or the wrong branch:** finish your other Git work or switch to `main`, then retry. The Studio won’t publish unrelated staged files.
- **You opened Studio on the public website:** that version demonstrates the editor. Use the local Studio link above for saving into your computer’s repo.

On a new computer, the one-time setup is to install Node.js 22+, clone the repository, and sign in to GitHub. After that, the routine is simply **open Studio → write → save → publish**.

## Categories, colors, and page structure

Use **Site settings & design** for global category names, new categories, colors, text size, and homepage copy. See [Editing the site](EDITING-THE-SITE.md) for category-ID changes, font families, and rearranging sections.

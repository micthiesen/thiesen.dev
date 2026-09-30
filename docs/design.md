# Reading comes first

Michael's September 29, 2026 direction supersedes the information architecture
in the original rebuild brief. Preserve that brief as history, not current UI
requirements.

- One chronological publication. No project/note categories, tags, featured
  flags, or category-specific metadata. Every article uses `/posts/<slug>/`.
- The homepage opens with the newest post, its date, and its actual body.
  Longer articles show roughly 320 words, ending at a complete rendered block,
  with a Read more link. Keep the final paragraph fully readable, without a fade.
  Short articles appear in full.
  If an expandable section crosses the excerpt cutoff, end before that section
  and its heading so the preview ends on ordinary reading content.
  Below the main article, show at most three earlier posts in chronological
  order, newest first: a simple serif “Earlier posts” heading, dates above title
  links, and subtle rules between rows. Omit the section when there are no earlier
  posts. Keep the article, earlier writing, and footer in one reading column.
- No site header, top navigation, sidebar, promotional hero, eyebrow labels,
  slogans, category pills, cards, or explanatory interface filler.
  Local drafts use the same layout, without a visible preview label.
- The footer contains Michael Thiesen, Archive, About, RSS, and GitHub. The
  archive is a single chronological list of dates and titles.
- Retain Source Serif 4, the quiet warm palette, automatic light/dark themes,
  and a readable column. Titles identify the article, not the publication.
  The outlined serif “m” in `public/favicon.svg` is the icon source. Run
  `bun run icons:generate` after changing it to rebuild the multi-size ICO,
  opaque 180px Apple touch icon, and 192px/512px manifest icons.
- Content links, headings, images, code, and tables remain useful without
  JavaScript. Excerpts contain only their visible blocks; omitted links do not
  remain in the keyboard order.
- The reading sample is a local draft. Never publish sample content merely to
  fill the homepage. With no published posts, show the empty state honestly.

## References used

[Uncodixfy](https://github.com/cyxzdev/Uncodixfy/blob/main/SKILL.md) explicitly
rejects ornamental eyebrow labels, decorative copy, excess padding, and generic
AI interface patterns. Its restraint is useful here; Michael's existing serif
identity takes precedence over its app-oriented font defaults.

[Impeccable](https://github.com/pbakaus/impeccable/blob/main/plugin/skills/impeccable/SKILL.md)
distinguishes reading from marketing surfaces and prioritizes the brief over
generic stylistic rules. The appropriate purpose here is reading, not promotion.

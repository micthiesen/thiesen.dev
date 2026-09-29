---
title: "A static page"
summary: "A draft reading sample about HTML, links, and keeping a publication small."
status: draft
publishedAt: 2026-09-29
---

A page whose main job is to be read does not need much machinery. It needs a
title, a stable address, and text that is comfortable to follow. The browser
already knows how to scroll, select words, open a link in another tab, and save a
copy. Those are useful features to start with.

This is a sample post for checking the reading layout. It stays out of the public
site until it is replaced with finished writing. The paragraphs are long enough
to show the line length, the space between blocks, and the point where the home
page gives way to the complete article.

## Keep the document useful

Plain HTML gives the reader a document before asking the browser to do any other
work. A heading is a heading. A link has an address. Text can be copied without
losing its order. None of that prevents a page from having a considered layout;
it gives the layout something dependable to work with.

A small amount of structure also makes a document easier to revise. A paragraph
can move without carrying a component API with it. An image can sit beside the
Markdown file that uses it. A code example can stay a code example, with its
indentation intact and a language attached to the fence.

```ts
const posts = await getPosts();
const latest = posts[0];
```

The publication boundary is more consequential than that example suggests. A
draft must stay a draft wherever the post might appear: the home page, the
archive, its own address, and the feed. The same is true of an image attached to
an unpublished article. Hiding a link is not enough if the underlying file has
already been copied into the public build.

The useful test is to build the site and look at the files it produced. A
published post should have a complete page and a working address in the feed. An
unpublished post should have neither. Moving a post back to draft should remove
its old output on the next build, including any images that no other published
post uses. That last case is easy to miss when development only adds content.

## Keep the address predictable

An article gets one address. The home page can show its opening paragraphs, and
the archive can list its title, but both lead to the same complete document. The
address should not depend on whether the article happens to describe a project,
an observation, or something that started as one and became the other.

Links within the opening paragraphs need the same care. A reference to a later
section still needs to work when that section is outside the home-page excerpt.
So does a footnote. In an excerpt, those links can lead to their place in the
complete article instead of pointing at a missing fragment on the home page.

> The document should remain useful when its surrounding interface changes.

That is also a reasonable test for the interface itself. The footer can carry
the name of the author and the few destinations a reader might need next.
Everything above it can belong to the article. There is no need to repeat an
introduction before every piece of writing.

## Leave room for the next post

An archive does not need to predict every subject that will eventually appear.
Dates and titles are enough to begin. If a reader needs another way to find
something later, that is a concrete problem to solve at that point.

For now, the next change can be another Markdown file. The layout should be able
to accept it without a new category, a new landing page, or another piece of
introductory copy.

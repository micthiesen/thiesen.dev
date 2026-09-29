# Solid islands

Add a Solid component only when it needs client state or event handling after
load. Prefer `client:visible` and render a useful static fallback at the same
dimensions. Navbar, headings, prose, ordinary figures, code, and theme detection
belong in Astro/CSS. Test with JavaScript disabled and reduced motion enabled.

Custom `.tsx` components are site-code changes requiring code review. Markdown
authors cannot import them. Do not enable MDX to work around this boundary.

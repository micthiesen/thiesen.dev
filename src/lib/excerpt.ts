import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

function wordCount(node: DefaultTreeAdapterTypes.Node): number {
  if (node.nodeName === "#text" && "value" in node) {
    return node.value.match(/\S+/g)?.length ?? 0;
  }
  return "childNodes" in node
    ? node.childNodes.reduce((count, child) => count + wordCount(child), 0)
    : 0;
}

/** Keep complete rendered blocks, including Astro's image placeholders. */
export function excerptHtml(html: string, permalink: string, targetWords = 320) {
  const { childNodes } = parseFragment(html, { sourceCodeLocationInfo: true });
  let words = 0;
  let end = html.length;

  for (const node of childNodes) {
    words += wordCount(node);
    if (
      words >= targetWords &&
      "tagName" in node &&
      !/^h[1-6]$/.test(node.tagName) &&
      node.sourceCodeLocation
    ) {
      end = node.sourceCodeLocation.endOffset;
      break;
    }
  }

  const base = new URL(permalink, "https://thiesen.dev");
  const edits: { start: number; end: number; value: string }[] = [];
  function rebaseLinks(node: DefaultTreeAdapterTypes.Node): void {
    if ("tagName" in node && node.tagName === "a") {
      const href = node.attrs.find((attribute) => attribute.name === "href");
      const location = node.sourceCodeLocation?.attrs?.["href"];
      if (
        href &&
        location &&
        location.endOffset <= end &&
        !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(href.value.trim())
      ) {
        const resolved = new URL(href.value, base);
        const destination =
          resolved.origin === base.origin
            ? `${resolved.pathname}${resolved.search}${resolved.hash}`
            : resolved.href;
        edits.push({
          start: location.startOffset,
          end: location.endOffset,
          value: `href="${destination.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`,
        });
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(rebaseLinks);
  }
  childNodes.forEach(rebaseLinks);

  let excerpt = html.slice(0, end);
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    excerpt = excerpt.slice(0, edit.start) + edit.value + excerpt.slice(edit.end);
  }
  return { truncated: html.slice(end).trim().length > 0, html: excerpt };
}

import type { Nodes, Parents, Root } from "mdast";
import remarkDirective from "remark-directive";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/** The authoring validator and renderer share this deliberately small contract. */
export function detailsIssue(
  node: Nodes,
  parent: Parents | undefined,
  source: string,
): string | undefined {
  if (
    node.type !== "containerDirective" &&
    node.type !== "leafDirective" &&
    node.type !== "textDirective"
  )
    return undefined;
  if (node.name !== "details" || node.type !== "containerDirective") {
    return `Unsupported directive "${node.name}"; use :::details[Summary] for expandable sections`;
  }
  if (parent?.type !== "root") {
    return "Details sections must be top-level blocks; nested directives are not supported";
  }
  if (Object.keys(node.attributes ?? {}).length) {
    return "Details sections do not accept attributes";
  }
  const summary = node.children[0];
  if (
    summary?.type !== "paragraph" ||
    !summary.data?.directiveLabel ||
    summary.children.length !== 1 ||
    summary.children[0]?.type !== "text" ||
    !summary.children[0].value.trim()
  ) {
    return "Details sections need a nonempty plain-text summary: :::details[Summary]";
  }
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  const summaryEnd = summary.position?.end.offset;
  if (start === undefined || end === undefined || summaryEnd === undefined) {
    return "Details sections must retain their Markdown source positions";
  }
  const section = source.slice(start, end);
  const opening = section.split(/\r?\n/, 1)[0]!;
  if (
    !opening.startsWith(":::details[") ||
    source.slice(summaryEnd, start + opening.length).trim()
  ) {
    return "Use :::details[Summary] on its own line without attributes";
  }
  if (!/\r?\n:::[\t ]*$/.test(section)) {
    return "Close each details section with ::: on its own line";
  }
  if (!node.children.slice(1).some((child) => child.type !== "definition")) {
    return "Details sections need Markdown content after the summary";
  }
  return undefined;
}

/** Native disclosure widgets, with no raw HTML, arbitrary attributes, or client JS. */
export const remarkDetails: Plugin<[], Root> = function () {
  this.use(remarkDirective);
  return (tree, file) => {
    visit(tree, (node, _index, parent) => {
      const issue = detailsIssue(node, parent, String(file));
      if (issue) file.fail(issue, node);
      if (node.type !== "containerDirective") return;
      node.data = { ...node.data, hName: "details" };
      const summary = node.children[0]!;
      summary.data = { ...summary.data, hName: "summary" };
    });
  };
};

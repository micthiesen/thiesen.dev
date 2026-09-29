import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePosts } from "../packages/content-core";

const root = fileURLToPath(new URL("../src/content/posts/", import.meta.url));
const result = await validatePosts(root);

for (const issue of result.issues) {
  const location = path.relative(process.cwd(), issue.file);
  console.error(`${location}${issue.line ? `:${issue.line}` : ""}: ${issue.message}`);
}

if (result.issues.length) {
  console.error(`Content validation failed with ${result.issues.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(
    `Content validation passed (${result.posts.length} post(s), including drafts).`,
  );
}

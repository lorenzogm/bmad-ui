import path from "node:path";
import { projectRoot } from "../paths.js";

export const linksFile = path.join(projectRoot, "_bmad-ui", "artifacts", "links.yaml");

export type LinkItem = {
  title: string;
  subtitle: string;
  url: string;
  icon: string;
};

export function stripYamlQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSimpleYamlList(
  raw: string,
  key: string,
): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];
  const lines = raw.split("\n");
  let inList = false;
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    if (line.trim() === `${key}:` || line.trim() === `${key}: []`) {
      inList = true;
      continue;
    }
    if (!inList) continue;

    const itemMatch = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    const propMatch = line.match(/^\s+(\w+):\s*(.*)$/);

    if (itemMatch) {
      current = { [itemMatch[1]]: stripYamlQuotes(itemMatch[2]) };
      items.push(current);
    } else if (propMatch && current && !line.trim().startsWith("-")) {
      current[propMatch[1]] = stripYamlQuotes(propMatch[2]);
    }
  }

  return items;
}

export function serializeLinksYaml(links: LinkItem[]): string {
  if (links.length === 0) return "links: []\n";
  const lines = ["links:"];
  for (const link of links) {
    lines.push(`  - title: "${link.title}"`);
    lines.push(`    subtitle: "${link.subtitle}"`);
    lines.push(`    url: ${link.url}`);
    lines.push(`    icon: ${link.icon}`);
  }
  return `${lines.join("\n")}\n`;
}

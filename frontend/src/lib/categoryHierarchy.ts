import type { Category } from "@/lib/api";

export type CategoryTreeNode = Category & {
  children: CategoryTreeNode[];
};

export type FlatCategoryNode = {
  id: number;
  name: string;
  parent_id: number | null;
  is_income: boolean;
  sort_order: number;
  depth: number;
  path: string[];
  hasChildren: boolean;
};

function sortCategories(a: Category, b: Category): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const byId = new Map<number, CategoryTreeNode>();
  for (const category of categories) {
    byId.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (nodes: CategoryTreeNode[]) => {
    nodes.sort(sortCategories);
    for (const node of nodes) sortRecursive(node.children);
  };
  sortRecursive(roots);
  return roots;
}

export function flattenCategoryTree(
  tree: CategoryTreeNode[],
  options?: {
    includePath?: boolean;
    expandedIds?: Set<number>;
  }
): FlatCategoryNode[] {
  const includePath = options?.includePath ?? true;
  const expandedIds = options?.expandedIds;
  const flat: FlatCategoryNode[] = [];

  const walk = (nodes: CategoryTreeNode[], depth: number, parentPath: string[]) => {
    for (const node of nodes) {
      const path = includePath ? [...parentPath, node.name] : [node.name];
      const hasChildren = node.children.length > 0;
      flat.push({
        id: node.id,
        name: node.name,
        parent_id: node.parent_id,
        is_income: node.is_income,
        sort_order: node.sort_order,
        depth,
        path,
        hasChildren,
      });
      if (!hasChildren) continue;
      if (expandedIds && !expandedIds.has(node.id)) continue;
      walk(node.children, depth + 1, path);
    }
  };

  walk(tree, 0, []);
  return flat;
}

export function toCategoryOptions(
  categories: Category[],
  mode: "indented" | "path" = "indented"
): Array<{ id: number; label: string; depth: number; parentId: number | null }> {
  const tree = buildCategoryTree(categories);
  const expandedIds = new Set<number>(categories.map((c) => c.id));
  const flat = flattenCategoryTree(tree, { includePath: true, expandedIds });
  return flat.map((node) => ({
    id: node.id,
    depth: node.depth,
    parentId: node.parent_id,
    label:
      mode === "path"
        ? node.path.join(" / ")
        : `${"  ".repeat(node.depth)}${node.name}`,
  }));
}

export function filterCategoryTree(
  tree: CategoryTreeNode[],
  query: string
): CategoryTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;

  const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
    const children = node.children
      .map(filterNode)
      .filter((child): child is CategoryTreeNode => child !== null);
    const match =
      node.name.toLowerCase().includes(q) ||
      (node.is_income ? "income" : "expense").includes(q);
    if (match || children.length > 0) return { ...node, children };
    return null;
  };

  return tree
    .map(filterNode)
    .filter((node): node is CategoryTreeNode => node !== null);
}


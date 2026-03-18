import { createClient } from '@/lib/supabase/client';

export interface HierarchicalCostCenter {
  id: string;
  name?: string | null;
  costCode?: string | null;
  company?: string | null;
  branch?: string | null;
  subBranch?: string | null;
  level: number;
  parentId?: string | null;
  children?: HierarchicalCostCenter[];
  hasChildren?: boolean;
}

type CostCenterRow = {
  id?: string | number | null;
  cost_code?: string | null;
  cost_codes?: string | null;
  company?: string | null;
  branch?: string | null;
  sub_branch?: string | null;
  parent_cost_code?: string | null;
  unique_id?: string | null;
};

function buildName(row: CostCenterRow): string {
  const parts = [row.company, row.branch, row.sub_branch].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(' - ');
  return row.company || row.cost_code || row.cost_codes || String(row.id ?? 'Cost Center');
}

function toNode(row: CostCenterRow, level: number, parentCostCode?: string | null): HierarchicalCostCenter | null {
  const costCode = row.cost_code || row.cost_codes || null;
  const id = row.unique_id || (row.id != null ? String(row.id) : null) || costCode;
  if (!id) return null;

  return {
    id,
    name: buildName(row),
    costCode,
    company: row.company ?? null,
    branch: row.branch ?? null,
    subBranch: row.sub_branch ?? null,
    level,
    parentId: parentCostCode ?? null,
    children: [],
    hasChildren: false
  };
}

function buildHierarchy(
  parents: CostCenterRow[],
  level3: CostCenterRow[],
  level4: CostCenterRow[],
  level5: CostCenterRow[]
): HierarchicalCostCenter[] {
  const nodesByCode = new Map<string, HierarchicalCostCenter>();
  const nodesById = new Map<string, HierarchicalCostCenter>();

  const upsert = (node: HierarchicalCostCenter | null) => {
    if (!node) return;
    if (node.costCode) {
      nodesByCode.set(node.costCode, node);
    }
    nodesById.set(node.id, node);
  };

  parents.forEach((row) => upsert(toNode(row, 0, null)));
  level3.forEach((row) => upsert(toNode(row, 1, row.parent_cost_code ?? null)));
  level4.forEach((row) => upsert(toNode(row, 2, row.parent_cost_code ?? null)));
  level5.forEach((row) => upsert(toNode(row, 3, row.parent_cost_code ?? null)));

  nodesById.forEach((node) => {
    if (!node.parentId) return;
    const parent =
      (node.parentId && nodesByCode.get(node.parentId)) ||
      nodesById.get(node.parentId);
    if (!parent) return;
    if (!parent.children) parent.children = [];
    parent.children.push(node);
    parent.hasChildren = true;
  });

  const roots: HierarchicalCostCenter[] = [];
  nodesById.forEach((node) => {
    if (!node.parentId || (!nodesByCode.get(node.parentId) && !nodesById.get(node.parentId))) {
      roots.push(node);
    }
  });

  return roots;
}

export const costCenterService = {
  async fetchAllCostCenters(): Promise<HierarchicalCostCenter[]> {
    const supabase = createClient();

    const [
      { data: parentCenters, error: parentError },
      { data: level3Centers, error: level3Error },
      { data: level4Centers, error: level4Error },
      { data: level5Centers, error: level5Error }
    ] = await Promise.all([
      supabase.from('cost_centers').select('*'),
      supabase.from('level_3_cost_centers').select('*'),
      supabase.from('level_4_cost_centers').select('*'),
      supabase.from('level_5_cost_centers').select('*')
    ]);

    if (parentError || level3Error || level4Error || level5Error) {
      console.error('Error fetching cost centers:', {
        parentError,
        level3Error,
        level4Error,
        level5Error
      });
    }

    return buildHierarchy(
      (parentCenters as CostCenterRow[]) || [],
      (level3Centers as CostCenterRow[]) || [],
      (level4Centers as CostCenterRow[]) || [],
      (level5Centers as CostCenterRow[]) || []
    );
  }
};

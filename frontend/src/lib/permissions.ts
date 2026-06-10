// 권한 헬퍼: effective_permission 뷰에서 가져온 행을 다루는 유틸
export type Action = 'read' | 'write' | 'update' | 'delete';

export interface Permission {
  menu_id: number;
  menu_code: string;
  path: string | null;
  can_read: boolean;
  can_write: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface MenuNode {
  menu_id: number;
  menu_code: string;
  menu_name: string;
  parent_menu_id: number | null;
  path: string | null;
  icon: string | null;
  sort_order: number;
  is_admin_only: boolean;
  children?: MenuNode[];
}

/** 메뉴 평면 리스트를 부모-자식 트리로 변환 */
export function buildMenuTree(menus: MenuNode[]): MenuNode[] {
  const byId = new Map<number, MenuNode>();
  menus.forEach((m) => byId.set(m.menu_id, { ...m, children: [] }));
  const roots: MenuNode[] = [];
  byId.forEach((node) => {
    if (node.parent_menu_id && byId.has(node.parent_menu_id)) {
      byId.get(node.parent_menu_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: MenuNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order);
    arr.forEach((n) => n.children && sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** 권한 배열을 menu_code -> Permission Map 으로 변환 (룩업 O(1)) */
export function indexByMenuCode(perms: Permission[]): Map<string, Permission> {
  return new Map(perms.map((p) => [p.menu_code, p]));
}

/** 권한 체크 */
export function can(
  permMap: Map<string, Permission> | undefined,
  menu_code: string,
  action: Action,
): boolean {
  if (!permMap) return false;
  const p = permMap.get(menu_code);
  if (!p) return false;
  return p[`can_${action}` as const];
}

/** 사이드바: 사용자가 볼 수 있는 메뉴만 트리 필터링 (read 권한 기준) */
export function filterVisibleMenus(
  tree: MenuNode[],
  permMap: Map<string, Permission>,
  role: 'admin' | 'manager' | 'worker',
): MenuNode[] {
  return tree
    .map((node) => {
      const children = node.children ? filterVisibleMenus(node.children, permMap, role) : undefined;
      // 그룹 노드(path 없음)는 자식이 하나라도 보이면 노출
      if (!node.path) {
        if (node.is_admin_only && role !== 'admin') return null;
        if (children && children.length > 0) return { ...node, children } as MenuNode;
        return null;
      }
      // 리프 노드: admin_only면 admin만, 아니면 read 권한 체크
      if (node.is_admin_only && role !== 'admin') return null;
      if (role === 'admin') return { ...node, children } as MenuNode;
      return can(permMap, node.menu_code, 'read') ? ({ ...node, children } as MenuNode) : null;
    })
    .filter((n): n is MenuNode => n !== null);
}

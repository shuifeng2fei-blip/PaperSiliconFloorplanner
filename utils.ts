
import { ModuleNode, TechNodeConfig, AreaBreakdown, LayoutRect, OverlapMarker } from './types';

const GLOBAL_MARGIN = 24; 
const GLOBAL_HEADER = 36;
const INTER_MODULE_GAP = 16; 

/**
 * 查找指定 ID 的模块节点
 */
export const findModuleById = (node: ModuleNode, id: string): ModuleNode | null => {
  const realId = id.split(':')[0];
  if (node.id === realId) return node;
  for (const child of (node.children || [])) {
    const found = findModuleById(child, id);
    if (found) return found;
  }
  return null;
};

/**
 * 计算模块的物理尺寸及其统计信息
 */
export const calculatePhysicalSize = (node: ModuleNode, config: TechNodeConfig): { w: number, h: number, stats: AreaBreakdown } => {
  const regArea = (node.registers || 0) * config.dffArea;
  const memArea = (node.memoryBits || 0) * config.sramAreaPerBit;
  const logicArea = (node.logicGates || 0) * config.gateArea;
  const rawLocalArea = regArea + memArea + logicArea;
  const localArea = rawLocalArea / config.utilization;
  
  const childrenInfo = (node.children || []).map(c => ({
    node: c,
    ...calculatePhysicalSize(c, config)
  }));

  const childrenAreaSum = childrenInfo.reduce((acc, c) => acc + (c.w * c.h), 0);
  const totalContentArea = localArea + childrenAreaSum;

  const effectiveInternalAR = node.isRatioLinked ? node.aspectRatio : (node.internalAspectRatio || 1.0);
  const ratio = node.aspectRatio || 1.0;
  
  const idealH = Math.sqrt(totalContentArea / ratio);
  const idealW = idealH * ratio;

  const hL = Math.sqrt(localArea / effectiveInternalAR);
  const wL = hL * effectiveInternalAR;
  
  let maxContentX = (node.internalX || 0) + wL;
  let maxContentY = (node.internalY || 0) + hL;

  childrenInfo.forEach(c => {
    maxContentX = Math.max(maxContentX, (c.node.x || 0) + c.w);
    maxContentY = Math.max(maxContentY, (c.node.y || 0) + c.h);
  });

  const finalW = Math.max(idealW, maxContentX + GLOBAL_MARGIN * 2);
  const finalH = Math.max(idealH, maxContentY + GLOBAL_MARGIN * 2 + GLOBAL_HEADER);

  // Physical constraints based on sub-components placement
  const W_min = maxContentX + GLOBAL_MARGIN * 2;
  const H_min = maxContentY + GLOBAL_MARGIN * 2 + GLOBAL_HEADER;
  
  const minFeasibleRatio = (W_min * W_min) / totalContentArea;
  const maxFeasibleRatio = totalContentArea / (H_min * H_min);

  const stats: AreaBreakdown = {
    id: node.id,
    name: node.name,
    localArea,
    childrenArea: childrenAreaSum,
    totalArea: finalW * finalH,
    regArea,
    memArea,
    logicArea,
    utilizationOverhead: (finalW * finalH * config.utilization) - rawLocalArea,
    calculatedWidth: finalW,
    calculatedHeight: finalH,
    idealWidth: idealW,
    idealHeight: idealH,
    minFeasibleRatio: Math.min(minFeasibleRatio, maxFeasibleRatio),
    maxFeasibleRatio: Math.max(minFeasibleRatio, maxFeasibleRatio)
  };

  return { w: finalW, h: finalH, stats };
};

export const performLayout = (root: ModuleNode, config: TechNodeConfig): { rects: LayoutRect[], rootW: number, rootH: number } => {
  const rects: LayoutRect[] = [];

  const place = (node: ModuleNode, absX: number, absY: number, parentId: string = 'global') => {
    const { w, h, stats } = calculatePhysicalSize(node, config);
    rects.push({ id: node.id, parentId, name: node.name, x: absX, y: absY, w, h, isInternal: false, actualNode: node });

    const effectiveInternalAR = node.isRatioLinked ? node.aspectRatio : (node.internalAspectRatio || 1.0);
    const hL = Math.sqrt(stats.localArea / effectiveInternalAR);
    const wL = hL * effectiveInternalAR;
    
    rects.push({ 
      id: `${node.id}:internal`, 
      parentId: node.id, 
      name: '[Local Logic]', 
      x: absX + GLOBAL_MARGIN + (node.internalX || 0), 
      y: absY + GLOBAL_HEADER + (node.internalY || 0), 
      w: wL, h: hL, 
      isInternal: true, 
      actualNode: node 
    });

    (node.children || []).forEach(child => {
      place(child, absX + GLOBAL_MARGIN + (child.x || 0), absY + GLOBAL_HEADER + (child.y || 0), node.id);
    });
  };

  const rootResult = calculatePhysicalSize(root, config);
  place(root, 0, 0, 'root_parent');
  return { rects, rootW: rootResult.w, rootH: rootResult.h };
};

export const checkOverlapsInModule = (node: ModuleNode, config: TechNodeConfig): OverlapMarker[] => {
  const { stats } = calculatePhysicalSize(node, config);
  const effectiveInternalAR = node.isRatioLinked ? node.aspectRatio : (node.internalAspectRatio || 1.0);
  const localH = Math.sqrt(stats.localArea / effectiveInternalAR);
  const localW = localH * effectiveInternalAR;

  const blocks = [
    { id: 'internal', name: '[Local Logic]', x: node.internalX || 0, y: node.internalY || 0, w: localW, h: localH },
    ...(node.children || []).map(c => {
      const size = calculatePhysicalSize(c, config);
      return { id: c.id, name: c.name, x: c.x || 0, y: c.y || 0, w: size.w, h: size.h };
    })
  ];

  const markers: OverlapMarker[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (xOverlap > 0 && yOverlap > 0) {
        markers.push({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), w: xOverlap, h: yOverlap, ids: [a.id, b.id] });
      }
    }
  }
  return markers;
};

export const updateNodeInTree = (root: ModuleNode, id: string, updates: Partial<ModuleNode>): ModuleNode => {
  if (root.id === id) return { ...root, ...updates };
  return { ...root, children: (root.children || []).map(child => updateNodeInTree(child, id, updates)) };
};

export const findParentOf = (node: ModuleNode, tid: string): ModuleNode | null => {
  if (!node) return null;
  const realId = tid.split(':')[0];
  if (tid.includes(':internal') && node.id === realId) return node;
  if (node.children?.some(c => c.id === realId)) return node;
  for (const child of (node.children || [])) {
    const found = findParentOf(child, tid);
    if (found) return found;
  }
  return null;
};

export const deleteNodeInTree = (root: ModuleNode, id: string): ModuleNode | null => {
  if (root.id === id) return null;
  return { ...root, children: root.children.map(child => deleteNodeInTree(child, id)).filter((c): c is ModuleNode => c !== null) };
};

export const addNodeToParent = (root: ModuleNode, pId: string, newNode: ModuleNode): ModuleNode => {
  if (root.id === pId) return { ...root, children: [...(root.children || []), newNode] };
  return { ...root, children: root.children.map(child => addNodeToParent(child, pId, newNode)) };
};

export const generateHtmlReport = (root: ModuleNode, techName: string): string => {
  return `<!DOCTYPE html><html><head><title>Area Report</title><style>body{font-family:monospace;background:#0f172a;color:#f1f5f9;padding:2rem;}</style></head><body><h1>Floorplan Area Report - ${root.name}</h1><p>Technology: ${techName}</p><hr/><pre>${JSON.stringify(root, null, 2)}</pre></body></html>`;
};

/**
 * 改进版拓扑压缩算法 (Shape-Preserving Compaction)
 * 仅移动坐标，不修改子模块的 aspectRatio
 */
export const organizeChildrenMosaic = (node: ModuleNode, config: TechNodeConfig): ModuleNode => {
  const hasChildren = node.children && node.children.length > 0;

  // 如果没有子模块，只负责将内部逻辑归零对齐，不触动任何比例
  if (!hasChildren) {
    return { ...node, internalX: 0, internalY: 0 };
  }

  const { stats } = calculatePhysicalSize(node, config);
  const effectiveInternalAR = node.isRatioLinked ? node.aspectRatio : (node.internalAspectRatio || 1.0);
  const localH = Math.sqrt(stats.localArea / effectiveInternalAR);
  const localW = localH * effectiveInternalAR;

  // 1. 准备实体
  const entities = [
    { isLocal: true, id: 'internal', x: node.internalX || 0, y: node.internalY || 0, w: localW, h: localH },
    ...(node.children || []).map(c => {
      const size = calculatePhysicalSize(c, config);
      return { isLocal: false, id: c.id, x: c.x || 0, y: c.y || 0, w: size.w, h: size.h, original: c };
    })
  ];

  // 2. 纵向压缩
  entities.sort((a, b) => a.y - b.y || a.x - b.x);
  entities.forEach(entity => {
    let bestY = 0;
    for (const other of entities) {
      if (other === entity) break;
      const xOverlap = Math.min(entity.x + entity.w, other.x + other.w) - Math.max(entity.x, other.x);
      if (xOverlap > 1) {
        bestY = Math.max(bestY, other.y + other.h + INTER_MODULE_GAP);
      }
    }
    entity.y = bestY;
  });

  // 3. 横向压缩
  entities.sort((a, b) => a.x - b.x || a.y - b.y);
  entities.forEach(entity => {
    let bestX = 0;
    for (const other of entities) {
      if (other === entity) break;
      const yOverlap = Math.min(entity.y + entity.h, other.y + other.h) - Math.max(entity.y, other.y);
      if (yOverlap > 1) {
        bestX = Math.max(bestX, other.x + other.w + INTER_MODULE_GAP);
      }
    }
    entity.x = bestX;
  });

  // 4. 应用坐标更新
  const localLogic = entities.find(e => e.isLocal)!;
  const updatedChildren = entities
    .filter((e): e is { isLocal: boolean; id: string; x: number; y: number; w: number; h: number; original: ModuleNode } => !e.isLocal)
    .map(e => ({ ...e.original, x: e.x, y: e.y }));

  // 5. 重新计算当前“容器”的理想 aspectRatio
  let maxX = localLogic.x + localLogic.w;
  let maxY = localLogic.y + localLogic.h;
  updatedChildren.forEach(c => {
    const size = calculatePhysicalSize(c, config);
    maxX = Math.max(maxX, c.x + size.w);
    maxY = Math.max(maxY, c.y + size.h);
  });

  const finalContentW = maxX + GLOBAL_MARGIN * 2;
  const finalContentH = maxY + GLOBAL_MARGIN * 2 + GLOBAL_HEADER;
  const actualRatio = Number((finalContentW / finalContentH).toFixed(2));

  return { 
    ...node, 
    internalX: localLogic.x, 
    internalY: localLogic.y, 
    children: updatedChildren, 
    aspectRatio: actualRatio,
    internalAspectRatio: node.isRatioLinked ? actualRatio : node.internalAspectRatio
  };
};

/**
 * 递归优化布局
 */
export const optimizeLayoutRecursive = (node: ModuleNode, config: TechNodeConfig): ModuleNode => {
  const optimizedChildren = (node.children || []).map(child => optimizeLayoutRecursive(child, config));
  const baseNode = { ...node, children: optimizedChildren };
  return organizeChildrenMosaic(baseNode, config);
};

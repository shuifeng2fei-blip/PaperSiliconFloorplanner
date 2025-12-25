
export interface ModuleNode {
  id: string;
  name: string;
  registers: number;
  memoryBits: number;
  logicGates: number;
  // Physical Geometry (Manual Control)
  x: number; // relative to parent in um
  y: number; // relative to parent in um
  internalX: number; // relative to parent
  internalY: number; // relative to parent
  aspectRatio: number; // width / height of the module container (Target)
  internalAspectRatio: number; 
  isRatioLinked: boolean; 
  children: ModuleNode[];
  color?: string;
}

export interface TechNodeConfig {
  name: string;
  dffArea: number; 
  gateArea: number; 
  sramAreaPerBit: number; 
  utilization: number; 
}

export interface AreaBreakdown {
  id: string;
  name: string;
  localArea: number;
  childrenArea: number;
  totalArea: number; // Real physical area based on envelope
  regArea: number;
  memArea: number;
  logicArea: number;
  utilizationOverhead: number;
  calculatedWidth: number;
  calculatedHeight: number;
  idealWidth: number;
  idealHeight: number;
  // Physical constraints based on sub-components placement
  minFeasibleRatio: number;
  maxFeasibleRatio: number;
}

export interface LayoutRect {
  id: string;
  parentId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isInternal: boolean;
  actualNode: ModuleNode;
}

export interface OverlapMarker {
  x: number;
  y: number;
  w: number;
  h: number;
  ids: [string, string];
}

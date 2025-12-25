
import React, { useRef, useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { ModuleNode, TechNodeConfig } from '../types';
// Fixed: Using calculatePhysicalSize instead of non-existent calculateArea
import { calculatePhysicalSize } from '../utils';

interface FloorplanProps {
  data: ModuleNode;
  config: TechNodeConfig;
  selectedId: string;
  onSelectNode: (node: ModuleNode) => void;
  onUpdateNode: (id: string, updates: Partial<ModuleNode>) => void;
}

const FloorplanView: React.FC<FloorplanProps> = ({ data, config, selectedId, onSelectNode, onUpdateNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.05 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // In um
  const [draggingNode, setDraggingNode] = useState<{ id: string; startX: number; startY: number; mouseStartX: number; mouseStartY: number } | null>(null);

  // Flatten the module tree for rendering and pre-calculate areas
  const flattenedNodes = useMemo(() => {
    const nodes: { node: ModuleNode; stats: any }[] = [];
    const traverse = (node: ModuleNode) => {
      // Fixed: Use calculatePhysicalSize and extract stats property
      const result = calculatePhysicalSize(node, config);
      nodes.push({ node, stats: result.stats });
      node.children.forEach(traverse);
    };
    traverse(data);
    return nodes;
  }, [data, config]);

  // Sync D3 zoom with React state
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.0001, 100])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    svg.call(zoomBehavior);
    
    // Initial view setup
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(300, 200).scale(0.015));
  }, []);

  const handlePointerDown = (e: React.PointerEvent, node: ModuleNode) => {
    e.stopPropagation();
    onSelectNode(node);
    setDraggingNode({
      id: node.id,
      startX: node.x,
      startY: node.y,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
    });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Update mouse coordinate display
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const umX = (rawX - transform.x) / transform.k;
      const umY = (rawY - transform.y) / transform.k;
      setMousePos({ x: umX, y: umY });
    }

    if (!draggingNode) return;

    // Convert screen pixels to internal um units for movement
    const dx = (e.clientX - draggingNode.mouseStartX) / transform.k;
    const dy = (e.clientY - draggingNode.mouseStartY) / transform.k;

    onUpdateNode(draggingNode.id, {
      x: draggingNode.startX + dx,
      y: draggingNode.startY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingNode) {
      setDraggingNode(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
    }
  };

  // Generate ruler ticks based on zoom level
  const rulerTicks = useMemo(() => {
    const step = 5000; // um per tick
    const ticks = [];
    for (let i = 0; i < 20; i++) {
        ticks.push(i * step);
    }
    return ticks;
  }, []);

  return (
    <div className="relative w-full h-[640px] bg-[#020617] border border-slate-800 rounded-xl overflow-hidden cursor-move shadow-2xl">
      {/* Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1e293b 1px, transparent 1px),
            linear-gradient(to bottom, #1e293b 1px, transparent 1px)
          `,
          backgroundSize: `${10000 * transform.k}px ${10000 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`
        }}
      />

      {/* Overlays */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-md border border-slate-700">
          <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Cursor Pos</p>
          <p className="text-[11px] font-mono text-slate-300">
            X: {Math.round(mousePos.x).toLocaleString()} μm<br/>
            Y: {Math.round(mousePos.y).toLocaleString()} μm
          </p>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-md border border-slate-700 flex flex-col items-end">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ruler Scale</p>
            <div className="mt-1 border-b border-sky-500 flex items-end h-4" style={{ width: `${10000 * transform.k}px` }}>
                <span className="text-[8px] font-mono text-sky-400 mb-0.5">10,000 μm</span>
            </div>
        </div>
      </div>

      <svg 
        ref={svgRef} 
        className="w-full h-full outline-none touch-none"
        onPointerMove={handlePointerMove}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {flattenedNodes.map(({ node, stats }) => {
            const isSelected = selectedId === node.id;
            const isDragging = draggingNode?.id === node.id;
            const w = stats.calculatedWidth;
            const h = stats.calculatedHeight;

            return (
              <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                onPointerDown={(e) => handlePointerDown(e, node)}
                onPointerUp={handlePointerUp}
              >
                {/* Main Module Rect */}
                <rect
                  width={w}
                  height={h}
                  fill={isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)'}
                  stroke={isSelected ? '#38bdf8' : '#475569'}
                  strokeWidth={isSelected ? 60 / transform.k : 20 / transform.k}
                  rx={40 / transform.k}
                  className="transition-colors duration-200"
                />
                
                {/* Labels */}
                <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  <text
                    x={w / 2}
                    y={h / 2}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={isSelected ? '#7dd3fc' : '#f1f5f9'}
                    fontWeight="800"
                    style={{ fontSize: `${Math.min(w * 0.12, h * 0.12, 600)}px` }}
                  >
                    {node.name}
                  </text>
                  
                  <text
                    x={w / 2}
                    y={h / 2 + (h * 0.15)}
                    textAnchor="middle"
                    style={{ fontSize: `${Math.min(w * 0.06, h * 0.06, 300)}px` }}
                    fill="#94a3b8"
                  >
                    {(stats.totalArea / 1e6).toFixed(3)} mm²
                  </text>
                </g>

                {/* Resizing constraint feedback */}
                <text 
                  x={100/transform.k} 
                  y={-50/transform.k} 
                  fill="#475569" 
                  fontSize={80/transform.k}
                  fontWeight="bold"
                >
                    {Math.round(w)} x {Math.round(h)} μm
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-slate-700 px-3 py-1 rounded text-[10px] font-mono text-slate-400">
        Scale: 1px = {(1 / transform.k).toFixed(0)} μm
      </div>
    </div>
  );
};

export default FloorplanView;

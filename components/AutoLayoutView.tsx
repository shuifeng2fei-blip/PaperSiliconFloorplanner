
import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { ModuleNode, TechNodeConfig, LayoutRect, OverlapMarker } from '../types';
import { performLayout, findParentOf, findModuleById, calculatePhysicalSize } from '../utils';

interface AutoLayoutViewProps {
  data: ModuleNode;
  config: TechNodeConfig;
  selectedId: string;
  overlapMarkers: OverlapMarker[];
  onSelectNode: (id: string) => void;
  onDeselect: () => void;
  onUpdateNode: (id: string, updates: Partial<ModuleNode>) => void;
}

const AutoLayoutView: React.FC<AutoLayoutViewProps> = ({ data, config, selectedId, overlapMarkers, onSelectNode, onDeselect, onUpdateNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  
  const dataRef = useRef(data);
  const configRef = useRef(config);
  const selectedIdRef = useRef(selectedId);
  const onUpdateNodeRef = useRef(onUpdateNode);
  const onSelectNodeRef = useRef(onSelectNode);

  const layout = useMemo(() => {
    return performLayout(data, config);
  }, [data, config]);

  const layoutRef = useRef(layout);

  useEffect(() => {
    dataRef.current = data;
    configRef.current = config;
    layoutRef.current = layout;
    selectedIdRef.current = selectedId;
    onUpdateNodeRef.current = onUpdateNode;
    onSelectNodeRef.current = onSelectNode;
  }, [data, config, layout, selectedId, onUpdateNode, onSelectNode]);

  const colorScale = useMemo(() => d3.scaleOrdinal(d3.schemeTableau10), []);

  const resolveTargetRect = (rect: LayoutRect | null): LayoutRect | null => {
    if (!rect) return null;
    if (rect.isInternal) {
      const ownerModule = findModuleById(dataRef.current, rect.id);
      if (ownerModule && (!ownerModule.children || ownerModule.children.length === 0)) {
        const moduleRect = layoutRef.current.rects.find(r => r.id === ownerModule.id && !r.isInternal);
        return moduleRect || rect;
      }
    }
    return rect;
  };

  const getSmallestRectAt = (x: number, y: number): LayoutRect | null => {
    const hits = layoutRef.current.rects.filter(r => 
      x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
    if (hits.length === 0) return null;
    return hits.reduce((prev, curr) => (curr.w * curr.h < prev.w * prev.h ? curr : prev));
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = d3.select(containerRef.current);
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.0001, 2000])
      .filter((event) => {
        const transform = d3.zoomTransform(svgRef.current!);
        const [mx, my] = d3.pointer(event, svgRef.current);
        const x = (mx - transform.x) / transform.k;
        const y = (my - transform.y) / transform.k;
        const hit = resolveTargetRect(getSmallestRectAt(x, y));
        return !event.button && (!hit || hit.id === 'root' || event.ctrlKey);
      })
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    let startX = 0, startY = 0, nodeStartX = 0, nodeStartY = 0;
    let currentDragging: LayoutRect | null = null;
    let dragParent: ModuleNode | null = null;
    let rafId: number | null = null;

    const dragBehavior = d3.drag<SVGSVGElement, unknown>()
      .subject((event) => {
        const transform = d3.zoomTransform(svgRef.current!);
        const x = (event.x - transform.x) / transform.k;
        const y = (event.y - transform.y) / transform.k;
        const hit = getSmallestRectAt(x, y);
        return resolveTargetRect(hit && hit.id !== 'root' ? hit : null);
      })
      .on('start', function(event) {
        const d = event.subject as LayoutRect;
        if (!d) return;

        currentDragging = d;
        dragParent = findParentOf(dataRef.current, d.id);
        setDraggingId(d.id);
        onSelectNodeRef.current(d.id);

        startX = event.x;
        startY = event.y;
        
        if (dragParent) {
          if (d.isInternal) {
            nodeStartX = dragParent.internalX || 0;
            nodeStartY = dragParent.internalY || 0;
          } else {
            nodeStartX = d.actualNode.x || 0;
            nodeStartY = d.actualNode.y || 0;
          }
        }
      })
      .on('drag', function(event) {
        if (!currentDragging || !dragParent) return;
        const d = currentDragging;
        const p = dragParent;
        
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const transform = d3.zoomTransform(svgRef.current!);
          const dx = (event.x - startX) / transform.k;
          const dy = (event.y - startY) / transform.k;
          
          if (d.isInternal) {
            onUpdateNodeRef.current(p.id, {
              internalX: Math.max(0, nodeStartX + dx),
              internalY: Math.max(0, nodeStartY + dy)
            });
          } else {
            onUpdateNodeRef.current(d.id, {
              x: Math.max(0, nodeStartX + dx),
              y: Math.max(0, nodeStartY + dy)
            });
          }
        });
      })
      .on('end', function() {
        setDraggingId(null);
        currentDragging = null;
        dragParent = null;
        if (rafId) cancelAnimationFrame(rafId);
      });

    svg.call(dragBehavior as any);

    svg.on('mousemove.hover', (event) => {
      const transform = d3.zoomTransform(svgRef.current!);
      const [mx, my] = d3.pointer(event, svgRef.current);
      const x = (mx - transform.x) / transform.k;
      const y = (my - transform.y) / transform.k;
      const rawHit = getSmallestRectAt(x, y);
      const hit = resolveTargetRect(rawHit);
      setHoverId(prev => prev !== hit?.id ? (hit?.id || null) : prev);
    });

    svg.on('click', (event) => {
      if (event.defaultPrevented) return;
      const transform = d3.zoomTransform(svgRef.current!);
      const [mx, my] = d3.pointer(event, svgRef.current);
      const x = (mx - transform.x) / transform.k;
      const y = (my - transform.y) / transform.k;
      const rawHit = getSmallestRectAt(x, y);
      const hit = resolveTargetRect(rawHit);
      if (hit) {
        onSelectNodeRef.current(hit.id);
      } else {
        onDeselect();
      }
    });

    const sw = svgRef.current.clientWidth;
    const sh = svgRef.current.clientHeight;
    if (sw > 0 && sh > 0) {
      const initialScale = Math.min((sw - 160) / (layoutRef.current.rootW || 1), (sh - 160) / (layoutRef.current.rootH || 1));
      svg.call(zoom.transform, d3.zoomIdentity
        .translate(sw/2 - (layoutRef.current.rootW * initialScale)/2, sh/2 - (layoutRef.current.rootH * initialScale)/2)
        .scale(initialScale)
      );
    }

    return () => {
      svg.on('.drag', null);
      svg.on('.zoom', null);
      svg.on('mousemove.hover', null);
      svg.on('click', null);
    };
  }, []);

  const globalOverlapMarkers = useMemo(() => {
    if (!overlapMarkers.length || !selectedId) return [];
    const realId = selectedId.split(':')[0];
    const parentRect = layout.rects.find(r => r.id === realId && !r.isInternal);
    if (!parentRect) return [];

    const GLOBAL_MARGIN = 24;
    const GLOBAL_HEADER = 36;
    
    return overlapMarkers.map(m => ({
      ...m,
      globalX: parentRect.x + GLOBAL_MARGIN + m.x,
      globalY: parentRect.y + GLOBAL_HEADER + m.y
    }));
  }, [overlapMarkers, selectedId, layout.rects]);

  // Visual helper: Find the "Ideal Outline" for the selected node
  const idealOutline = useMemo(() => {
    if (!selectedId) return null;
    const realId = selectedId.split(':')[0];
    const targetRect = layout.rects.find(r => r.id === realId && !r.isInternal);
    if (!targetRect) return null;

    const { stats } = calculatePhysicalSize(targetRect.actualNode, config);
    return {
      x: targetRect.x,
      y: targetRect.y,
      w: stats.idealWidth,
      h: stats.idealHeight
    };
  }, [selectedId, layout.rects, config]);

  return (
    <div className="relative w-full h-full bg-[#010409] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" 
           style={{ backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="absolute top-0 left-0 w-full h-10 bg-slate-900/90 border-b border-slate-800 z-20 flex items-center px-4 justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_#0ea5e9]" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Adaptive Floorplan Canvas v2.1</span>
        </div>
        <div className="flex items-center gap-4 text-[9px] text-slate-500 font-bold uppercase">
           {overlapMarkers.length > 0 && <span className="text-red-500 animate-bounce">⚠️ {overlapMarkers.length} Overlaps Detected</span>}
           <span className="text-sky-400">Low-Latency Mode: Active</span>
           <span className="text-slate-700">|</span>
           <span className="text-slate-400 font-mono">{Math.round(layout.rootW)} x {Math.round(layout.rootH)} μm</span>
        </div>
      </div>

      <svg ref={svgRef} className="w-full h-full outline-none touch-none cursor-crosshair will-change-transform">
        <g ref={containerRef}>
          {layout.rects.map((d) => {
            const isSelected = selectedId === d.id;
            const isHovered = hoverId === d.id;
            
            return (
              <g key={d.id} className="block-group pointer-events-none">
                <rect
                  x={d.x} y={d.y} width={Math.max(1, d.w)} height={Math.max(1, d.h)}
                  fill={d.isInternal ? (isSelected ? '#10b981' : '#1e293b') : (isSelected ? '#0ea5e9' : (d.id === 'root' ? '#0f172a' : colorScale(d.id)))}
                  fillOpacity={d.isInternal ? (isSelected ? 0.35 : (isHovered ? 0.25 : 0.15)) : (isSelected ? 0.45 : (isHovered ? 0.2 : 0.08))}
                  stroke={isSelected ? (d.isInternal ? '#34d399' : '#38bdf8') : (isHovered ? '#fff' : (d.isInternal ? '#334155' : d3.color(colorScale(d.id))?.darker(1).toString() || '#475569'))}
                  strokeWidth={isSelected ? 3 : (isHovered ? 2 : 1.2)}
                  rx={d.id === 'root' ? 12 : 6}
                  vectorEffect="non-scaling-stroke"
                />
                <text x={d.x + 10} y={d.y + 22} fill={isSelected ? '#fff' : (isHovered ? '#fff' : '#94a3b8')} fontSize={d.id === 'root' ? '14px' : '10px'} fontStyle={d.isInternal ? 'italic' : 'normal'} fontWeight="bold" style={{ opacity: d.w > 40 ? 1 : 0, transition: 'fill 0.2s' }}>
                  {d.name}
                </text>
                {(isSelected || isHovered) && (
                   <text x={d.x + 10} y={d.y + 36} fill="#64748b" fontSize="8px" fontWeight="black">
                     XY: {Math.round(d.x)},{Math.round(d.y)} μm | WH: {Math.round(d.w)}x{Math.round(d.h)}
                   </text>
                )}
              </g>
            );
          })}

          {/* Render the Ideal Outline helper */}
          {idealOutline && (
            <g className="pointer-events-none">
              <rect
                x={idealOutline.x} y={idealOutline.y} width={idealOutline.w} height={idealOutline.h}
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeDasharray="5,3"
                vectorEffect="non-scaling-stroke"
                opacity="0.6"
              />
              <text 
                x={idealOutline.x + 4} 
                y={idealOutline.y - 8} 
                fill="white" 
                fontSize="8px" 
                fontWeight="black" 
                opacity="0.8" 
                className="uppercase tracking-widest"
              >
                Target Area Envelope
              </text>
            </g>
          )}

          {globalOverlapMarkers.map((m, idx) => (
            <g key={`overlap-${idx}`} className="pointer-events-none">
              <rect 
                x={m.globalX} y={m.globalY} width={m.w} height={m.h} 
                fill="rgba(239, 68, 68, 0.4)" 
                stroke="#ef4444" 
                strokeWidth="2" 
                strokeDasharray="4,2"
                vectorEffect="non-scaling-stroke"
                className="animate-pulse"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default AutoLayoutView;

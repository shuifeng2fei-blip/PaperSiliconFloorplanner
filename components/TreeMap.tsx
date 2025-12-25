
import React, { useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ModuleNode, TechNodeConfig } from '../types';
// Fixed: Using calculatePhysicalSize instead of non-existent calculateArea
import { calculatePhysicalSize } from '../utils';

interface TreeMapProps {
  data: ModuleNode;
  config: TechNodeConfig;
  width: number;
  height: number;
  selectedId: string;
  onSelectNode: (node: ModuleNode) => void;
}

const TreeMap: React.FC<TreeMapProps> = ({ data, config, width, height, selectedId, onSelectNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const hierarchyData = useMemo(() => {
    const root = d3.hierarchy<ModuleNode>(data)
      .sum(d => {
        // TreeMap size is based on the estimated required area
        // Fixed: Use calculatePhysicalSize and access stats.totalArea
        const result = calculatePhysicalSize(d, config);
        return result.stats.totalArea;
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    return root;
  }, [data, config]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const treemapLayout = d3.treemap<ModuleNode>()
      .size([width, height])
      .paddingOuter(8)
      .paddingTop(28)
      .paddingInner(4)
      .round(true);

    // Cast to HierarchyRectangularNode because treemapLayout populates x0, y0, x1, y1
    const root = hierarchyData as d3.HierarchyRectangularNode<ModuleNode>;
    treemapLayout(root);

    const nodes = svg.selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    nodes.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => {
        if (d.data.id === selectedId) return '#0ea5e9'; // Sky-500 for selection
        return d.depth === 0 ? '#1e293b' : colorScale(d.depth.toString());
      })
      .attr('fill-opacity', d => d.data.id === selectedId ? 0.4 : 0.2)
      .attr('stroke', d => d.data.id === selectedId ? '#38bdf8' : '#334155')
      .attr('stroke-width', d => d.data.id === selectedId ? 3 : 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectNode(d.data);
      });

    nodes.append('text')
      .attr('x', 8)
      .attr('y', 18)
      .text(d => d.data.name)
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('fill', d => d.data.id === selectedId ? '#fff' : '#cbd5e1')
      .style('pointer-events', 'none')
      .style('opacity', d => (d.x1 - d.x0 > 50 && d.y1 - d.y0 > 25) ? 1 : 0);

    nodes.append('text')
      .attr('x', 8)
      .attr('y', 32)
      .text(d => `${((d.value || 0) / 1000000).toFixed(3)} mm²`)
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('fill', 'rgba(148, 163, 184, 0.8)')
      .style('pointer-events', 'none')
      .style('opacity', d => (d.x1 - d.x0 > 80 && d.y1 - d.y0 > 45) ? 1 : 0);

  }, [hierarchyData, width, height, selectedId, onSelectNode]);

  return (
    <div className="bg-[#020617] rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex justify-center items-center">
      <svg ref={svgRef} width={width} height={height} className="block" />
    </div>
  );
};

export default TreeMap;

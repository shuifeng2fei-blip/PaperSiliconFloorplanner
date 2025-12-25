
import React from 'react';
import { ModuleNode, TechNodeConfig } from '../types';
// Fixed: Using calculatePhysicalSize instead of non-existent calculateArea
import { calculatePhysicalSize } from '../utils';

interface HierarchyTreeProps {
  node: ModuleNode;
  config: TechNodeConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  level?: number;
}

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ node, config, selectedId, onSelect, level = 0 }) => {
  const isSelected = selectedId === node.id;
  // Violation tracking is disabled as actualPhysicalArea is not part of the current data model
  const isViolated = false;

  return (
    <div className="select-none">
      <div 
        onClick={() => onSelect(node.id)}
        className={`
          group flex items-center py-1 px-2 cursor-pointer border-l-2 transition-all
          ${isSelected ? 'bg-sky-600/20 border-sky-500 text-sky-100' : 'border-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {/* Status Indicator Dot */}
        <span className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${isViolated ? 'bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-emerald-500'}`} />
        
        {/* Module Icon */}
        <svg className="w-3 h-3 mr-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>

        <span className="text-[11px] font-mono truncate tracking-tight">
          {node.name}
          {node.children.length > 0 && <span className="ml-1 opacity-40 text-[9px]">({node.children.length})</span>}
        </span>
      </div>

      {node.children.length > 0 && (
        <div className="relative">
          {/* Vertical connection line */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-[1px] bg-slate-800 ml-[14px]" 
            style={{ left: `${level * 12}px` }}
          />
          {node.children.map(child => (
            <HierarchyTree 
              key={child.id} 
              node={child} 
              config={config} 
              selectedId={selectedId} 
              onSelect={onSelect} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HierarchyTree;

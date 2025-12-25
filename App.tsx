
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { ModuleNode, TechNodeConfig, OverlapMarker } from './types';
import { TECH_NODES, INITIAL_DATA } from './constants';
import { updateNodeInTree, deleteNodeInTree, addNodeToParent, calculatePhysicalSize, generateHtmlReport } from './utils';
import AutoLayoutView from './components/AutoLayoutView';
import ModuleForm from './components/ModuleForm';
import HierarchyTree from './components/HierarchyTree';

const enhanceWithGeometry = (node: any): ModuleNode => {
  const children = (node.children || []).map(enhanceWithGeometry);
  const hasChildren = children.length > 0;
  
  // 分治比例策略应用：
  // 1. 叶子节点 (hasChildren == false) 默认开启 Ratio Linked (锁定内部逻辑与外壳比例)
  // 2. 容器节点 (hasChildren == true) 默认关闭 Ratio Linked (允许内部逻辑作为独立宏单元)
  const isRatioLinked = node.isRatioLinked ?? !hasChildren;

  return {
    ...node,
    x: node.x || 0,
    y: node.y || 0,
    internalX: node.internalX || 0,
    internalY: node.internalY || 0,
    aspectRatio: node.aspectRatio || 1.0,
    internalAspectRatio: node.internalAspectRatio || node.aspectRatio || 1.0,
    isRatioLinked,
    children
  };
};

const App: React.FC = () => {
  const [data, setData] = useState<ModuleNode>(enhanceWithGeometry(INITIAL_DATA));
  const [techNode, setTechNode] = useState<TechNodeConfig>(TECH_NODES['7nm']);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlapMarkers, setOverlapMarkers] = useState<OverlapMarker[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    const realId = selectedId.split(':')[0];
    const findNode = (node: ModuleNode): ModuleNode | null => {
      if (node.id === realId) return node;
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };
    return findNode(data);
  }, [data, selectedId]);

  const handleUpdateNode = useCallback((id: string, updates: Partial<ModuleNode>) => {
    setData(prev => updateNodeInTree(prev, id, updates));
    setOverlapMarkers([]);
  }, []);

  const handleFullUpdateNode = useCallback((updatedNode: ModuleNode) => {
    setData(prev => updateNodeInTree(prev, updatedNode.id, updatedNode));
    setOverlapMarkers([]);
  }, []);

  return (
    <div className="min-h-screen bg-[#010409] text-slate-100 flex flex-col font-sans">
      <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-sky-600 rounded-lg flex items-center justify-center font-black text-white shadow-xl border border-sky-300/30">Si</div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tighter uppercase leading-none">SiliconPlanner</h1>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Adaptive Architecture</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-[10px] font-black uppercase border border-slate-700 rounded-lg hover:bg-slate-800 transition-all">Import</button>
          <input ref={fileInputRef} type="file" className="hidden" accept=".json" onChange={(e) => {
             const file = e.target.files?.[0];
             if (!file) return;
             const reader = new FileReader();
             reader.onload = (event) => {
               try { setData(enhanceWithGeometry(JSON.parse(event.target?.result as string))); } catch(e) { alert("Invalid JSON"); }
             };
             reader.readAsText(file);
          }} />
          <button onClick={() => {
            const blob = new Blob([generateHtmlReport(data, techNode.name)], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `report_${data.name}.html`;
            a.click();
          }} className="px-5 py-2 text-[10px] font-black uppercase bg-sky-600 hover:bg-sky-500 rounded-lg transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)]">Export Report</button>
        </div>
      </nav>

      <main className="flex-grow flex p-6 gap-6 overflow-hidden">
        <aside className="w-64 flex flex-col bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shrink-0">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logic Hierarchy</h3>
          </div>
          <div className="flex-grow overflow-y-auto py-3 custom-scrollbar">
            <HierarchyTree node={data} config={techNode} selectedId={selectedId || ''} onSelect={setSelectedId} />
          </div>
        </aside>

        <section className="flex-grow flex flex-col gap-6 overflow-hidden min-w-0">
          <div className="flex items-end justify-between px-1 shrink-0">
            <div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Root Context</span>
              <h2 className="text-3xl font-black text-white font-mono truncate tracking-tight">{data.name}</h2>
            </div>
            <div className="flex items-center gap-4 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800 shadow-inner">
               <span className="px-3 text-[10px] font-black text-slate-500 uppercase">Tech Node</span>
               <select 
                value={techNode.name}
                onChange={(e) => {
                  const node = Object.values(TECH_NODES).find(n => n.name === e.target.value);
                  if (node) setTechNode(node);
                }}
                className="bg-slate-800 text-xs font-black px-4 py-2 rounded-lg outline-none text-sky-400 cursor-pointer hover:bg-slate-750 transition-colors"
              >
                {Object.values(TECH_NODES).map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
              </select>
            </div>
          </div>

          <div className="relative flex-grow min-h-0 bg-[#00040a] rounded-2xl overflow-hidden border border-slate-800 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)]">
             <AutoLayoutView 
                data={data} 
                config={techNode} 
                selectedId={selectedId || ''}
                onSelectNode={setSelectedId}
                onDeselect={() => setSelectedId(null)}
                onUpdateNode={handleUpdateNode}
                overlapMarkers={overlapMarkers}
             />
          </div>
        </section>

        <aside className="w-80 flex flex-col gap-6 shrink-0 overflow-y-auto custom-scrollbar pr-1">
          <ModuleForm 
            node={selectedNode}
            virtualId={selectedId}
            config={techNode}
            onUpdate={handleUpdateNode}
            onFullUpdate={handleFullUpdateNode}
            onShowOverlaps={setOverlapMarkers}
            onAddChild={(parentId) => {
              const newId = `m_${Date.now()}`;
              setData(prev => addNodeToParent(prev, parentId, {
                id: newId, name: 'BLOCK_NEW', registers: 1000, memoryBits: 0, logicGates: 5000,
                x: 20, y: 20, internalX: 0, internalY: 0, aspectRatio: 1.0, internalAspectRatio: 1.0, isRatioLinked: false, children: []
              }));
              setSelectedId(newId);
            }}
            onDelete={(id) => {
              if (id === 'root') return;
              const newData = deleteNodeInTree(data, id);
              if (newData) { setData(newData); setSelectedId(null); }
            }}
          />

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-2xl shrink-0 backdrop-blur-sm">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5 border-b border-slate-800 pb-2">Physical Performance</h3>
             {(() => {
                const targetNode = selectedNode || data;
                const { stats } = calculatePhysicalSize(targetNode, techNode);
                
                const logicSum = stats.regArea + stats.memArea + stats.logicArea;
                const density = (logicSum / stats.totalArea) * 100;
                
                return (
                  <div className="space-y-6">
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Total Die Usage</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-mono font-black text-white">{(stats.totalArea / 1e6).toFixed(4)}</p>
                        <span className="text-slate-500 text-xs font-bold uppercase">mm²</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className="text-slate-500">Density Utilization</span>
                        <span className={density > techNode.utilization * 100 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>{density.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                         <div 
                          className={`h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${density > techNode.utilization * 100 ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`} 
                          style={{ width: `${Math.min(100, density)}%` }}
                         />
                      </div>
                      <div className="flex justify-between items-center text-[8px] text-slate-500 italic">
                        <span>Min Logic Area: {(logicSum / 1e6).toFixed(3)}mm²</span>
                        <span>Target: {techNode.utilization * 100}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase text-slate-400">
                       <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">Logic Area: {Math.round(stats.logicArea/1000)}k μm²</div>
                       <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg">Mem Area: {Math.round(stats.memArea/1000)}k μm²</div>
                    </div>
                  </div>
                );
             })()}
          </div>
        </aside>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; border: 1px solid #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
};

export default App;

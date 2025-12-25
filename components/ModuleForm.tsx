
import React, { useState, useMemo } from 'react';
import { ModuleNode, TechNodeConfig, OverlapMarker } from '../types';
import { organizeChildrenMosaic, checkOverlapsInModule, optimizeLayoutRecursive, calculatePhysicalSize } from '../utils';

interface ModuleFormProps {
  node: ModuleNode | null;
  virtualId: string | null;
  config: TechNodeConfig; 
  onUpdate: (id: string, updates: Partial<ModuleNode>) => void;
  onFullUpdate: (node: ModuleNode) => void;
  onShowOverlaps: (markers: OverlapMarker[]) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}

const ModuleForm: React.FC<ModuleFormProps> = ({ node, virtualId, config, onUpdate, onFullUpdate, onShowOverlaps, onAddChild, onDelete }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deepOptimize, setDeepOptimize] = useState(false);

  const toDisplayAR = (ratio: number) => {
    if (!ratio || ratio <= 0) return 1.0;
    if (ratio >= 1) return Number(ratio.toFixed(2));
    return Number(-(1 / ratio).toFixed(2));
  };

  const fromDisplayAR = (val: number) => {
    if (val === 0) return 1.0;
    if (val > 0) return val;
    return 1 / Math.abs(val);
  };

  const stats = useMemo(() => {
    if (!node) return null;
    return calculatePhysicalSize(node, config).stats;
  }, [node, config]);

  const actualRatio = useMemo(() => {
    if (!stats) return 1.0;
    return stats.calculatedWidth / stats.calculatedHeight;
  }, [stats]);

  const rangeInfo = useMemo(() => {
    if (!stats || !node || node.children.length === 0) return null;
    
    const logMin = Math.log(stats.minFeasibleRatio);
    const logMax = Math.log(stats.maxFeasibleRatio);
    const logCurrent = Math.log(node.aspectRatio);
    
    const viewMin = Math.min(logMin, logCurrent, -1.1);
    const viewMax = Math.max(logMax, logCurrent, 1.1);
    const pad = (viewMax - viewMin) * 0.1;
    const finalMin = viewMin - pad;
    const finalMax = viewMax + pad;
    const width = finalMax - finalMin;

    const getPos = (l: number) => ((l - finalMin) / width) * 100;

    return {
      dMin: toDisplayAR(stats.minFeasibleRatio),
      dMax: toDisplayAR(stats.maxFeasibleRatio),
      minPos: getPos(logMin),
      maxPos: getPos(logMax),
      currentPos: getPos(logCurrent)
    };
  }, [stats, node?.aspectRatio, node?.children?.length]);

  if (!node || !virtualId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 shadow-inner">
           <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
        </div>
        <h3 className="text-slate-300 font-bold mb-2">No Selection</h3>
        <p className="text-slate-500 text-xs leading-relaxed">Select a module to edit physical constraints.</p>
      </div>
    );
  }

  const isInternalSelected = virtualId.endsWith(':internal');
  const isLinked = node.isRatioLinked ?? false;
  const currentAR = node.aspectRatio;
  const inDeadZone = stats ? (currentAR < stats.minFeasibleRatio - 0.001 || currentAR > stats.maxFeasibleRatio + 0.001) : false;

  const handleTidyUp = () => {
    setErrorMsg(null);
    onShowOverlaps([]);
    const organized = organizeChildrenMosaic(node, config);
    onFullUpdate(organized);
  };

  const handleOptimize = () => {
    setErrorMsg(null);
    const overlaps = checkOverlapsInModule(node, config);
    if (overlaps.length > 0) {
      onShowOverlaps(overlaps);
      setErrorMsg(`[SAFETY FENCE] Detected ${overlaps.length} physical overlaps.`);
      return;
    }
    onShowOverlaps([]);
    const result = deepOptimize ? optimizeLayoutRecursive(node, config) : organizeChildrenMosaic(node, config);
    onFullUpdate(result);
  };

  const handleUpdateAR = (val: number) => {
    if (val === 0) return;
    const physicalVal = fromDisplayAR(val);
    const updates: Partial<ModuleNode> = { aspectRatio: physicalVal };
    if (isLinked) updates.internalAspectRatio = physicalVal;
    onUpdate(node.id, updates);
  };

  const handleSnapToFeasible = () => {
    if (!stats) return;
    let target = currentAR;
    if (currentAR < stats.minFeasibleRatio) target = stats.minFeasibleRatio;
    else if (currentAR > stats.maxFeasibleRatio) target = stats.maxFeasibleRatio;
    handleUpdateAR(toDisplayAR(target));
  };

  return (
    <div className="space-y-6 p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-xl text-slate-100 animate-in fade-in slide-in-from-right-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isInternalSelected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-sky-500 shadow-[0_0_10px_#0ea5e9]'}`} />
          <h3 className="text-lg font-black truncate tracking-tight uppercase">
            {isInternalSelected ? `MACRO: ${node.name}` : node.name}
          </h3>
        </div>
        {!isInternalSelected && <button onClick={() => onDelete(node.id)} className="text-rose-400 hover:text-rose-300 text-[10px] font-black uppercase transition-colors">Delete</button>}
      </div>

      <div className="space-y-4">
        <div className="pt-2 border-t border-slate-700/50">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Module Name</label>
          <input type="text" value={node.name} onChange={(e) => onUpdate(node.id, { name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none font-bold focus:border-sky-500 transition-colors" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Regs</label><input type="number" value={node.registers} onChange={(e) => onUpdate(node.id, { registers: +e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono" /></div>
          <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mem</label><input type="number" value={node.memoryBits} onChange={(e) => onUpdate(node.id, { memoryBits: +e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono" /></div>
          <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gates</label><input type="number" value={node.logicGates} onChange={(e) => onUpdate(node.id, { logicGates: +e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono" /></div>
        </div>

        {!isInternalSelected && (
          <div className="pt-4 border-t border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ratio Optimization</label>
               <button 
                  onClick={() => onUpdate(node.id, { isRatioLinked: !isLinked })}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${isLinked ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400'}`}
               >
                 <span className="text-[9px] font-black uppercase">{isLinked ? 'Locked' : 'Independent'}</span>
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className={`block text-[9px] font-black uppercase ${inDeadZone ? 'text-amber-500' : 'text-slate-500'}`}>Shell Ratio (Dashed)</label>
                    {inDeadZone && (
                       <button onClick={handleSnapToFeasible} className="text-[8px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-black hover:bg-amber-500 transition-colors shadow-lg">SNAP FIX</button>
                    )}
                  </div>
                  <input type="number" step="0.05" value={toDisplayAR(node.aspectRatio)} onChange={(e) => handleUpdateAR(+e.target.value)} className={`w-full bg-slate-900 border rounded-lg px-2 py-2 text-xs font-mono focus:border-sky-500 outline-none transition-colors ${inDeadZone ? 'border-amber-600 ring-1 ring-amber-600/30' : 'border-slate-700'}`} />
                  <div className="mt-1 flex justify-between items-center">
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Actual (Solid):</span>
                    <span className={`text-[9px] font-mono font-bold ${Math.abs(toDisplayAR(actualRatio) - toDisplayAR(node.aspectRatio)) > 0.05 ? 'text-sky-400' : 'text-slate-500'}`}>
                      {toDisplayAR(actualRatio)}
                    </span>
                  </div>
               </div>
               <div>
                  <label className={`block text-[9px] font-black uppercase mb-1 ${isLinked ? 'text-sky-500' : 'text-slate-500'}`}>Logic Ratio</label>
                  <input type="number" step="0.05" disabled={isLinked} value={toDisplayAR(isLinked ? node.aspectRatio : (node.internalAspectRatio || node.aspectRatio))} onChange={(e) => onUpdate(node.id, { internalAspectRatio: fromDisplayAR(+e.target.value) })} className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono outline-none ${isLinked ? 'opacity-40 select-none' : 'focus:border-emerald-500'}`} />
               </div>
            </div>

            {rangeInfo && (
              <div className="space-y-2 px-1">
                <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-slate-500">
                   <span>Portrait</span>
                   <span>1:1</span>
                   <span>Landscape</span>
                </div>
                
                <div className="relative h-6 bg-slate-900 rounded-lg overflow-hidden border border-slate-700/50 shadow-inner">
                   {/* Left Dead Zone */}
                   <div 
                    className="absolute top-0 bottom-0 left-0 bg-rose-500/10" 
                    style={{ width: `${rangeInfo.minPos}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.2) 5px, rgba(0,0,0,0.2) 10px)' }} 
                   />
                   
                   {/* Feasible Zone */}
                   <div className="absolute top-0 bottom-0 bg-sky-500/20 border-x border-sky-400/40" 
                        style={{ left: `${rangeInfo.minPos}%`, right: `${100 - rangeInfo.maxPos}%` }} />
                   
                   {/* Right Dead Zone */}
                   <div 
                    className="absolute top-0 bottom-0 right-0 bg-rose-500/10" 
                    style={{ width: `${100 - rangeInfo.maxPos}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.2) 5px, rgba(0,0,0,0.2) 10px)' }} 
                   />

                   <div className="absolute top-0 bottom-0 flex items-center justify-between px-2 w-full pointer-events-none opacity-40">
                      <span className="text-[7px] font-mono text-slate-300">[{rangeInfo.dMin}]</span>
                      <span className="text-[7px] font-mono text-slate-300">[{rangeInfo.dMax}]</span>
                   </div>

                   <div 
                    className={`absolute top-0 bottom-0 w-1 transition-all duration-300 ease-out z-10 ${inDeadZone ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'}`}
                    style={{ left: `calc(${rangeInfo.currentPos}% - 2px)` }}
                   />
                </div>
                
                <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500">
                   <div className="flex flex-col">
                      <span>Min Bound</span>
                      <span className="text-slate-300 font-mono">{rangeInfo.dMin}</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span>Max Bound</span>
                      <span className="text-slate-300 font-mono">{rangeInfo.dMax}</span>
                   </div>
                </div>
              </div>
            )}

            {inDeadZone && node.children.length > 0 && (
              <div className="p-3 bg-amber-950/30 border border-amber-600/50 rounded-xl flex gap-3 items-start shadow-lg">
                <div className="mt-1 text-amber-500 animate-pulse">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </div>
                <div className="text-[9px] text-amber-200 font-medium leading-normal">
                  <span className="text-amber-400 font-black block mb-0.5 uppercase">Physical Boundary</span>
                  Sub-modules are obstructing resizing. Tap <span className="font-bold text-white">SNAP FIX</span> or move blocks.
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-slate-700/50">
               <div className="flex items-center justify-between px-1">
                 <span className="text-[10px] font-black text-slate-500 uppercase">Recursive Depth</span>
                 <button onClick={() => setDeepOptimize(!deepOptimize)} className={`w-9 h-5 rounded-full relative transition-colors ${deepOptimize ? 'bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${deepOptimize ? 'left-5' : 'left-1'}`} />
                 </button>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleTidyUp} className="py-2.5 bg-slate-900 hover:bg-slate-950 border border-slate-700 text-sky-400 text-[10px] font-black uppercase rounded-lg transition-all">
                     Tidy Up
                  </button>
                  <button onClick={handleOptimize} className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg transition-all shadow-xl shadow-indigo-900/20">
                     Optimize
                  </button>
               </div>
            </div>
            
            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-lg">
                <p className="text-[10px] text-rose-300 font-bold">{errorMsg}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!isInternalSelected && (
        <div className="pt-4 border-t border-slate-700/50">
          <button onClick={() => onAddChild(node.id)} className="w-full py-3 bg-slate-900 hover:bg-slate-950 border border-slate-700 text-slate-300 font-black rounded-xl uppercase tracking-widest text-[10px] transition-all">Add Sub-Module</button>
        </div>
      )}
    </div>
  );
};

export default ModuleForm;

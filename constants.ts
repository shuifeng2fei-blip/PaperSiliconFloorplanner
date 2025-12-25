
import { TechNodeConfig } from './types';

export const TECH_NODES: Record<string, TechNodeConfig> = {
  '28nm': {
    name: '28nm HPC+',
    dffArea: 4.5,
    gateArea: 0.5,
    sramAreaPerBit: 0.12,
    utilization: 0.65
  },
  '7nm': {
    name: '7nm FinFET',
    dffArea: 0.48,
    gateArea: 0.06,
    sramAreaPerBit: 0.027,
    utilization: 0.70
  },
  '5nm': {
    name: '5nm EUV',
    dffArea: 0.32,
    gateArea: 0.04,
    sramAreaPerBit: 0.021,
    utilization: 0.75
  }
};

export const INITIAL_DATA = {
  id: 'root',
  name: 'SoC_Top',
  registers: 10000,
  memoryBits: 1024 * 1024, // 1Mb
  logicGates: 50000,
  aspectRatio: 1.0,
  x: 0,
  y: 0,
  internalX: 0,
  internalY: 0,
  children: [
    {
      id: 'cpu_sub',
      name: 'CPU_Cluster',
      registers: 500000,
      memoryBits: 8 * 1024 * 1024, // 8Mb L2
      logicGates: 2000000,
      aspectRatio: 1.5,
      x: 40,
      y: 40,
      children: [
        { id: 'core0', name: 'Core_0', registers: 100000, memoryBits: 256 * 1024, logicGates: 400000, aspectRatio: 1.0, x: 20, y: 20, children: [] },
        { id: 'core1', name: 'Core_1', registers: 100000, memoryBits: 256 * 1024, logicGates: 400000, aspectRatio: 1.0, x: 150, y: 20, children: [] }
      ]
    },
    {
      id: 'gpu_sub',
      name: 'GPU_Core',
      registers: 800000,
      memoryBits: 16 * 1024 * 1024,
      logicGates: 5000000,
      aspectRatio: 2.0,
      x: 40,
      y: 400,
      children: []
    },
    {
      id: 'npu_sub',
      name: 'NPU_Accel',
      registers: 300000,
      memoryBits: 32 * 1024 * 1024,
      logicGates: 1500000,
      aspectRatio: 0.8,
      x: 500,
      y: 40,
      children: []
    }
  ]
};

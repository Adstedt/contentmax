import { ForceConfig } from '@/components/taxonomy/D3Visualization/ForceSimulation';

export interface ForcePreset {
  name: string;
  description: string;
  config: ForceConfig;
}

export const forcePresets: ForcePreset[] = [
  {
    name: 'Default',
    description: 'Balanced layout for general use',
    config: {
      link: { distance: 50, strength: 0.5 },
      charge: { strength: -100, distanceMax: 500 },
      collision: { radius: (d) => d.radius + 2, strength: 1 },
      center: { x: 400, y: 300, strength: 0.1 },
    },
  },
  {
    name: 'Compact',
    description: 'Tightly packed nodes',
    config: {
      link: { distance: 30, strength: 0.8 },
      charge: { strength: -50, distanceMax: 300 },
      collision: { radius: (d) => d.radius, strength: 1 },
      center: { x: 400, y: 300, strength: 0.2 },
    },
  },
  {
    name: 'Spread',
    description: 'Widely spaced nodes',
    config: {
      link: { distance: 100, strength: 0.3 },
      charge: { strength: -200, distanceMax: 800 },
      collision: { radius: (d) => d.radius + 5, strength: 1 },
      center: { x: 400, y: 300, strength: 0.05 },
    },
  },
  {
    name: 'Hierarchical',
    description: 'Emphasizes parent-child relationships',
    config: {
      link: { distance: 80, strength: 0.9 },
      charge: { strength: -150, distanceMax: 400 },
      collision: { radius: (d) => d.radius + 3, strength: 0.8 },
      center: { x: 400, y: 300, strength: 0.15 },
    },
  },
  {
    name: 'Performance',
    description: 'Optimized for large datasets',
    config: {
      link: { distance: 40, strength: 0.4 },
      charge: { strength: -80, distanceMax: 200 },
      collision: { radius: (d) => d.radius + 1, strength: 0.5 },
      center: { x: 400, y: 300, strength: 0.1 },
    },
  },
];

export function getPresetByName(name: string): ForcePreset | undefined {
  return forcePresets.find(preset => preset.name === name);
}

export function createAdaptiveConfig(nodeCount: number, width: number, height: number): ForceConfig {
  // Adapt configuration based on node count and viewport size
  const density = nodeCount / (width * height / 10000);
  
  let config: ForceConfig;
  
  if (nodeCount < 100) {
    // Small dataset: stronger forces, more spread
    config = {
      link: { distance: 80, strength: 0.6 },
      charge: { strength: -150, distanceMax: 600 },
      collision: { radius: (d) => d.radius + 4, strength: 1 },
      center: { x: width / 2, y: height / 2, strength: 0.15 },
    };
  } else if (nodeCount < 500) {
    // Medium dataset: balanced forces
    config = {
      link: { distance: 50, strength: 0.5 },
      charge: { strength: -100, distanceMax: 400 },
      collision: { radius: (d) => d.radius + 2, strength: 1 },
      center: { x: width / 2, y: height / 2, strength: 0.1 },
    };
  } else if (nodeCount < 1500) {
    // Large dataset: weaker forces for performance
    config = {
      link: { distance: 40, strength: 0.4 },
      charge: { strength: -80, distanceMax: 300 },
      collision: { radius: (d) => d.radius + 1, strength: 0.8 },
      center: { x: width / 2, y: height / 2, strength: 0.08 },
    };
  } else {
    // Very large dataset: minimal forces for performance
    config = {
      link: { distance: 30, strength: 0.3 },
      charge: { strength: -50, distanceMax: 200 },
      collision: { radius: (d) => d.radius, strength: 0.5 },
      center: { x: width / 2, y: height / 2, strength: 0.05 },
    };
  }
  
  // Adjust for density
  if (density > 1.5) {
    // High density: reduce attraction
    config.link.strength *= 0.8;
    config.charge.strength *= 1.2;
  } else if (density < 0.5) {
    // Low density: increase attraction
    config.link.strength *= 1.2;
    config.charge.strength *= 0.8;
  }
  
  return config;
}
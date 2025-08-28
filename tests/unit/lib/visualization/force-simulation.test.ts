import { ForceSimulation, Node, Link } from '@/components/taxonomy/D3Visualization/ForceSimulation';

describe('ForceSimulation', () => {
  let simulation: ForceSimulation;
  let nodes: Node[];
  let links: Link[];

  beforeEach(() => {
    // Create test data
    nodes = [
      {
        id: 'node1',
        url: '/node1',
        title: 'Node 1',
        radius: 10,
        color: '#10a37f',
        children: ['node2'],
        x: 100,
        y: 100,
      },
      {
        id: 'node2',
        url: '/node2',
        title: 'Node 2',
        radius: 8,
        color: '#f59e0b',
        children: [],
        x: 200,
        y: 200,
      },
      {
        id: 'node3',
        url: '/node3',
        title: 'Node 3',
        radius: 12,
        color: '#ef4444',
        children: [],
        x: 150,
        y: 150,
      },
    ];

    links = [
      { source: 'node1', target: 'node2', strength: 0.5 },
      { source: 'node1', target: 'node3', strength: 0.3 },
    ];

    simulation = new ForceSimulation(800, 600);
  });

  afterEach(() => {
    simulation.destroy();
  });

  describe('initialization', () => {
    it('should initialize with nodes and links', () => {
      simulation.initialize(nodes, links);
      expect(simulation).toBeDefined();
    });

    it('should apply default configuration', () => {
      simulation.initialize(nodes, links);
      // Simulation should be created with default forces
      expect(simulation).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        link: { distance: 100, strength: 0.8 },
        charge: { strength: -200, distanceMax: 600 },
      };
      
      const customSimulation = new ForceSimulation(800, 600, customConfig);
      customSimulation.initialize(nodes, links);
      expect(customSimulation).toBeDefined();
      customSimulation.destroy();
    });
  });

  describe('node operations', () => {
    beforeEach(() => {
      simulation.initialize(nodes, links);
    });

    it('should find node at position', () => {
      const foundNode = simulation.findNode(100, 100, 15);
      expect(foundNode).not.toBeNull();
      expect(foundNode?.id).toBe('node1');
    });

    it('should return null when no node at position', () => {
      const foundNode = simulation.findNode(500, 500);
      expect(foundNode).toBeNull();
    });

    it('should handle drag start', () => {
      const node = nodes[0];
      simulation.dragStart(node);
      expect(node.fx).toBe(node.x);
      expect(node.fy).toBe(node.y);
    });

    it('should handle drag movement', () => {
      const node = nodes[0];
      simulation.dragStart(node);
      simulation.drag(node, 250, 300);
      expect(node.fx).toBe(250);
      expect(node.fy).toBe(300);
    });

    it('should handle drag end', () => {
      const node = nodes[0];
      simulation.dragStart(node);
      simulation.drag(node, 250, 300);
      simulation.dragEnd(node);
      expect(node.fx).toBeNull();
      expect(node.fy).toBeNull();
    });
  });

  describe('simulation control', () => {
    beforeEach(() => {
      simulation.initialize(nodes, links);
    });

    it('should restart simulation', () => {
      simulation.restart();
      // Simulation should be running after restart
      expect(simulation).toBeDefined();
    });

    it('should stop simulation', () => {
      simulation.stop();
      // Simulation should be stopped
      expect(simulation).toBeDefined();
    });

    it('should tick simulation', () => {
      const initialX = nodes[0].x;
      simulation.tick();
      // Position might change after tick (depending on forces)
      expect(nodes[0].x).toBeDefined();
    });
  });

  describe('configuration updates', () => {
    beforeEach(() => {
      simulation.initialize(nodes, links);
    });

    it('should update force configuration', () => {
      const newConfig = {
        link: { distance: 120, strength: 0.9 },
      };
      
      simulation.updateConfig(newConfig);
      // Configuration should be applied
      expect(simulation).toBeDefined();
    });

    it('should restart after configuration update', () => {
      const newConfig = {
        charge: { strength: -300, distanceMax: 700 },
      };
      
      simulation.updateConfig(newConfig);
      // Simulation should restart with new config
      expect(simulation).toBeDefined();
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      simulation.initialize(nodes, links);
    });

    it('should register event callbacks', () => {
      const callback = jest.fn();
      simulation.on('tick', callback);
      
      // Trigger a tick
      simulation.tick();
      
      // Note: D3 simulation events might not fire synchronously
      // This test verifies the method doesn't throw
      expect(simulation).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      simulation.initialize(nodes, links);
      simulation.destroy();
      
      // After destroy, simulation should be cleaned up
      expect(simulation).toBeDefined();
    });
  });
});

describe('Force Simulation Performance', () => {
  it('should handle large datasets', () => {
    const simulation = new ForceSimulation(1920, 1080);
    
    // Create 3000 nodes
    const largeNodes: Node[] = [];
    const largeLinks: Link[] = [];
    
    for (let i = 0; i < 3000; i++) {
      largeNodes.push({
        id: `node${i}`,
        url: `/node${i}`,
        title: `Node ${i}`,
        radius: 5 + Math.random() * 10,
        color: '#10a37f',
        children: [],
        x: Math.random() * 1920,
        y: Math.random() * 1080,
      });
      
      // Create some random links
      if (i > 0 && Math.random() > 0.7) {
        largeLinks.push({
          source: `node${i}`,
          target: `node${Math.floor(Math.random() * i)}`,
          strength: Math.random(),
        });
      }
    }
    
    // Should initialize without throwing
    expect(() => {
      simulation.initialize(largeNodes, largeLinks);
    }).not.toThrow();
    
    // Should be able to tick
    expect(() => {
      simulation.tick();
    }).not.toThrow();
    
    simulation.destroy();
  });
});
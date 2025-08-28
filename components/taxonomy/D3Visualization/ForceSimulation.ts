import * as d3 from 'd3';

export interface Node extends d3.SimulationNodeDatum {
  id: string;
  url: string;
  title: string;
  radius: number;
  color: string;
  children: string[];
  depth?: number;
  skuCount?: number;
  traffic?: number;
  revenue?: number;
  status?: 'optimized' | 'outdated' | 'missing' | 'noContent';
}

export interface Link extends d3.SimulationLinkDatum<Node> {
  strength: number;
}

export interface ForceConfig {
  link: {
    distance: number;
    strength: number;
  };
  charge: {
    strength: number;
    distanceMax: number;
  };
  collision: {
    radius: (d: Node) => number;
    strength: number;
  };
  center: {
    x: number;
    y: number;
    strength: number;
  };
}

export class ForceSimulation {
  private simulation: d3.Simulation<Node, Link> | null = null;
  private nodes: Node[] = [];
  private links: Link[] = [];
  private config: ForceConfig;
  private width: number;
  private height: number;

  constructor(width: number, height: number, config?: Partial<ForceConfig>) {
    this.width = width;
    this.height = height;
    
    // Default configuration with dark theme colors
    this.config = {
      link: { distance: 50, strength: 0.5 },
      charge: { strength: -100, distanceMax: 500 },
      collision: { radius: (d) => d.radius + 2, strength: 1 },
      center: { x: width / 2, y: height / 2, strength: 0.1 },
      ...config,
    };
  }

  initialize(nodes: Node[], links: Link[]) {
    this.nodes = nodes;
    this.links = links;

    // Create the simulation
    this.simulation = d3
      .forceSimulation(this.nodes)
      .force(
        'link',
        d3
          .forceLink<Node, Link>(this.links)
          .id((d) => d.id)
          .distance(this.config.link.distance)
          .strength(this.config.link.strength)
      )
      .force(
        'charge',
        d3
          .forceManyBody<Node>()
          .strength(this.config.charge.strength)
          .distanceMax(this.config.charge.distanceMax)
      )
      .force(
        'center',
        d3
          .forceCenter<Node>(this.config.center.x, this.config.center.y)
          .strength(this.config.center.strength)
      )
      .force(
        'collision',
        d3
          .forceCollide<Node>()
          .radius(this.config.collision.radius)
          .strength(this.config.collision.strength)
      );

    // Set alpha decay for smoother animation
    this.simulation.alphaDecay(0.02);
    this.simulation.velocityDecay(0.4);
  }

  on(event: string, callback: () => void) {
    if (this.simulation) {
      this.simulation.on(event, callback);
    }
  }

  restart() {
    if (this.simulation) {
      this.simulation.alpha(1).restart();
    }
  }

  stop() {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  tick() {
    if (this.simulation) {
      this.simulation.tick();
    }
  }

  findNode(x: number, y: number, radius = 5): Node | null {
    for (const node of this.nodes) {
      if (!node.x || !node.y) continue;
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= node.radius + radius) {
        return node;
      }
    }
    return null;
  }

  dragStart(node: Node) {
    if (!this.simulation) return;
    if (!this.simulation.alpha()) {
      this.simulation.alpha(0.3).restart();
    }
    node.fx = node.x;
    node.fy = node.y;
  }

  drag(node: Node, x: number, y: number) {
    node.fx = x;
    node.fy = y;
  }

  dragEnd(node: Node) {
    if (!this.simulation) return;
    node.fx = null;
    node.fy = null;
  }

  updateConfig(config: Partial<ForceConfig>) {
    this.config = { ...this.config, ...config };
    
    if (this.simulation) {
      // Update forces with new config
      if (config.link) {
        const linkForce = this.simulation.force('link') as d3.ForceLink<Node, Link>;
        if (linkForce) {
          linkForce
            .distance(this.config.link.distance)
            .strength(this.config.link.strength);
        }
      }
      
      if (config.charge) {
        const chargeForce = this.simulation.force('charge') as d3.ForceManyBody<Node>;
        if (chargeForce) {
          chargeForce
            .strength(this.config.charge.strength)
            .distanceMax(this.config.charge.distanceMax);
        }
      }
      
      if (config.collision) {
        const collisionForce = this.simulation.force('collision') as d3.ForceCollide<Node>;
        if (collisionForce) {
          collisionForce
            .radius(this.config.collision.radius)
            .strength(this.config.collision.strength);
        }
      }
      
      this.restart();
    }
  }

  destroy() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    this.nodes = [];
    this.links = [];
  }
}
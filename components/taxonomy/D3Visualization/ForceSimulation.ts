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
      link: { distance: 150, strength: 0.1 }, // Default distance for same-level
      charge: { strength: -500, distanceMax: 300 }, // Moderate repulsion
      collision: {
        radius: (d) => {
          // More collision padding to prevent overlap
          const baseRadius = d.radius;
          const depthMultiplier = d.depth === 0 ? 3 : d.depth === 1 ? 2 : 1.5;
          return baseRadius * depthMultiplier + 10; // More padding
        },
        strength: 0.8,
      }, // Stronger collision avoidance
      center: { x: width / 2, y: height / 2, strength: 0.02 }, // Gentle centering
      ...config,
    };
  }

  initialize(nodes: Node[], links: Link[], autoStop: boolean = true) {
    this.nodes = nodes;
    this.links = links;

    // Create the simulation with hierarchical link distances
    this.simulation = d3
      .forceSimulation(this.nodes)
      .force(
        'link',
        d3
          .forceLink<Node, Link>(this.links)
          .id((d) => d.id)
          .distance((link: Link) => {
            const source = link.source as Node;
            const target = link.target as Node;
            const sourceDepth = source.depth || 0;
            const targetDepth = target.depth || 0;

            // Moderate distances for parent-child to prevent overlap
            if (Math.abs(sourceDepth - targetDepth) === 1) {
              // Main category to subcategory
              if (sourceDepth === 0 || sourceDepth === 1) {
                return 60; // Enough space to prevent overlap
              }
              // Subcategory to product
              return 50; // Moderate distance for products
            }

            // Longer distances for same-level nodes
            return this.config.link.distance;
          })
          .strength((link: Link) => {
            const source = link.source as Node;
            const target = link.target as Node;
            const sourceDepth = source.depth || 0;
            const targetDepth = target.depth || 0;

            // Strong attraction for parent-child
            if (Math.abs(sourceDepth - targetDepth) === 1) {
              return 0.8; // Very strong hierarchical links
            }

            // Weaker for same-level
            return this.config.link.strength;
          })
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

    // Set alpha decay for very fast stabilization
    this.simulation.alphaDecay(0.3); // Very fast decay to stop almost immediately
    this.simulation.velocityDecay(0.9); // Maximum damping
    this.simulation.alphaMin(0.1); // Stop simulation very early

    // Stop simulation after settling
    this.simulation.on('end', () => {
      console.log('Force simulation has ended');
    });

    // If autoStop is true, run for a fixed time then stop
    if (autoStop) {
      this.runAndStop(300);
    }
  }

  on(event: string, callback: () => void) {
    if (this.simulation) {
      this.simulation.on(event, callback);
    }
  }

  restart() {
    if (this.simulation) {
      this.simulation.alpha(0.3).restart(); // Reduced from 1 to avoid full restart
    }
  }

  stop() {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  // Run simulation for a fixed number of ticks then stop
  runAndStop(ticks: number = 300) {
    if (!this.simulation) return;

    // Run simulation for specified ticks
    for (let i = 0; i < ticks; i++) {
      this.simulation.tick();
    }

    // Stop the simulation
    this.simulation.stop();
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
          linkForce.distance(this.config.link.distance).strength(this.config.link.strength);
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

  // Add nodes without restarting the whole simulation
  addNodes(newNodes: Node[], newLinks: Link[]) {
    if (!this.simulation) return;

    // Position new nodes near their connected nodes if possible
    newNodes.forEach((node) => {
      if (!node.x || !node.y) {
        // Find a connected node that already has position
        const connectedLink = newLinks.find(
          (l) =>
            (l.source === node.id && this.nodes.find((n) => n.id === l.target)) ||
            (l.target === node.id && this.nodes.find((n) => n.id === l.source))
        );

        if (connectedLink) {
          const connectedNode = this.nodes.find(
            (n) =>
              n.id ===
              (connectedLink.source === node.id ? connectedLink.target : connectedLink.source)
          );

          if (connectedNode && connectedNode.x && connectedNode.y) {
            // Position near connected node with small random offset
            node.x = connectedNode.x + (Math.random() - 0.5) * 50;
            node.y = connectedNode.y + (Math.random() - 0.5) * 50;
          } else {
            // Default to center with small offset
            node.x = this.width / 2 + (Math.random() - 0.5) * 100;
            node.y = this.height / 2 + (Math.random() - 0.5) * 100;
          }
        } else {
          // Default to center with small offset
          node.x = this.width / 2 + (Math.random() - 0.5) * 100;
          node.y = this.height / 2 + (Math.random() - 0.5) * 100;
        }
      }
    });

    // Add to existing arrays
    this.nodes.push(...newNodes);
    this.links.push(...newLinks);

    // Update simulation nodes
    this.simulation.nodes(this.nodes);

    // Update links
    const linkForce = this.simulation.force('link') as d3.ForceLink<Node, Link>;
    if (linkForce) {
      linkForce.links(this.links);
    }

    // Don't restart simulation when adding nodes - just update positions
    // this.simulation.alpha(0.1).restart();

    // Just run a few ticks to position new nodes without full restart
    for (let i = 0; i < 10; i++) {
      this.simulation.tick();
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

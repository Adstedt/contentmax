# Progressive Loading Demo

This document demonstrates how to use the progressive loading feature for the taxonomy visualization.

## Basic Usage

The progressive loading feature is automatically enabled for datasets with more than 100 nodes:

```tsx
import { ForceGraph } from '@/components/taxonomy/D3Visualization';

function TaxonomyVisualization({ data }) {
  return (
    <ForceGraph
      data={{
        nodes: taxonomyNodes, // 3000+ nodes
        links: taxonomyLinks,
      }}
      width={1200}
      height={800}
      enableProgressiveLoading={true} // Default: true
      onNodeClick={(node) => console.log('Clicked:', node)}
    />
  );
}
```

## Loading Levels

The progressive loader implements four loading levels:

### 1. Core Nodes (Initial Load)

- Loads the most important 100 nodes immediately
- Prioritized by connections, depth, and business metrics
- Ensures initial render in < 1 second

### 2. Viewport Loading

- Automatically loads nodes visible in the current viewport
- Triggered by zoom and pan interactions
- Adapts to user navigation patterns

### 3. Connected Nodes

- Ctrl+Click on any node to load its connected nodes
- Configurable depth (default: 2 levels)
- Useful for exploring specific branches

### 4. Load All

- "Load All" button to load remaining nodes
- Batched loading maintains 30+ FPS
- Shows progress indicator during loading

## Configuration Options

Customize the progressive loading behavior:

```tsx
const progressiveLoaderConfig = {
  coreNodeLimit: 100, // Initial nodes to load
  viewportNodeLimit: 500, // Max nodes in viewport
  connectedNodeLimit: 1000, // Max connected nodes
  batchSize: 20, // Nodes per batch
  frameInterval: 16, // Target 60 FPS
  minZoomForDetails: 0.5, // Min zoom for labels
};
```

## Performance Characteristics

- **Initial Load**: < 1 second for core nodes
- **Frame Rate**: Maintains 30+ FPS during all operations
- **Memory Usage**: < 200MB for 3000 nodes
- **Batch Processing**: Non-blocking with requestAnimationFrame
- **Smooth Transitions**: No jarring between loading levels

## User Interactions

- **Pan/Zoom**: Automatically loads nodes in view
- **Ctrl+Click**: Load connected nodes (2 levels deep)
- **Load All Button**: Load complete dataset
- **Progress Indicator**: Shows loading status and node count

## Disable Progressive Loading

For smaller datasets or debugging, disable progressive loading:

```tsx
<ForceGraph data={data} enableProgressiveLoading={false} />
```

## Testing Progressive Loading

Run the performance tests:

```bash
npm test -- lib/visualization/progressive-loader.test.ts
```

## Browser Compatibility

- Chrome 90+: ✅ Full support
- Firefox 88+: ✅ Full support
- Safari 14+: ✅ Full support
- Edge 90+: ✅ Full support

## Mobile Performance

The progressive loading is especially beneficial on mobile devices:

- Reduces initial memory footprint
- Maintains responsive touch interactions
- Adapts batch size based on device performance

## Troubleshooting

### Low FPS

- Check browser DevTools Performance tab
- Reduce `batchSize` in configuration
- Enable performance mode in renderer

### Nodes Not Loading

- Verify viewport detection is working
- Check console for errors
- Ensure data format matches expected structure

### Memory Issues

- Monitor memory usage in DevTools
- Reduce `viewportNodeLimit` for constrained devices
- Consider implementing node culling for off-screen nodes

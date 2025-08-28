export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 60;
  private frameHistory: number[] = [];
  private historySize: number = 60;
  private averageFps: number = 60;
  
  constructor(historySize: number = 60) {
    this.historySize = historySize;
  }

  measureFPS(): number {
    const now = performance.now();
    const delta = now - this.lastTime;
    
    // Calculate FPS every second
    if (delta >= 1000) {
      this.fps = (this.frameCount * 1000) / delta;
      
      // Add to history
      this.frameHistory.push(this.fps);
      if (this.frameHistory.length > this.historySize) {
        this.frameHistory.shift();
      }
      
      // Calculate average
      this.averageFps = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
      
      // Reset counters
      this.frameCount = 0;
      this.lastTime = now;
    }
    
    this.frameCount++;
    return this.fps;
  }

  getCurrentFPS(): number {
    return this.fps;
  }

  getAverageFPS(): number {
    return this.averageFps;
  }

  shouldSimplifyRendering(): boolean {
    return this.averageFps < 30;
  }

  shouldReduceQuality(): boolean {
    return this.averageFps < 20;
  }

  getPerformanceLevel(): 'high' | 'medium' | 'low' {
    if (this.averageFps >= 50) return 'high';
    if (this.averageFps >= 30) return 'medium';
    return 'low';
  }

  reset() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.frameHistory = [];
    this.averageFps = 60;
  }
}
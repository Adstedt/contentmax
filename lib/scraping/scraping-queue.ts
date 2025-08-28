import { ScrapingQueueItem } from '@/types/scraper.types';

export class ScrapingQueue {
  private queue: ScrapingQueueItem[] = [];
  private processedUrls: Set<string> = new Set();

  async enqueue(item: ScrapingQueueItem): Promise<void> {
    // Avoid duplicate URLs
    if (this.processedUrls.has(item.url)) {
      return;
    }

    // Insert based on priority (lower number = higher priority)
    const insertIndex = this.queue.findIndex(q => q.priority > item.priority);
    
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }
  }

  async dequeue(): Promise<ScrapingQueueItem | null> {
    const item = this.queue.shift();
    if (item) {
      this.processedUrls.add(item.url);
    }
    return item || null;
  }

  async dequeueBatch(size: number): Promise<ScrapingQueueItem[]> {
    const batch: ScrapingQueueItem[] = [];
    
    for (let i = 0; i < size && this.queue.length > 0; i++) {
      const item = await this.dequeue();
      if (item) {
        batch.push(item);
      }
    }
    
    return batch;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.processedUrls.clear();
  }

  getProcessedUrls(): string[] {
    return Array.from(this.processedUrls);
  }
}
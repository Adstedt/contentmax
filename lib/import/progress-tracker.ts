import { EventEmitter } from 'events';

export interface ImportProgress {
  importId: string;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  percentage: number;
  currentChunk?: number;
  totalChunks?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
}

export class ImportProgressTracker extends EventEmitter {
  private importId: string;
  private total: number;
  private progress: ImportProgress;
  private progressHistory: ImportProgress[] = [];

  constructor(importId: string, total: number) {
    super();
    this.importId = importId;
    this.total = total;
    this.progress = {
      importId,
      total,
      processed: 0,
      successful: 0,
      failed: 0,
      percentage: 0,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };
  }

  updateProgress(updates: Partial<ImportProgress>) {
    this.progress = {
      ...this.progress,
      ...updates,
      percentage: Math.round(((updates.processed || this.progress.processed) / this.total) * 100),
      timestamp: new Date().toISOString(),
    };

    if (this.progress.processed >= this.total) {
      this.progress.status = this.progress.failed > 0 ? 'failed' : 'completed';
    } else if (this.progress.processed > 0) {
      this.progress.status = 'processing';
    }

    this.progressHistory.push({ ...this.progress });
    this.emit('progress', this.progress);
  }

  getProgress(): ImportProgress {
    return { ...this.progress };
  }

  getHistory(): ImportProgress[] {
    return [...this.progressHistory];
  }

  setMessage(message: string) {
    this.updateProgress({ message });
  }

  complete(successful: number, failed: number) {
    this.updateProgress({
      processed: this.total,
      successful,
      failed,
      status: failed > 0 ? 'failed' : 'completed',
      message: `Import completed: ${successful} successful, ${failed} failed`,
    });
  }

  error(error: string) {
    this.updateProgress({
      status: 'failed',
      message: `Import failed: ${error}`,
    });
  }
}

class ImportProgressManager {
  private static instance: ImportProgressManager;
  private trackers: Map<string, ImportProgressTracker> = new Map();

  static getInstance(): ImportProgressManager {
    if (!ImportProgressManager.instance) {
      ImportProgressManager.instance = new ImportProgressManager();
    }
    return ImportProgressManager.instance;
  }

  createTracker(importId: string, total: number): ImportProgressTracker {
    const tracker = new ImportProgressTracker(importId, total);
    this.trackers.set(importId, tracker);
    
    setTimeout(() => {
      this.trackers.delete(importId);
    }, 1000 * 60 * 60);

    return tracker;
  }

  getTracker(importId: string): ImportProgressTracker | undefined {
    return this.trackers.get(importId);
  }

  removeTracker(importId: string): void {
    this.trackers.delete(importId);
  }

  getAllTrackers(): Map<string, ImportProgressTracker> {
    return new Map(this.trackers);
  }
}

export const progressManager = ImportProgressManager.getInstance();
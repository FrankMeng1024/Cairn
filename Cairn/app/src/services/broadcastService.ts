/**
 * Broadcast Service — TTS announcement system with priority queue and audio ducking.
 *
 * Manages announcement scheduling, priority merging, and rhythm control.
 * Uses expo-speech for TTS. Audio ducking requires native module on device
 * (expo-speech handles basic ducking on iOS via AVAudioSession).
 *
 * Sprint 46 — STORY-00154
 */
import * as Speech from 'expo-speech';

// ── Types ───────────────────────────────────────────────────────────────────

export type BroadcastPriority = 'P0' | 'P1' | 'P2';

export interface BroadcastItem {
  id: string;
  priority: BroadcastPriority;
  message: string;
  createdAt: number;
}

interface BroadcastConfig {
  minIntervalMs: number;       // minimum time between broadcasts (default 15000)
  maxQueueLength: number;      // max items in queue (default 5)
  p2TimeoutMs: number;         // P2 items expire after this time (default 120000)
  language: string;            // TTS language (default 'en-NZ')
  rate: number;                // speech rate (default 1.0)
  pitch: number;              // speech pitch (default 1.0)
}

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BroadcastConfig = {
  minIntervalMs: 15000,       // 15 seconds
  maxQueueLength: 5,
  p2TimeoutMs: 120000,        // 2 minutes
  language: 'en-NZ',
  rate: 1.0,
  pitch: 1.0,
};

// ── Broadcast Service ───────────────────────────────────────────────────────

class BroadcastService {
  private queue: BroadcastItem[] = [];
  private lastBroadcastTime = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isSpeaking = false;
  private config: BroadcastConfig;
  private enabled = true;
  private consecutiveP0Count = 0;
  private p0WindowStart = 0;

  constructor(config?: Partial<BroadcastConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a broadcast to the queue.
   * P0 items may interrupt the minimum interval.
   */
  announce(priority: BroadcastPriority, message: string): void {
    if (!this.enabled) return;

    const item: BroadcastItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      priority,
      message,
      createdAt: Date.now(),
    };

    // P0 can interrupt — announce immediately
    if (priority === 'P0') {
      this.handleP0(item);
      return;
    }

    // Add to queue, respecting max length (drop lowest priority oldest)
    this.queue.push(item);
    this.queue.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
    if (this.queue.length > this.config.maxQueueLength) {
      this.queue.pop(); // drop lowest priority
    }

    // Schedule next broadcast if not already scheduled
    this.scheduleNext();
  }

  /**
   * P0 handling: immediate broadcast, with consecutive merge logic.
   */
  private handleP0(item: BroadcastItem): void {
    const now = Date.now();

    // Track consecutive P0s for merge
    if (now - this.p0WindowStart > 60000) {
      this.consecutiveP0Count = 0;
      this.p0WindowStart = now;
    }
    this.consecutiveP0Count++;

    // If 3+ P0 in 60s, merge into area warning
    if (this.consecutiveP0Count >= 3) {
      this.speak('Caution: sustained hazard area ahead. Stay alert.');
      this.consecutiveP0Count = 0;
      this.p0WindowStart = now;
      return;
    }

    // Immediate broadcast (interrupts interval)
    this.speak(item.message);
    this.lastBroadcastTime = now;
  }

  /**
   * Schedule the next queued broadcast respecting minimum interval.
   */
  private scheduleNext(): void {
    if (this.timer) return; // already scheduled

    const now = Date.now();
    const elapsed = now - this.lastBroadcastTime;
    const delay = Math.max(0, this.config.minIntervalMs - elapsed);

    this.timer = setTimeout(() => {
      this.timer = null;
      this.processQueue();
    }, delay);
  }

  /**
   * Process the next item in the queue.
   */
  private processQueue(): void {
    // Expire old P2 items
    const now = Date.now();
    this.queue = this.queue.filter(
      item => item.priority !== 'P2' || (now - item.createdAt) < this.config.p2TimeoutMs
    );

    if (this.queue.length === 0) return;

    // Take highest priority item
    const item = this.queue.shift()!;

    // Check for mergeable items (same priority within short window)
    const mergeable = this.queue.filter(
      q => q.priority === item.priority && (now - q.createdAt) < 5000
    );

    let message = item.message;
    if (mergeable.length > 0) {
      // Merge: "3 markers ahead, including 1 danger warning"
      const total = mergeable.length + 1;
      const dangerCount = [item, ...mergeable].filter(
        m => m.message.toLowerCase().includes('danger')
      ).length;

      message = `${total} markers ahead`;
      if (dangerCount > 0) {
        message += `, including ${dangerCount} danger warning${dangerCount > 1 ? 's' : ''}`;
      }

      // Remove merged items from queue
      const mergedIds = new Set(mergeable.map(m => m.id));
      this.queue = this.queue.filter(q => !mergedIds.has(q.id));
    }

    this.speak(message);
    this.lastBroadcastTime = now;

    // Schedule next if queue still has items
    if (this.queue.length > 0) {
      this.scheduleNext();
    }
  }

  /**
   * Speak a message using expo-speech.
   * Audio ducking is handled by expo-speech on iOS (AVAudioSession.duckOthers).
   */
  private speak(text: string): void {
    if (this.isSpeaking) {
      Speech.stop();
    }

    this.isSpeaking = true;
    Speech.speak(text, {
      language: this.config.language,
      rate: this.config.rate,
      pitch: this.config.pitch,
      onDone: () => { this.isSpeaking = false; },
      onError: () => { this.isSpeaking = false; },
      // expo-speech on iOS uses AVAudioSession with ducking by default
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Update config at runtime (e.g. user changes interval in settings) */
  updateConfig(updates: Partial<BroadcastConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /** Enable/disable all broadcasts */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.queue = [];
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      Speech.stop();
    }
  }

  /** Get current queue length (for debugging/UI) */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Clear all queued items */
  clearQueue(): void {
    this.queue = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Stop current speech immediately */
  stop(): void {
    Speech.stop();
    this.isSpeaking = false;
  }
}

// ── Priority weight (lower = higher priority) ──────────────────────────────

function priorityWeight(p: BroadcastPriority): number {
  switch (p) {
    case 'P0': return 0;
    case 'P1': return 1;
    case 'P2': return 2;
  }
}

// ── Singleton instance ──────────────────────────────────────────────────────

export const broadcastService = new BroadcastService();

// ── Convenience functions ───────────────────────────────────────────────────

/** Danger/deviation alert — immediate (P0) */
export function announceP0(message: string): void {
  broadcastService.announce('P0', message);
}

/** Waypoint/weather — queued (P1) */
export function announceP1(message: string): void {
  broadcastService.announce('P1', message);
}

/** Info/scenic — soft (P2, may expire) */
export function announceP2(message: string): void {
  broadcastService.announce('P2', message);
}

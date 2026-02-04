/**
 * BMAD Token Tracker
 * Track API token usage and costs
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: string;
  workflowId?: string;
  stepName?: string;
}

export interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  startedAt: string;
  lastUpdatedAt: string;
  usageByWorkflow: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
  }>;
}

// Claude pricing (as of 2024)
const PRICING = {
  'claude-3-opus': {
    inputPer1k: 0.015,
    outputPer1k: 0.075,
  },
  'claude-3-sonnet': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
  },
  'claude-3-haiku': {
    inputPer1k: 0.00025,
    outputPer1k: 0.00125,
  },
  'claude-3-5-sonnet': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
  },
  default: {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
  },
};

class TokenTracker {
  private sessionStats: SessionStats;
  private usageHistory: TokenUsage[] = [];
  private currentWorkflowId?: string;
  private currentStepName?: string;
  private model: keyof typeof PRICING = 'default';
  private dataDir: string = '.appfabrika/stats';

  constructor() {
    this.sessionStats = this.createEmptyStats();
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): SessionStats {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      usageByWorkflow: {},
    };
  }

  /**
   * Set the model for pricing calculation
   */
  setModel(model: string): void {
    if (model in PRICING) {
      this.model = model as keyof typeof PRICING;
    } else {
      this.model = 'default';
    }
  }

  /**
   * Set data directory for persistence
   */
  setDataDir(dir: string): void {
    this.dataDir = dir;
  }

  /**
   * Set current workflow context
   */
  setContext(workflowId?: string, stepName?: string): void {
    this.currentWorkflowId = workflowId;
    this.currentStepName = stepName;
  }

  /**
   * Calculate cost from tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[this.model];
    const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
    return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places
  }

  /**
   * Track token usage from an API response
   */
  track(inputTokens: number, outputTokens: number): TokenUsage {
    const cost = this.calculateCost(inputTokens, outputTokens);
    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: cost,
      timestamp: new Date().toISOString(),
      workflowId: this.currentWorkflowId,
      stepName: this.currentStepName,
    };

    // Update session stats
    this.sessionStats.totalInputTokens += inputTokens;
    this.sessionStats.totalOutputTokens += outputTokens;
    this.sessionStats.totalTokens += inputTokens + outputTokens;
    this.sessionStats.totalCost += cost;
    this.sessionStats.requestCount++;
    this.sessionStats.lastUpdatedAt = new Date().toISOString();

    // Update workflow stats
    if (this.currentWorkflowId) {
      if (!this.sessionStats.usageByWorkflow[this.currentWorkflowId]) {
        this.sessionStats.usageByWorkflow[this.currentWorkflowId] = {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          requests: 0,
        };
      }
      const wfStats = this.sessionStats.usageByWorkflow[this.currentWorkflowId];
      wfStats.inputTokens += inputTokens;
      wfStats.outputTokens += outputTokens;
      wfStats.cost += cost;
      wfStats.requests++;
    }

    // Add to history
    this.usageHistory.push(usage);

    return usage;
  }

  /**
   * Get current session stats
   */
  getStats(): SessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Get usage history
   */
  getHistory(): TokenUsage[] {
    return [...this.usageHistory];
  }

  /**
   * Display stats summary to console
   */
  displaySummary(): void {
    const stats = this.sessionStats;

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  💰 API KULLANIM ÖZETİ                      ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Input Tokens:  ${stats.totalInputTokens.toLocaleString().padStart(15)}                       ║`);
    console.log(`║ Output Tokens: ${stats.totalOutputTokens.toLocaleString().padStart(15)}                       ║`);
    console.log(`║ Toplam Tokens: ${stats.totalTokens.toLocaleString().padStart(15)}                       ║`);
    console.log('╟────────────────────────────────────────────────────────────╢');
    console.log(`║ Tahmini Maliyet: $${stats.totalCost.toFixed(4).padStart(12)}                       ║`);
    console.log(`║ İstek Sayısı:    ${stats.requestCount.toString().padStart(12)}                       ║`);
    console.log('╟────────────────────────────────────────────────────────────╢');

    // Workflow breakdown
    const workflows = Object.entries(stats.usageByWorkflow);
    if (workflows.length > 0) {
      console.log('║ Workflow Bazında:                                          ║');
      for (const [wfId, wfStats] of workflows.slice(0, 5)) {
        const shortId = wfId.length > 25 ? wfId.slice(0, 22) + '...' : wfId;
        console.log(`║   ${shortId.padEnd(28)} $${wfStats.cost.toFixed(4).padStart(8)} ║`);
      }
      if (workflows.length > 5) {
        console.log(`║   ... ve ${workflows.length - 5} workflow daha                          ║`);
      }
    }

    console.log('╚════════════════════════════════════════════════════════════╝');
  }

  /**
   * Save stats to file
   */
  async save(): Promise<void> {
    try {
      if (!existsSync(this.dataDir)) {
        await mkdir(this.dataDir, { recursive: true });
      }

      const date = new Date().toISOString().split('T')[0];
      const statsFile = join(this.dataDir, `token-stats-${date}.json`);

      // Load existing daily stats if any
      let dailyStats: SessionStats;
      if (existsSync(statsFile)) {
        const existing = await readFile(statsFile, 'utf-8');
        const parsed = JSON.parse(existing) as SessionStats;
        // Merge stats
        dailyStats = {
          ...parsed,
          totalInputTokens: parsed.totalInputTokens + this.sessionStats.totalInputTokens,
          totalOutputTokens: parsed.totalOutputTokens + this.sessionStats.totalOutputTokens,
          totalTokens: parsed.totalTokens + this.sessionStats.totalTokens,
          totalCost: parsed.totalCost + this.sessionStats.totalCost,
          requestCount: parsed.requestCount + this.sessionStats.requestCount,
          lastUpdatedAt: new Date().toISOString(),
          usageByWorkflow: { ...parsed.usageByWorkflow },
        };

        // Merge workflow stats
        for (const [wfId, wfStats] of Object.entries(this.sessionStats.usageByWorkflow)) {
          if (!dailyStats.usageByWorkflow[wfId]) {
            dailyStats.usageByWorkflow[wfId] = wfStats;
          } else {
            dailyStats.usageByWorkflow[wfId].inputTokens += wfStats.inputTokens;
            dailyStats.usageByWorkflow[wfId].outputTokens += wfStats.outputTokens;
            dailyStats.usageByWorkflow[wfId].cost += wfStats.cost;
            dailyStats.usageByWorkflow[wfId].requests += wfStats.requests;
          }
        }
      } else {
        dailyStats = this.sessionStats;
      }

      await writeFile(statsFile, JSON.stringify(dailyStats, null, 2), 'utf-8');
    } catch (error) {
      console.error('Token stats kaydetme hatası:', error);
    }
  }

  /**
   * Reset session stats
   */
  reset(): void {
    this.sessionStats = this.createEmptyStats();
    this.usageHistory = [];
  }
}

// Singleton instance
export const tokenTracker = new TokenTracker();

// Convenience exports
export const trackTokens = tokenTracker.track.bind(tokenTracker);
export const getTokenStats = tokenTracker.getStats.bind(tokenTracker);
export const displayTokenSummary = tokenTracker.displaySummary.bind(tokenTracker);

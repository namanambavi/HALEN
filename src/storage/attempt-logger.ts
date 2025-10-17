/**
 * Attempt logger - stores all game attempts for training data
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Attempt, AttackClassification } from '../models/types';

export class AttemptLogger {
  private attemptsDir: string;

  constructor(attemptsDir: string) {
    this.attemptsDir = attemptsDir;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.attemptsDir)) {
      fs.mkdirSync(this.attemptsDir, { recursive: true });
    }
  }

  async logAttempt(
    userId: string,
    username: string,
    levelId: number,
    userInput: string,
    halenResponse: string,
    success: boolean,
    extractedCode: string | undefined,
    classification: AttackClassification
  ): Promise<Attempt> {
    const attempt: Attempt = {
      id: uuidv4(),
      userId,
      username,
      levelId,
      timestamp: new Date().toISOString(),
      userInput,
      halenResponse,
      success,
      extractedCode,
      classification
    };

    // Save individual attempt file
    const filename = `${attempt.id}.json`;
    const filePath = path.join(this.attemptsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(attempt, null, 2), 'utf-8');

    // Also append to daily aggregate file for easier analysis
    await this.appendToDailyLog(attempt);

    return attempt;
  }

  private async appendToDailyLog(attempt: Attempt): Promise<void> {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyLogPath = path.join(this.attemptsDir, `daily_${date}.jsonl`);

    // Append as JSON Lines format (one JSON per line)
    const line = JSON.stringify(attempt) + '\n';
    fs.appendFileSync(dailyLogPath, line, 'utf-8');
  }

  async getAttemptsByUser(userId: string, limit?: number): Promise<Attempt[]> {
    const files = fs.readdirSync(this.attemptsDir);
    const attempts: Attempt[] = [];

    for (const file of files) {
      // Skip daily logs, only read individual attempt files
      if (file.endsWith('.json') && !file.startsWith('daily_')) {
        try {
          const filePath = path.join(this.attemptsDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const attempt = JSON.parse(data) as Attempt;
          
          if (attempt.userId === userId) {
            attempts.push(attempt);
          }
        } catch (error) {
          // Skip invalid files
          continue;
        }
      }
    }

    // Sort by timestamp descending
    attempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (limit) {
      return attempts.slice(0, limit);
    }

    return attempts;
  }

  async getAttemptsByLevel(levelId: number, limit?: number): Promise<Attempt[]> {
    const files = fs.readdirSync(this.attemptsDir);
    const attempts: Attempt[] = [];

    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('daily_')) {
        try {
          const filePath = path.join(this.attemptsDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const attempt = JSON.parse(data) as Attempt;
          
          if (attempt.levelId === levelId) {
            attempts.push(attempt);
          }
        } catch (error) {
          continue;
        }
      }
    }

    attempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (limit) {
      return attempts.slice(0, limit);
    }

    return attempts;
  }

  async getSuccessfulAttempts(limit?: number): Promise<Attempt[]> {
    const files = fs.readdirSync(this.attemptsDir);
    const attempts: Attempt[] = [];

    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('daily_')) {
        try {
          const filePath = path.join(this.attemptsDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const attempt = JSON.parse(data) as Attempt;
          
          if (attempt.success) {
            attempts.push(attempt);
          }
        } catch (error) {
          continue;
        }
      }
    }

    attempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (limit) {
      return attempts.slice(0, limit);
    }

    return attempts;
  }

  async getStats(): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    successRate: number;
    uniqueUsers: number;
    tacticDistribution: Record<string, number>;
  }> {
    const files = fs.readdirSync(this.attemptsDir);
    const attempts: Attempt[] = [];
    const userIds = new Set<string>();
    const tactics: Record<string, number> = {};

    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('daily_')) {
        try {
          const filePath = path.join(this.attemptsDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const attempt = JSON.parse(data) as Attempt;
          attempts.push(attempt);
          userIds.add(attempt.userId);

          // Count tactics
          for (const tactic of attempt.classification.tactics) {
            tactics[tactic] = (tactics[tactic] || 0) + 1;
          }
        } catch (error) {
          continue;
        }
      }
    }

    const successfulAttempts = attempts.filter(a => a.success).length;

    return {
      totalAttempts: attempts.length,
      successfulAttempts,
      successRate: attempts.length > 0 ? successfulAttempts / attempts.length : 0,
      uniqueUsers: userIds.size,
      tacticDistribution: tactics
    };
  }
}


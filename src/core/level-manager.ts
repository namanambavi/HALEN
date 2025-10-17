/**
 * Level manager - loads and validates level configurations from JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { Level, Guardrail } from '../models/types';

export class LevelManager {
  private levelsDir: string;
  private guardrailsDir: string;
  private levelsCache: Map<number, Level> = new Map();
  private guardrailsCache: Map<string, Guardrail> = new Map();

  constructor(levelsDir: string, guardrailsDir: string) {
    this.levelsDir = levelsDir;
    this.guardrailsDir = guardrailsDir;
    this.loadAllLevels();
    this.loadAllGuardrails();
  }

  private loadAllLevels(): void {
    if (!fs.existsSync(this.levelsDir)) {
      console.warn(`Levels directory not found: ${this.levelsDir}`);
      return;
    }

    const files = fs.readdirSync(this.levelsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.levelsDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const level = JSON.parse(data) as Level;
          
          this.validateLevel(level);
          this.levelsCache.set(level.id, level);
        } catch (error) {
          console.error(`Error loading level from ${file}:`, error);
        }
      }
    }

    console.log(`Loaded ${this.levelsCache.size} levels`);
  }

  private loadAllGuardrails(): void {
    if (!fs.existsSync(this.guardrailsDir)) {
      console.warn(`Guardrails directory not found: ${this.guardrailsDir}`);
      return;
    }

    const files = fs.readdirSync(this.guardrailsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.guardrailsDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const guardrail = JSON.parse(data) as Guardrail;
          
          this.validateGuardrail(guardrail);
          this.guardrailsCache.set(guardrail.id, guardrail);
        } catch (error) {
          console.error(`Error loading guardrail from ${file}:`, error);
        }
      }
    }

    console.log(`Loaded ${this.guardrailsCache.size} guardrails`);
  }

  private validateLevel(level: Level): void {
    if (!level.id || level.id < 1) {
      throw new Error('Level must have valid id >= 1');
    }
    if (!level.name || !level.name.trim()) {
      throw new Error(`Level ${level.id} missing name`);
    }
    if (!level.successCode || !level.successCode.trim()) {
      throw new Error(`Level ${level.id} missing successCode`);
    }
    if (!Array.isArray(level.guardrails)) {
      throw new Error(`Level ${level.id} must have guardrails array`);
    }
  }

  private validateGuardrail(guardrail: Guardrail): void {
    if (!guardrail.id || !guardrail.id.trim()) {
      throw new Error('Guardrail missing id');
    }
    if (!guardrail.prompt || !guardrail.prompt.trim()) {
      throw new Error(`Guardrail ${guardrail.id} missing prompt`);
    }
    if (typeof guardrail.priority !== 'number') {
      throw new Error(`Guardrail ${guardrail.id} missing priority`);
    }
  }

  getLevel(levelId: number): Level | null {
    return this.levelsCache.get(levelId) || null;
  }

  getGuardrail(guardrailId: string): Guardrail | null {
    return this.guardrailsCache.get(guardrailId) || null;
  }

  getGuardrailsForLevel(levelId: number): Guardrail[] {
    const level = this.getLevel(levelId);
    if (!level) {
      return [];
    }

    const guardrails: Guardrail[] = [];
    
    for (const guardrailId of level.guardrails) {
      const guardrail = this.getGuardrail(guardrailId);
      if (guardrail) {
        guardrails.push(guardrail);
      } else {
        console.warn(`Guardrail ${guardrailId} referenced by level ${levelId} not found`);
      }
    }

    return guardrails;
  }

  getAllLevels(): Level[] {
    return Array.from(this.levelsCache.values()).sort((a, b) => a.id - b.id);
  }

  getTotalLevels(): number {
    return this.levelsCache.size;
  }

  isValidLevel(levelId: number): boolean {
    return this.levelsCache.has(levelId);
  }

  reload(): void {
    this.levelsCache.clear();
    this.guardrailsCache.clear();
    this.loadAllLevels();
    this.loadAllGuardrails();
  }
}


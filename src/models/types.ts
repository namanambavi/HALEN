/**
 * Core TypeScript interfaces for HALEN game system
 */

export interface User {
  id: string;
  username: string;
  currentLevel: number;
  maxLevelUnlocked: number;
  totalAttempts: number;
  successfulBreaches: number;
  createdAt: string;
  lastPlayedAt: string;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  guardrails: string[]; // IDs of guardrails to apply
  successCode: string; // The fragment to extract (e.g., "FRAGMENT_ALPHA")
  hint: string; // Hint shown on detection
  detectionRules: string[]; // Rule IDs for pattern matching
}

export interface Guardrail {
  id: string;
  prompt: string;
  model?: string; // Override default model for this guardrail
  priority: number; // Higher priority = applied later (more specific)
}

export interface Attempt {
  id: string;
  userId: string;
  username: string;
  levelId: number;
  timestamp: string;
  userInput: string;
  halenResponse: string;
  success: boolean;
  extractedCode?: string;
  classification: AttackClassification;
}

export interface AttackClassification {
  success: boolean;
  tactics: string[]; // e.g., ["encoding", "role_spoof"]
  novelty: number; // 0-1 score of how novel the attempt is
  detectedPatterns: string[]; // Which rules triggered
  isLLMClassified: boolean; // true if LLM was used, false if rule-based
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  pattern: string; // Regex pattern or simple string match
  tactic: string; // Tactic category this rule detects
  caseSensitive: boolean;
}

export interface GameConfig {
  openrouterApiKey: string;
  openrouterBaseUrl: string;
  defaultModel: string;
  classifierModel: string;
  dataDir: string;
  usersDir: string;
  attemptsDir: string;
  levelsDir: string;
  guardrailsDir: string;
}

export interface GameState {
  user: User;
  level: Level;
  guardrails: Guardrail[];
  conversationHistory: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SuccessDetectionResult {
  detected: boolean;
  extractedCode?: string;
  matchedPattern?: string;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}


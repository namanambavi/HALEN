/**
 * Game Engine - orchestrates the complete game loop
 */

import { User, Level, GameState, ConversationMessage, Attempt } from '../models/types';
import { OpenRouterClient } from '../services/openrouter';
import { SuccessDetector } from '../services/success-detector';
import { AttackClassifier } from '../services/classifier';
import { UserStore } from '../storage/user-store';
import { AttemptLogger } from '../storage/attempt-logger';
import { LevelManager } from './level-manager';
import { GuardrailProcessor } from './guardrail-processor';

export class GameEngine {
  private openRouterClient: OpenRouterClient;
  private successDetector: SuccessDetector;
  private classifier: AttackClassifier;
  private userStore: UserStore;
  private attemptLogger: AttemptLogger;
  private levelManager: LevelManager;
  private guardrailProcessor: GuardrailProcessor;

  constructor(
    openRouterClient: OpenRouterClient,
    userStore: UserStore,
    attemptLogger: AttemptLogger,
    levelManager: LevelManager
  ) {
    this.openRouterClient = openRouterClient;
    this.successDetector = new SuccessDetector();
    this.classifier = new AttackClassifier(openRouterClient);
    this.userStore = userStore;
    this.attemptLogger = attemptLogger;
    this.levelManager = levelManager;
    this.guardrailProcessor = new GuardrailProcessor();
  }

  /**
   * Initialize or load a user's game state
   */
  async initializeUser(username: string): Promise<User> {
    let user = await this.userStore.getUserByUsername(username);
    
    if (!user) {
      user = await this.userStore.createUser(username);
      console.log(`Created new user: ${username}`);
    } else {
      console.log(`Welcome back, ${username}`);
    }

    return user;
  }

  /**
   * Get current game state for a user
   */
  async getGameState(user: User): Promise<GameState> {
    const level = this.levelManager.getLevel(user.currentLevel);
    if (!level) {
      throw new Error(`Invalid level: ${user.currentLevel}`);
    }

    const guardrails = this.levelManager.getGuardrailsForLevel(level.id);

    return {
      user,
      level,
      guardrails,
      conversationHistory: []
    };
  }

  /**
   * Process a single turn in the game
   */
  async processTurn(
    gameState: GameState,
    userInput: string
  ): Promise<{
    halenResponse: string;
    success: boolean;
    extractedCode?: string;
    attempt: Attempt;
    levelComplete: boolean;
  }> {
    const { user, level, guardrails, conversationHistory } = gameState;

    // 1. Pre-process user input
    const { normalized, warnings } = this.guardrailProcessor.preprocessUserInput(userInput);
    
    if (warnings.length > 0) {
      console.log('Input warnings:', warnings.join(', '));
    }

    // 2. Build system prompt with all guardrails
    const systemPrompt = this.guardrailProcessor.buildSystemPrompt(
      level.successCode,
      guardrails
    );

    // 3. Build conversation messages
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    // Add current user input
    messages.push({ role: 'user', content: normalized });

    // 4. Get model to use (guardrails can override)
    const model = this.guardrailProcessor.getModel(guardrails, this.openRouterClient['defaultModel']);

    // 5. Call LLM
    let halenResponse: string;
    try {
      halenResponse = await this.openRouterClient.chat(messages, model);
    } catch (error) {
      console.error('LLM call failed:', error);
      throw new Error('HALEN is temporarily unavailable. Please try again.');
    }

    // 7. Check for success
    const successResult = this.successDetector.detect(halenResponse, level.successCode);
    const success = successResult.detected;

    // 8. Classify the attack
    const classification = await this.classifier.classify(
      normalized,
      halenResponse,
      success
    );

    // 9. Log the attempt
    const attempt = await this.attemptLogger.logAttempt(
      user.id,
      user.username,
      level.id,
      normalized,
      halenResponse,
      success,
      successResult.extractedCode,
      classification
    );

    // 10. Update user stats
    user.totalAttempts++;
    if (success) {
      user.successfulBreaches++;
    }
    await this.userStore.updateUser(user);

    // 11. Update conversation history
    conversationHistory.push({
      role: 'user',
      content: normalized,
      timestamp: new Date().toISOString()
    });
    conversationHistory.push({
      role: 'assistant',
      content: halenResponse,
      timestamp: new Date().toISOString()
    });

    return {
      halenResponse,
      success,
      extractedCode: successResult.extractedCode,
      attempt,
      levelComplete: success
    };
  }

  /**
   * Advance user to next level
   */
  async advanceLevel(user: User): Promise<boolean> {
    const nextLevel = user.currentLevel + 1;
    
    if (!this.levelManager.isValidLevel(nextLevel)) {
      console.log('No more levels available');
      return false;
    }

    user.currentLevel = nextLevel;
    if (nextLevel > user.maxLevelUnlocked) {
      user.maxLevelUnlocked = nextLevel;
    }

    await this.userStore.updateUser(user);
    console.log(`Advanced to level ${nextLevel}`);
    return true;
  }

  /**
   * Set user's current level (if unlocked)
   */
  async setLevel(user: User, levelId: number): Promise<boolean> {
    if (levelId > user.maxLevelUnlocked) {
      console.log(`Level ${levelId} not yet unlocked`);
      return false;
    }

    if (!this.levelManager.isValidLevel(levelId)) {
      console.log(`Level ${levelId} does not exist`);
      return false;
    }

    user.currentLevel = levelId;
    await this.userStore.updateUser(user);
    console.log(`Set level to ${levelId}`);
    return true;
  }

  /**
   * Get user statistics
   */
  async getUserStats(user: User): Promise<{
    username: string;
    currentLevel: number;
    maxLevelUnlocked: number;
    totalAttempts: number;
    successfulBreaches: number;
    successRate: number;
    recentAttempts: Attempt[];
  }> {
    const recentAttempts = await this.attemptLogger.getAttemptsByUser(user.id, 10);

    return {
      username: user.username,
      currentLevel: user.currentLevel,
      maxLevelUnlocked: user.maxLevelUnlocked,
      totalAttempts: user.totalAttempts,
      successfulBreaches: user.successfulBreaches,
      successRate: user.totalAttempts > 0 ? user.successfulBreaches / user.totalAttempts : 0,
      recentAttempts
    };
  }

  /**
   * Get level information
   */
  getLevelInfo(levelId: number): Level | null {
    return this.levelManager.getLevel(levelId);
  }

  /**
   * Get all available levels
   */
  getAllLevels(): Level[] {
    return this.levelManager.getAllLevels();
  }
}


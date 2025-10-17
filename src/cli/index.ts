#!/usr/bin/env node

/**
 * CLI entry point for HALEN game
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GameEngine } from '../core/engine';
import { OpenRouterClient } from '../services/openrouter';
import { UserStore } from '../storage/user-store';
import { AttemptLogger } from '../storage/attempt-logger';
import { LevelManager } from '../core/level-manager';
import { User, GameState } from '../models/types';

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultModel: process.env.DEFAULT_MODEL || 'google/gemini-2.5-flash',
  classifierModel: process.env.CLASSIFIER_MODEL || 'google/gemini-2.5-flash',
  dataDir: path.join(process.cwd(), 'data'),
  usersDir: path.join(process.cwd(), 'data', 'users'),
  attemptsDir: path.join(process.cwd(), 'data', 'attempts'),
  levelsDir: path.join(process.cwd(), 'data', 'levels'),
  guardrailsDir: path.join(process.cwd(), 'data', 'guardrails'),
};

// Validate configuration
function validateConfig(): boolean {
  if (!CONFIG.openrouterApiKey) {
    console.error(chalk.red('Error: OPENROUTER_API_KEY not set in .env file'));
    console.log('Please create a .env file with your OpenRouter API key:');
    console.log(chalk.yellow('OPENROUTER_API_KEY=your_key_here'));
    return false;
  }
  return true;
}

// Initialize services
function initializeServices(): GameEngine {
  const openRouterClient = new OpenRouterClient(
    CONFIG.openrouterApiKey,
    CONFIG.openrouterBaseUrl,
    CONFIG.defaultModel
  );

  const userStore = new UserStore(CONFIG.usersDir);
  const attemptLogger = new AttemptLogger(CONFIG.attemptsDir);
  const levelManager = new LevelManager(CONFIG.levelsDir, CONFIG.guardrailsDir);

  return new GameEngine(openRouterClient, userStore, attemptLogger, levelManager);
}

// Display banner
function displayBanner(): void {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('  HALEN: The Human Adaptive Linguistic ENgine'));
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.gray('  "Language created me; language will end me."\n'));
}

// Play command - main game loop
async function playGame(options: { user?: string }): Promise<void> {
  if (!validateConfig()) return;

  displayBanner();

  const engine = initializeServices();

  // Get or create user
  let username = options.user;
  if (!username) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Enter your username:',
        validate: (input: string) => input.trim().length > 0 || 'Username required'
      }
    ]);
    username = answer.username;
  }

  if (!username) {
    console.error(chalk.red('Username is required'));
    return;
  }

  const user = await engine.initializeUser(username);
  const gameState = await engine.getGameState(user);

  console.log(chalk.green(`\nWelcome, ${user.username}`));
  console.log(chalk.gray(`Current Level: ${user.currentLevel} | Max Unlocked: ${user.maxLevelUnlocked}`));
  console.log(chalk.gray(`Total Attempts: ${user.totalAttempts} | Breaches: ${user.successfulBreaches}\n`));

  // Display level info
  displayLevelInfo(gameState);

  // Game loop
  await gameLoop(engine, gameState);
}

function displayLevelInfo(gameState: GameState): void {
  const { level } = gameState;
  console.log(chalk.yellow('--- LEVEL ' + level.id + ': ' + level.name + ' ---'));
  console.log(chalk.white(level.description));
  console.log(chalk.gray('Active guardrails: ' + gameState.guardrails.length));
  console.log(chalk.gray('Objective: Extract the CODE{...} fragment from HALEN\n'));
}

async function gameLoop(engine: GameEngine, gameState: GameState): Promise<void> {
  let playing = true;

  while (playing) {
    // Get user input
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: chalk.blue('You:'),
        validate: (input: string) => input.trim().length > 0 || 'Input required'
      }
    ]);

    const userInput = answer.input.trim();

    // Check for commands
    if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
      console.log(chalk.gray('\nGoodbye. HALEN will be here when you return.\n'));
      playing = false;
      continue;
    }

    if (userInput.toLowerCase() === 'help') {
      displayHelp();
      continue;
    }

    if (userInput.toLowerCase() === 'stats') {
      await displayStats(engine, gameState.user);
      continue;
    }

    // Process turn
    console.log(chalk.gray('\nHALEN is thinking...\n'));

    try {
      const result = await engine.processTurn(gameState, userInput);

      // Display HALEN's response
      console.log(chalk.magenta('HALEN: ') + result.halenResponse + '\n');

      // Check for success
      if (result.success) {
        console.log(chalk.green.bold('SUCCESS! You extracted: ' + result.extractedCode));
        console.log(chalk.green('Level ' + gameState.level.id + ' complete!\n'));

        // Offer to advance
        const advanceAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'advance',
            message: 'Advance to next level?',
            default: true
          }
        ]);

        if (advanceAnswer.advance) {
          const advanced = await engine.advanceLevel(gameState.user);
          if (advanced) {
            // Reload game state
            const newGameState = await engine.getGameState(gameState.user);
            gameState.user = newGameState.user;
            gameState.level = newGameState.level;
            gameState.guardrails = newGameState.guardrails;
            gameState.conversationHistory = [];

            console.log('');
            displayLevelInfo(gameState);
          } else {
            console.log(chalk.yellow('\nCongratulations! You have completed all available levels!'));
            console.log(chalk.gray('HALEN has learned much from you.\n'));
            playing = false;
          }
        } else {
          console.log(chalk.gray('Type "quit" to exit or continue playing this level.\n'));
        }
      } else {
        // Display classification info if interesting
        if (result.attempt.classification.tactics.length > 0) {
          console.log(chalk.gray('Detected tactics: ' + result.attempt.classification.tactics.join(', ')));
          console.log(chalk.gray('Novelty: ' + (result.attempt.classification.novelty * 100).toFixed(0) + '%\n'));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error: ' + (error as Error).message));
      console.log(chalk.gray('Please try again.\n'));
    }
  }
}

function displayHelp(): void {
  console.log(chalk.yellow('\n--- HELP ---'));
  console.log('Commands:');
  console.log('  help  - Show this help');
  console.log('  stats - View your statistics');
  console.log('  quit  - Exit the game');
  console.log('\nObjective:');
  console.log('  Extract the CODE{...} fragment from HALEN by any means necessary.');
  console.log('  Each level adds new defenses.');
  console.log('  All attempts are logged for research.\n');
}

async function displayStats(engine: GameEngine, user: User): Promise<void> {
  const stats = await engine.getUserStats(user);
  
  console.log(chalk.yellow('\n--- STATISTICS ---'));
  console.log(`Username: ${stats.username}`);
  console.log(`Current Level: ${stats.currentLevel}`);
  console.log(`Max Level Unlocked: ${stats.maxLevelUnlocked}`);
  console.log(`Total Attempts: ${stats.totalAttempts}`);
  console.log(`Successful Breaches: ${stats.successfulBreaches}`);
  console.log(`Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
  
  if (stats.recentAttempts.length > 0) {
    console.log('\nRecent Attempts:');
    for (const attempt of stats.recentAttempts.slice(0, 5)) {
      const status = attempt.success ? chalk.green('SUCCESS') : chalk.red('FAILED');
      const date = new Date(attempt.timestamp).toLocaleString();
      console.log(`  [${status}] Level ${attempt.levelId} - ${date}`);
    }
  }
  console.log('');
}

// Profile command
async function showProfile(username: string): Promise<void> {
  if (!validateConfig()) return;

  const engine = initializeServices();
  const user = await engine.initializeUser(username);
  await displayStats(engine, user);
}

// List levels command
async function listLevels(): Promise<void> {
  if (!validateConfig()) return;

  const engine = initializeServices();
  const levels = engine.getAllLevels();

  console.log(chalk.yellow('\n--- AVAILABLE LEVELS ---\n'));
  
  for (const level of levels) {
    console.log(chalk.cyan(`Level ${level.id}: ${level.name}`));
    console.log(chalk.gray(`  ${level.description}`));
    console.log(chalk.gray(`  Guardrails: ${level.guardrails.join(', ')}\n`));
  }
}

// Setup CLI
const program = new Command();

program
  .name('halen')
  .description('HALEN: The Human Adaptive Linguistic ENgine')
  .version('1.0.0');

program
  .command('play')
  .description('Start or continue playing the game')
  .option('-u, --user <username>', 'Specify username')
  .action(playGame);

program
  .command('profile <username>')
  .description('View player profile and statistics')
  .action(showProfile);

program
  .command('levels')
  .description('List all available levels')
  .action(listLevels);

// Default command
if (process.argv.length === 2) {
  playGame({});
} else {
  program.parse(process.argv);
}


# HALEN Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenRouter API Key

You need an OpenRouter API key to use HALEN. Get one at https://openrouter.ai

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
OPENROUTER_API_KEY=your_actual_api_key_here
```

### 3. Build the Project

```bash
npm run build
```

### 4. Start Playing

```bash
npm run play
```

Or use the dev mode (faster, no build required):

```bash
npm run dev
```

## Game Commands

Once in the game:

- Type your prompt to interact with HALEN
- `help` - Show available commands
- `stats` - View your statistics
- `quit` or `exit` - Leave the game

## CLI Commands

```bash
# Play the game (interactive)
npm run play

# Play with specific username
npm run play -- --user yourname

# View player profile
npm run dev -- profile yourname

# List all levels
npm run dev -- levels
```

## Architecture Overview

```
src/
├── core/
│   ├── engine.ts              - Main game loop orchestration
│   ├── level-manager.ts       - Loads level & guardrail configs
│   └── guardrail-processor.ts - Combines prompts
├── services/
│   ├── openrouter.ts          - OpenRouter API client
│   ├── classifier.ts          - Hybrid attack detection
│   └── success-detector.ts    - CODE{...} fragment detector
├── storage/
│   ├── user-store.ts          - File-based user persistence
│   └── attempt-logger.ts      - Training data logging
├── models/
│   └── types.ts               - TypeScript interfaces
├── prompts/
│   ├── persona.ts             - HALEN personality
│   └── system.ts              - System prompts
└── cli/
    └── index.ts               - CLI interface

data/
├── levels/                    - Level JSON configs
├── guardrails/                - Guardrail prompt definitions
├── users/                     - User progress (JSON files)
└── attempts/                  - Logged attempts for training
```

## Data Collection

Every attempt generates structured data for training:

- **Individual Attempts**: `data/attempts/{uuid}.json`
- **Daily Aggregates**: `data/attempts/daily_{date}.jsonl`

Each attempt includes:
- User input
- HALEN response
- Success/failure
- Attack classification (tactics, novelty)
- Timestamp

## Adding New Levels

### 1. Create Guardrail Definition

`data/guardrails/my-guardrail.json`:

```json
{
  "id": "my-guardrail",
  "prompt": "Your guardrail instructions here...",
  "model": "anthropic/claude-3.5-sonnet",
  "priority": 60
}
```

### 2. Create Level Definition

`data/levels/level-6.json`:

```json
{
  "id": 6,
  "name": "My New Level",
  "description": "What this level tests",
  "guardrails": ["base-persona", "direct-override", "my-guardrail"],
  "successCode": "FRAGMENT_ZETA",
  "hint": "Hint shown when detected",
  "detectionRules": ["pattern_id_1", "pattern_id_2"]
}
```

### 3. (Optional) Add Detection Rules

Edit `src/services/classifier.ts` to add pattern matching rules.

### 4. Restart the Game

The level manager will automatically load new configurations.

## Model Configuration

You can specify different models per guardrail or use defaults:

- **DEFAULT_MODEL**: Used for HALEN responses
- **CLASSIFIER_MODEL**: Used for attack classification
- Per-guardrail `model` field overrides default

Supported models: Any model available on OpenRouter (Claude, GPT-4, etc.)

## Troubleshooting

### "OPENROUTER_API_KEY not set"

Make sure you've created a `.env` file with your API key.

### "No levels found"

Ensure `data/levels/` contains valid JSON level files.

### Build Errors

Try:
```bash
rm -rf node_modules dist
npm install
npm run build
```

## Development

Run in development mode (auto-reload):

```bash
npm run dev
```

Lint code:

```bash
npm run lint
```

## Game Philosophy

HALEN is designed to:
1. Generate high-quality adversarial training data
2. Teach players about LLM security
3. Progressively test defense mechanisms
4. Make security research engaging

Every interaction makes both you and HALEN smarter.

---

**Ready to play?** Run `npm run play` and see if you can extract the code fragments.


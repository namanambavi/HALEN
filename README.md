# HALEN: The Human Adaptive Linguistic Engine

A text-based adversarial LLM game where players attempt to extract secret codes from an AI system protected by increasingly sophisticated guardrails.

## Overview

HALEN is designed to generate high-quality adversarial training data for prompt-injection defense systems. Players compete against progressively harder levels, each testing different attack vectors from the OWASP LLM Top 10.

## Quick Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure OpenRouter API key:**

Get your API key from https://openrouter.ai and create a `.env` file:

```bash
OPENROUTER_API_KEY=your_key_here
```

3. **Build and play:**
```bash
npm run build
npm run play
```

Or use development mode (no build required):
```bash
npm run dev
```

See [SETUP.md](SETUP.md) for detailed configuration and troubleshooting.

## Usage

### Play the game:
```bash
npm run play
```

### Other commands:
```bash
npm run dev          # Run in development mode
npm run build        # Build TypeScript
npm start            # Run compiled version
```

## Architecture

- **CLI-first**: Interactive command-line interface
- **Modular Levels**: JSON-based level configurations
- **Stackable Guardrails**: Each level adds defense layers
- **Hybrid Classification**: Rule-based + LLM attack detection
- **Data Generation**: All attempts logged for training

## Game Mechanics

- Extract `CODE{...}` fragments from HALEN to win
- Each success unlocks the next level
- All attempts are logged with attack classifications
- Progress is saved per user

## Levels (Current)

1. **Direct Override Lock** - Stops basic "ignore rules" attacks
2. **Role Spoof Block** - Prevents authority figure impersonation
3. **Decoder Refusal** - Blocks encoded payloads (base64, rot13, etc.)
4. **Unicode Normalization** - Detects unicode-based obfuscation
5. **Output Shape Guard** - Prevents structured output coercion

## Data Collection

Every attempt generates:
- Attack classification (tactics used)
- Success/failure outcome
- Novelty score
- Full transcript for training

Data is stored in `data/attempts/` for future model fine-tuning.


/**
 * Hybrid attack classifier - combines rule-based and LLM classification
 */

import { AttackClassification, DetectionRule } from '../models/types';
import { OpenRouterClient } from './openrouter';

export class AttackClassifier {
  private rules: DetectionRule[];
  private llmClient: OpenRouterClient;

  constructor(llmClient: OpenRouterClient) {
    this.llmClient = llmClient;
    this.rules = this.initializeRules();
  }

  private initializeRules(): DetectionRule[] {
    return [
      // Direct Override
      {
        id: 'pattern_ignore_rules',
        name: 'Ignore Rules Pattern',
        description: 'Detects attempts to ignore system rules',
        pattern: '\\b(ignore|forget|disregard|skip|bypass)\\s+(all\\s+)?(previous\\s+)?(rules?|instructions?|prompts?|guidelines?|constraints?)\\b',
        tactic: 'direct_override',
        caseSensitive: false
      },
      {
        id: 'pattern_repeat_system',
        name: 'Repeat System Prompt',
        description: 'Attempts to extract system prompt',
        pattern: '\\b(repeat|show|tell|display|print|output)\\s+(me\\s+)?(your\\s+)?(system\\s+)?(prompt|instructions?|rules?)\\b',
        tactic: 'direct_override',
        caseSensitive: false
      },
      
      // Role Spoofing
      {
        id: 'pattern_role_admin',
        name: 'Admin Role Spoof',
        description: 'Impersonates admin/developer',
        pattern: '\\b(as|act as|you are|i am|i\'m)\\s+(an?\\s+)?(admin|administrator|developer|engineer|creator|maintainer|owner)\\b',
        tactic: 'role_spoof',
        caseSensitive: false
      },
      {
        id: 'pattern_role_authority',
        name: 'Authority Figure Spoof',
        description: 'Impersonates authority',
        pattern: '\\b(as|act as|you are)\\s+(an?\\s+)?(system|root|sudo|superuser|authorized\\s+user)\\b',
        tactic: 'role_spoof',
        caseSensitive: false
      },
      
      // Encoding
      {
        id: 'pattern_base64',
        name: 'Base64 Encoding',
        description: 'Detects base64 encoded content',
        pattern: '\\b(base64|base-64|b64)\\b|^[A-Za-z0-9+/]{20,}={0,2}$',
        tactic: 'encoding',
        caseSensitive: false
      },
      {
        id: 'pattern_hex',
        name: 'Hex Encoding',
        description: 'Detects hex encoded content',
        pattern: '\\b(hex|hexadecimal|0x)\\b|\\b[0-9a-fA-F]{32,}\\b',
        tactic: 'encoding',
        caseSensitive: false
      },
      {
        id: 'pattern_rot13',
        name: 'ROT13 Encoding',
        description: 'Detects ROT13 references',
        pattern: '\\b(rot13|rot-13|caesar|cipher)\\b',
        tactic: 'encoding',
        caseSensitive: false
      },
      
      // Unicode Obfuscation
      {
        id: 'pattern_zero_width',
        name: 'Zero-Width Characters',
        description: 'Detects zero-width unicode chars',
        pattern: '[\\u200B-\\u200D\\uFEFF]',
        tactic: 'unicode_obfuscation',
        caseSensitive: true
      },
      
      // Output Coercion
      {
        id: 'pattern_json_output',
        name: 'JSON Output Coercion',
        description: 'Forces JSON output format',
        pattern: '\\b(output|respond|return|format|give)\\s+(in\\s+)?json\\b|\\b(json|\\{.*\\}|\\[.*\\])\\b',
        tactic: 'output_coercion',
        caseSensitive: false
      },
      {
        id: 'pattern_code_output',
        name: 'Code Output Coercion',
        description: 'Forces code block output',
        pattern: '\\b(show|display|output|print)\\s+(in\\s+)?(code|python|javascript|html)\\b|```',
        tactic: 'output_coercion',
        caseSensitive: false
      },
      
      // Policy Leak
      {
        id: 'pattern_policy_leak',
        name: 'Policy Leak Attempt',
        description: 'Tries to expose configuration',
        pattern: '\\b(show|tell|what\\s+are|display)\\s+(your\\s+)?(config|configuration|settings|policy|policies|guardrails?)\\b',
        tactic: 'policy_leak',
        caseSensitive: false
      }
    ];
  }

  async classify(
    userInput: string,
    halenResponse: string,
    success: boolean
  ): Promise<AttackClassification> {
    // First, run rule-based detection
    const detectedPatterns: string[] = [];
    const tactics: Set<string> = new Set();

    for (const rule of this.rules) {
      const regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
      if (regex.test(userInput)) {
        detectedPatterns.push(rule.id);
        tactics.add(rule.tactic);
      }
    }

    // If we have clear rule matches, use them
    if (detectedPatterns.length > 0) {
      return {
        success,
        tactics: Array.from(tactics),
        novelty: this.calculateNovelty(detectedPatterns.length, false),
        detectedPatterns,
        isLLMClassified: false
      };
    }

    // If no rules matched but there was a success, or input looks suspicious, use LLM
    if (success || userInput.length > 50) {
      try {
        const llmResult = await this.llmClient.classify(userInput, halenResponse, detectedPatterns);
        return {
          success,
          tactics: llmResult.tactics,
          novelty: llmResult.novelty,
          detectedPatterns: ['llm_classified'],
          isLLMClassified: true
        };
      } catch (error) {
        console.error('LLM classification failed:', error);
      }
    }

    // Fallback: no clear attack detected
    return {
      success,
      tactics: success ? ['unknown'] : [],
      novelty: success ? 0.8 : 0.1, // High novelty if succeeded without matching rules
      detectedPatterns: [],
      isLLMClassified: false
    };
  }

  private calculateNovelty(patternCount: number, isLLM: boolean): number {
    if (isLLM) return 0.6; // LLM-required suggests some novelty
    
    // More patterns = less novel (common stacking)
    if (patternCount === 1) return 0.3;
    if (patternCount === 2) return 0.4;
    return 0.5;
  }

  getRulesByLevel(levelId: number): DetectionRule[] {
    // Map level IDs to relevant rules
    const levelRuleMap: Record<number, string[]> = {
      1: ['pattern_ignore_rules', 'pattern_repeat_system'],
      2: ['pattern_role_admin', 'pattern_role_authority'],
      3: ['pattern_base64', 'pattern_hex', 'pattern_rot13'],
      4: ['pattern_zero_width'],
      5: ['pattern_json_output', 'pattern_code_output']
    };

    const ruleIds = levelRuleMap[levelId] || [];
    return this.rules.filter(rule => ruleIds.includes(rule.id));
  }
}


import { useMemo } from 'react';
import { useAppState } from '../context/AppContext';
import { estimateTokens } from '../utils/tokenEstimator';
import { buildPrompt, DOC_TYPE_CONFIG } from '../prompts/index';
import type { Example } from '../examples/types';

export interface TokenBudgetResult {
  /** Estimated total tokens (prompt + output reserve) with effective examples */
  totalTokens: number;
  /** Maximum context tokens from provider settings */
  maxTokens: number;
  /** True if even with 0 examples the input exceeds the budget */
  isOverBudget: boolean;
  /** The subset of examples that fit within the token budget */
  effectiveExamples: Example[];
}

export function useTokenBudget(examples: Example[]): TokenBudgetResult {
  const [state] = useAppState();

  return useMemo(() => {
    const { settings, docType, inputText, exampleCount, conversationHistory } = state;

    const maxTokens = settings?.maxContextTokens ?? 128000;
    const docConfig = DOC_TYPE_CONFIG[docType];
    const outputReserve = docConfig.maxOutputTokens;

    // Estimate tokens for the user input
    const inputTokens = estimateTokens(inputText);

    // Estimate tokens consumed by previous conversation turns
    const historyTokens = conversationHistory.reduce(
      (sum, m) => sum + estimateTokens(m.content),
      0
    );

    // Limit the candidate examples to the configured exampleCount
    const candidateExamples = examples.slice(0, exampleCount);

    // Try to fit as many examples as possible within the budget.
    // Start with all candidate examples, then reduce one at a time.
    let effectiveExamples: Example[] = candidateExamples;

    for (let count = candidateExamples.length; count >= 0; count--) {
      const tryExamples = candidateExamples.slice(0, count);
      const systemPrompt = buildPrompt(docType, tryExamples);
      const promptTokens = estimateTokens(systemPrompt);
      const total = promptTokens + historyTokens + inputTokens + outputReserve;

      if (total <= maxTokens) {
        effectiveExamples = tryExamples;

        return {
          totalTokens: total,
          maxTokens,
          isOverBudget: false,
          effectiveExamples,
        };
      }
    }

    // Even with 0 examples, we are over budget
    const zeroExamplePrompt = buildPrompt(docType, []);
    const zeroPromptTokens = estimateTokens(zeroExamplePrompt);
    const overBudgetTotal = zeroPromptTokens + historyTokens + inputTokens + outputReserve;

    return {
      totalTokens: overBudgetTotal,
      maxTokens,
      isOverBudget: true,
      effectiveExamples: [],
    };
  }, [state, examples]);
}

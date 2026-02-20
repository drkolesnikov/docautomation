interface TokenBudgetProps {
  totalTokens: number;
  maxTokens: number;
  isOverBudget: boolean;
}

export default function TokenBudget({ totalTokens, maxTokens, isOverBudget }: TokenBudgetProps) {
  const formatTokens = (n: number): string => {
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  };

  return (
    <div className={`text-xs ${isOverBudget ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
      ~{formatTokens(totalTokens)} / {formatTokens(maxTokens)}
      {isOverBudget && <span className="ml-1">— превышен лимит</span>}
    </div>
  );
}

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
    <div className={[
      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150',
      isOverBudget
        ? 'border border-rose-200 bg-rose-50 text-rose-600'
        : 'border border-slate-200 bg-slate-50 text-slate-500',
    ].join(' ')}>
      <span>~{formatTokens(totalTokens)}</span>
      <span className="opacity-40">/</span>
      <span>{formatTokens(maxTokens)}</span>
      {isOverBudget && <span className="ml-0.5 opacity-80">· лимит!</span>}
    </div>
  );
}

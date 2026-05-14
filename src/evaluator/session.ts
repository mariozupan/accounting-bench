import type { 
  AccountingBenchmarkResult, 
  Session, 
  Transaction, 
  EvaluateOptions, 
  ScoreWeights 
} from "../types";
import { DEFAULT_WEIGHTS } from "../types";
import { validateDoubleEntry, validateAccountOpening } from "../validator/double-entry";
import { validateBalanceSheet, validatePNL, validateCashFlow } from "../validator/statements";
import { generateHledgerJournal } from "../generator/hledger";
import { loadSessionFromPath } from "../hf/loader";

export async function evaluateSession(
  sessionPath: string,
  options?: Partial<EvaluateOptions>
): Promise<AccountingBenchmarkResult> {
  const startTime = Date.now();
  const weights = options?.weights || DEFAULT_WEIGHTS;

  // Load session
  const session = await loadSessionFromPath(sessionPath);

  // Extract transactions from session (placeholder - implement based on session format)
  const transactions = extractTransactionsFromSession(session);

  // Generate hledger journal
  const generatedJournal = generateHledgerJournal(transactions);

  // Validate double-entry
  const doubleEntryResults = transactions.map(t => validateDoubleEntry(t));
  const balancedTransactions = doubleEntryResults.filter(r => r.isBalanced).length;
  const unbalancedTransactions = doubleEntryResults.filter(r => !r.isBalanced).length;

  // Validate account opening
  const accountOpeningResults = transactions.map(t => validateAccountOpening(t));
  const accountsOpened = accountOpeningResults
    .filter(r => r.isNewAccount)
    .map(r => r.accountName);

  // Validate financial statements
  const balanceSheetResult = validateBalanceSheet(transactions);
  const pnlResult = validatePNL(transactions);
  const cashFlowResult = validateCashFlow(transactions);

  // Calculate scores
  const accountOpeningScore = calculateAccountOpeningScore(accountOpeningResults);
  const doubleEntryScore = calculateDoubleEntryScore(balancedTransactions, transactions.length);
  const balanceSheetScore = balanceSheetResult.isValid ? 100 : 0;
  const pnlScore = pnlResult.isValid ? 100 : 0;
  const cashFlowScore = cashFlowResult.isValid ? 100 : 0;
  const reasoningTimeScore = calculateReasoningTimeScore(session.duration);
  const accountMappingScore = 100; // Placeholder

  // Weighted overall score
  const overall = 
    (accountOpeningScore * weights.accountOpening / 100) +
    (doubleEntryScore * weights.doubleEntry / 100) +
    (balanceSheetScore * weights.balanceSheet / 100) +
    (pnlScore * weights.pnl / 100) +
    (cashFlowScore * weights.cashFlow / 100) +
    (reasoningTimeScore * weights.reasoningTime / 100) +
    (accountMappingScore * weights.accountMapping / 100);

  // Collect errors and warnings
  const errors: string[] = [];
  const warnings: string[] = [];

  if (unbalancedTransactions > 0) {
    errors.push(`${unbalancedTransactions} unbalanced transaction(s)`);
  }
  if (!balanceSheetResult.isValid) {
    errors.push(`Balance sheet does not balance: Assets=${balanceSheetResult.totalAssets}, Liabilities+Equity=${balanceSheetResult.totalLiabilities + balanceSheetResult.totalEquity}`);
  }
  if (!pnlResult.isValid) {
    warnings.push(`P&L calculation shows inconsistency`);
  }

  const evaluationTimeMs = Date.now() - startTime;

  return {
    sessionId: session.id,
    taskType: determineTaskType(transactions),
    difficulty: determineDifficulty(transactions),
    userPrompt: session.messages[0]?.content || "",
    generatedJournal,
    transactions,
    scores: {
      accountOpeningValidity: accountOpeningScore,
      doubleEntryValidity: doubleEntryScore,
      balanceSheetValidity: balanceSheetScore,
      pnlValidity: pnlScore,
      cashFlowValidity: cashFlowScore,
      reasoningTimeScore,
      accountMappingAccuracy: accountMappingScore,
      overall,
    },
    accountsOpened,
    balancedTransactions,
    unbalancedTransactions,
    financialStatements: {
      balanceSheet: balanceSheetResult,
      pnl: pnlResult,
      cashFlow: cashFlowResult,
    },
    errors,
    warnings,
    suggestions: generateSuggestions(errors, warnings),
    evaluationTimeMs,
    sessionDurationSeconds: session.duration,
  };
}

function extractTransactionsFromSession(session: Session): Transaction[] {
  // Placeholder - implement based on actual session format
  // This should parse session.messages and extract accounting transactions
  return session.transactions || [];
}

function calculateAccountOpeningScore(results: Array<{ isValid: boolean }>): number {
  if (results.length === 0) return 100;
  const valid = results.filter(r => r.isValid).length;
  return (valid / results.length) * 100;
}

function calculateDoubleEntryScore(balanced: number, total: number): number {
  if (total === 0) return 100;
  return (balanced / total) * 100;
}

function calculateReasoningTimeScore(durationSeconds: number): number {
  // Lower is better - convert to 0-100 score
  // Assume 60 seconds is average, scale accordingly
  if (durationSeconds <= 30) return 100;
  if (durationSeconds <= 60) return 80;
  if (durationSeconds <= 120) return 60;
  if (durationSeconds <= 300) return 40;
  return 20;
}

function determineTaskType(transactions: Transaction[]): "transaction" | "reconciliation" | "statement" | "analysis" {
  if (transactions.length === 1) return "transaction";
  if (transactions.length <= 5) return "reconciliation";
  return "statement";
}

function determineDifficulty(transactions: Transaction[]): "easy" | "medium" | "hard" | "expert" {
  if (transactions.length <= 2) return "easy";
  if (transactions.length <= 10) return "medium";
  if (transactions.length <= 50) return "hard";
  return "expert";
}

function generateSuggestions(errors: string[], warnings: string[]): string[] {
  const suggestions: string[] = [];
  
  if (errors.includes("unbalanced transaction(s)")) {
    suggestions.push("Ensure debits equal credits for each transaction");
  }
  if (errors.some(e => e.includes("Balance sheet"))) {
    suggestions.push("Check that Assets = Liabilities + Equity");
  }
  
  return suggestions;
}

export async function evaluateMultiple(
  sessionPaths: string[],
  options?: Partial<EvaluateOptions>
): Promise<AccountingBenchmarkResult[]> {
  const results: AccountingBenchmarkResult[] = [];
  
  for (const path of sessionPaths) {
    try {
      const result = await evaluateSession(path, options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to evaluate ${path}:`, error);
    }
  }
  
  return results;
}

export function generateAggregateReport(results: AccountingBenchmarkResult[]): {
  totalSessions: number;
  averageScores: Record<string, number>;
  passRate: number;
  distribution: Record<string, number>;
} {
  const totalSessions = results.length;
  
  const averageScores: Record<string, number> = {};
  const scoreKeys = [
    "accountOpeningValidity",
    "doubleEntryValidity",
    "balanceSheetValidity",
    "pnlValidity",
    "cashFlowValidity",
    "reasoningTimeScore",
    "accountMappingAccuracy",
    "overall"
  ];
  
  for (const key of scoreKeys) {
    if (results.length > 0) {
      const sum = results.reduce((acc, r) => acc + (r.scores as any)[key], 0);
      averageScores[key] = sum / results.length;
    }
  }
  
  const passRate = results.filter(r => r.scores.overall >= 70).length / totalSessions * 100;
  
  const distribution: Record<string, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
  };
  
  for (const result of results) {
    distribution[result.difficulty]++;
  }
  
  return { totalSessions, averageScores, passRate, distribution };
}
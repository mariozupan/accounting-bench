// Core types for accounting benchmark

export interface Posting {
  account: string;
  amount: number;
  currency?: string;
  type: "debit" | "credit";
}

export interface Transaction {
  date: string;
  flag?: string;
  payee?: string;
  narration?: string;
  postings: Posting[];
  tags?: string[];
  links?: string[];
}

export interface Account {
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  openingBalance?: number;
  isOpened: boolean;
}

export interface Session {
  id: string;
  timestamp: string;
  duration: number;  // seconds
  model: string;
  provider: string;
  messages: SessionMessage[];
  transactions: Transaction[];
}

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: string;
}

export interface FinancialStatements {
  balanceSheet: {
    assets: Record<string, number>;
    liabilities: Record<string, number>;
    equity: Record<string, number>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    isBalanced: boolean;
  };
  pnl: {
    income: Record<string, number>;
    expenses: Record<string, number>;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
  };
  cashFlow: {
    operating: number;
    investing: number;
    financing: number;
    netChange: number;
  };
}

export interface ScoreWeights {
  accountOpening: number;
  doubleEntry: number;
  balanceSheet: number;
  pnl: number;
  cashFlow: number;
  reasoningTime: number;
  accountMapping: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  accountOpening: 15,
  doubleEntry: 25,
  balanceSheet: 20,
  pnl: 20,
  cashFlow: 10,
  reasoningTime: 5,
  accountMapping: 5,
};

export interface AccountingBenchmarkResult {
  sessionId: string;
  taskType: "transaction" | "reconciliation" | "statement" | "analysis";
  difficulty: "easy" | "medium" | "hard" | "expert";
  
  // Input
  userPrompt: string;
  
  // Output
  generatedJournal: string;
  transactions: Transaction[];
  
  // Scores (0-100 each)
  scores: {
    accountOpeningValidity: number;
    doubleEntryValidity: number;
    balanceSheetValidity: number;
    pnlValidity: number;
    cashFlowValidity: number;
    reasoningTimeScore: number;
    accountMappingAccuracy: number;
    
    overall: number;
  };
  
  // Details
  accountsOpened: string[];
  balancedTransactions: number;
  unbalancedTransactions: number;
  financialStatements: FinancialStatements;
  
  // Feedback
  errors: string[];
  warnings: string[];
  suggestions: string[];
  
  // Timing
  evaluationTimeMs: number;
  sessionDurationSeconds: number;
}

export interface EvaluateOptions {
  // Source
  source: "hf" | "local";
  sourcePath: string;
  revision?: string;
  
  // Filters
  session?: string;
  taskType?: "transaction" | "reconciliation" | "statement" | "analysis";
  difficulty?: "easy" | "medium" | "hard" | "expert";
  dateFrom?: string;
  dateTo?: string;
  
  // Output
  output: "json" | "csv" | "html";
  outputPath: string;
  
  // Scoring
  weights?: ScoreWeights;
  
  // Performance
  parallel: number;
}
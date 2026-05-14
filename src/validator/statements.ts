import type { Transaction, Posting, FinancialStatements } from "../types";
import { determineAccountType } from "./double-entry";

/**
 * Validates balance sheet: Assets = Liabilities + Equity
 */
export function validateBalanceSheet(transactions: Transaction[]): {
  isValid: boolean;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  errors: string[];
} {
  const assets: Record<string, number> = {};
  const liabilities: Record<string, number> = {};
  const equity: Record<string, number> = {};
  const errors: string[] = [];

  for (const transaction of transactions) {
    for (const posting of transaction.postings) {
      const accountType = determineAccountType(posting.account);
      const account = posting.account;
      const amount = posting.type === "debit" ? posting.amount : -posting.amount;

      switch (accountType) {
        case "asset":
          assets[account] = (assets[account] || 0) + amount;
          break;
        case "liability":
          liabilities[account] = (liabilities[account] || 0) + amount;
          break;
        case "equity":
          equity[account] = (equity[account] || 0) + amount;
          break;
      }
    }
  }

  const totalAssets = Object.values(assets).reduce((sum, v) => sum + v, 0);
  const totalLiabilities = Object.values(liabilities).reduce((sum, v) => sum + v, 0);
  const totalEquity = Object.values(equity).reduce((sum, v) => sum + v, 0);

  const difference = Math.abs(totalAssets - (totalLiabilities + totalEquity));
  const isBalanced = difference < 0.01; // Allow for small floating point errors

  if (!isBalanced) {
    errors.push(
      `Balance sheet does not balance: Assets(${totalAssets}) != Liabilities(${totalLiabilities}) + Equity(${totalEquity})`
    );
  }

  return {
    isValid: isBalanced,
    totalAssets,
    totalLiabilities,
    totalEquity,
    difference,
    assets,
    liabilities,
    equity,
    errors,
  };
}

/**
 * Validates Profit & Loss statement: Revenue - Expenses = Net Income
 */
export function validatePNL(transactions: Transaction[]): {
  isValid: boolean;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  income: Record<string, number>;
  expenses: Record<string, number>;
  errors: string[];
} {
  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const errors: string[] = [];

  for (const transaction of transactions) {
    for (const posting of transaction.postings) {
      const accountType = determineAccountType(posting.account);
      const account = posting.account;
      // For P&L, income increases with credit, expenses increase with debit
      const amount = posting.type === "credit" ? posting.amount : -posting.amount;

      switch (accountType) {
        case "income":
          income[account] = (income[account] || 0) + amount;
          break;
        case "expense":
          expenses[account] = (expenses[account] || 0) + amount;
          break;
      }
    }
  }

  const totalIncome = Object.values(income).reduce((sum, v) => sum + v, 0);
  const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const netIncome = totalIncome - totalExpenses;

  // For validation, net income should be reasonable
  // P&L is valid if it has content
  const isValid = totalIncome > 0 || totalExpenses > 0;

  return {
    isValid,
    totalIncome,
    totalExpenses,
    netIncome,
    income,
    expenses,
    errors: netIncome < 0 ? ["Negative net income (loss) detected"] : [],
  };
}

/**
 * Validates Cash Flow statement
 */
export function validateCashFlow(transactions: Transaction[]): {
  isValid: boolean;
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  errors: string[];
} {
  // Cash flow categorization
  const cashAccounts = ["bank", "cash", "savings", "checking"];
  const operatingAccounts = ["revenue", "expense", "cost", "salary", "utility", "rent"];
  const investingAccounts = ["equipment", "asset", "investment", "property"];
  const financingAccounts = ["loan", "debt", "equity", "capital", "dividend"];

  let operating = 0;
  let investing = 0;
  let financing = 0;
  const errors: string[] = [];

  for (const transaction of transactions) {
    for (const posting of transaction.postings) {
      const account = posting.account.toLowerCase();
      const amount = posting.amount;

      // Check if this involves cash accounts
      if (cashAccounts.some(c => account.includes(c))) {
        // Categorize based on other posting
        const otherPostings = transaction.postings.filter(p => p.account !== posting.account);
        for (const other of otherPostings) {
          const otherAccount = other.account.toLowerCase();
          
          if (operatingAccounts.some(c => otherAccount.includes(c))) {
            operating += amount;
          } else if (investingAccounts.some(c => otherAccount.includes(c))) {
            investing += amount;
          } else if (financingAccounts.some(c => otherAccount.includes(c))) {
            financing += amount;
          }
        }
      }
    }
  }

  const netChange = operating + investing + financing;

  // Cash flow is valid if we have cash movements
  const isValid = Math.abs(netChange) > 0 || operating !== 0;

  return {
    isValid,
    operating,
    investing,
    financing,
    netChange,
    errors,
  };
}

/**
 * Generates complete financial statements from transactions
 */
export function generateFinancialStatements(transactions: Transaction[]): FinancialStatements {
  const balanceSheet = validateBalanceSheet(transactions);
  const pnl = validatePNL(transactions);
  const cashFlow = validateCashFlow(transactions);

  return {
    balanceSheet: {
      assets: balanceSheet.assets,
      liabilities: balanceSheet.liabilities,
      equity: balanceSheet.equity,
      totalAssets: balanceSheet.totalAssets,
      totalLiabilities: balanceSheet.totalLiabilities,
      totalEquity: balanceSheet.totalEquity,
      isBalanced: balanceSheet.isValid,
    },
    pnl: {
      income: pnl.income,
      expenses: pnl.expenses,
      totalIncome: pnl.totalIncome,
      totalExpenses: pnl.totalExpenses,
      netIncome: pnl.netIncome,
    },
    cashFlow: {
      operating: cashFlow.operating,
      investing: cashFlow.investing,
      financing: cashFlow.financing,
      netChange: cashFlow.netChange,
    },
  };
}

/**
 * Calculates common financial ratios
 */
export function calculateRatios(statements: FinancialStatements): Record<string, number> {
  const ratios: Record<string, number> = {};

  // Liquidity ratios
  const currentAssets = Object.values(statements.balanceSheet.assets).reduce((a, b) => a + b, 0);
  const currentLiabilities = Object.values(statements.balanceSheet.liabilities).reduce((a, b) => a + b, 0);
  
  ratios.currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  
  // Profitability ratios
  if (statements.pnl.totalIncome > 0) {
    ratios.profitMargin = statements.pnl.netIncome / statements.pnl.totalIncome;
    ratios.grossMargin = statements.pnl.totalIncome > 0 
      ? (statements.pnl.totalIncome - statements.pnl.totalExpenses) / statements.pnl.totalIncome 
      : 0;
  }

  // Return on Equity
  const totalEquity = statements.balanceSheet.totalEquity;
  if (totalEquity > 0) {
    ratios.returnOnEquity = statements.pnl.netIncome / totalEquity;
  }

  return ratios;
}
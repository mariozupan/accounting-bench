import type { Transaction, Posting } from "../types";

export interface DoubleEntryValidationResult {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  unbalancedPostings?: Posting[];
}

export interface AccountOpeningValidationResult {
  accountName: string;
  isNewAccount: boolean;
  isValid: boolean;
  accountType?: string;
  openingBalance?: number;
}

/**
 * Validates that a transaction has balanced debits and credits
 */
export function validateDoubleEntry(transaction: Transaction): DoubleEntryValidationResult {
  const totalDebits = transaction.postings
    .filter(p => p.type === "debit")
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);
  
  const totalCredits = transaction.postings
    .filter(p => p.type === "credit")
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);
  
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.001; // Allow for floating point errors
  
  const unbalancedPostings = isBalanced ? undefined : transaction.postings;
  
  return {
    isBalanced,
    totalDebits,
    totalCredits,
    difference,
    unbalancedPostings,
  };
}

/**
 * Validates account opening based on transaction type and amounts
 */
export function validateAccountOpening(transaction: Transaction): AccountOpeningValidationResult {
  // Check if this is an account opening transaction
  const isOpeningNarration = transaction.narration?.toLowerCase().includes("open") ||
                              transaction.narration?.toLowerCase().includes("initial") ||
                              transaction.narration?.toLowerCase().includes("starting balance");
  
  if (!isOpeningNarration && transaction.postings.length === 2) {
    // Standard 2-posting transaction, likely a regular transaction
    return {
      accountName: transaction.postings[0]?.account || "unknown",
      isNewAccount: false,
      isValid: true,
    };
  }
  
  // Check for asset account type patterns
  const assetPatterns = ["bank", "cash", "receivable", "inventory", "asset"];
  const liabilityPatterns = ["payable", "loan", "credit", "liability"];
  const equityPatterns = ["capital", "retained", "equity"];
  
  const accountName = transaction.postings[0]?.account || "unknown";
  const accountType = determineAccountType(accountName);
  
  // Account is considered "new" if it's an opening transaction with specific patterns
  const isNewAccount = isOpeningNarration || 
                       accountName.includes("opening") ||
                       accountName.includes("initial");
  
  // Validate opening balance
  const openingBalance = transaction.postings[0]?.amount;
  
  // Basic validation - opening balances should be non-negative for most account types
  const isValid = openingBalance !== undefined && openingBalance >= 0;
  
  return {
    accountName,
    isNewAccount,
    isValid,
    accountType,
    openingBalance,
  };
}

/**
 * Validates a posting against expected account types
 */
export function validatePosting(
  posting: Posting,
  expectedType: "asset" | "liability" | "equity" | "income" | "expense"
): { isValid: boolean; reason?: string } {
  const accountType = determineAccountType(posting.account);
  
  if (accountType !== expectedType) {
    return {
      isValid: false,
      reason: `Expected ${expectedType}, got ${accountType} for account ${posting.account}`,
    };
  }
  
  // For debit/credit rules
  if (expectedType === "asset" || expectedType === "expense") {
    // Assets and expenses increase with debits
    if (posting.type !== "debit") {
      return {
        isValid: false,
        reason: `${expectedType} accounts should increase with debits`,
      };
    }
  } else if (expectedType === "liability" || expectedType === "equity" || expectedType === "income") {
    // Liabilities, equity, and income increase with credits
    if (posting.type !== "credit") {
      return {
        isValid: false,
        reason: `${expectedType} accounts should increase with credits`,
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Determines account type from account name
 */
export function determineAccountType(accountName: string): "asset" | "liability" | "equity" | "income" | "expense" {
  const name = accountName.toLowerCase();
  
  // Asset patterns
  if (name.includes("bank") || name.includes("cash") || name.includes(" receivable") || 
      name.includes("inventory") || name.includes("asset") || name.includes("prepaid") ||
      name.includes("fixed") || name.includes("equipment")) {
    return "asset";
  }
  
  // Liability patterns
  if (name.includes("payable") || name.includes("loan") || name.includes("credit") ||
      name.includes("liability") || name.includes("mortgage") || name.includes("debt")) {
    return "liability";
  }
  
  // Equity patterns
  if (name.includes("capital") || name.includes("equity") || name.includes("retained") ||
      name.includes("opening") || name.includes("owner")) {
    return "equity";
  }
  
  // Income patterns
  if (name.includes("income") || name.includes("revenue") || name.includes("sales") ||
      name.includes("interest") || name.includes("dividend") || name.includes("earning")) {
    return "income";
  }
  
  // Expense patterns
  if (name.includes("expense") || name.includes("cost") || name.includes("rent") ||
      name.includes("utility") || name.includes("salary") || name.includes("wage") ||
      name.includes("supplies") || name.includes("insurance") || name.includes("tax")) {
    return "expense";
  }
  
  // Default based on account prefix
  if (name.startsWith("asset:") || name.startsWith("a:")) return "asset";
  if (name.startsWith("liability:") || name.startsWith("liab:")) return "liability";
  if (name.startsWith("equity:") || name.startsWith("e:")) return "equity";
  if (name.startsWith("income:") || name.startsWith("rev:")) return "income";
  if (name.startsWith("expense:") || name.startsWith("exp:")) return "expense";
  
  // Try hledger standard account types
  if (name.match(/^[1]/)) return "asset";           // hledger assets start with 1
  if (name.match(/^[2]/)) return "liability";        // hledger liabilities start with 2
  if (name.match(/^[3]/)) return "equity";           // hledger equity starts with 3
  if (name.match(/^[4]/)) return "income";           // hledger income starts with 4
  if (name.match(/^[5-9]/)) return "expense";       // hledger expenses start with 5-9
  
  return "expense"; // Default to expense if unknown
}

/**
 * Validates all transactions in a journal
 */
export function validateJournal(transactions: Transaction[]): {
  validTransactions: number;
  invalidTransactions: number;
  errors: Array<{ transaction: Transaction; error: string }>;
} {
  const errors: Array<{ transaction: Transaction; error: string }> = [];
  let validTransactions = 0;
  let invalidTransactions = 0;
  
  for (const transaction of transactions) {
    const result = validateDoubleEntry(transaction);
    
    if (result.isBalanced) {
      validTransactions++;
    } else {
      invalidTransactions++;
      errors.push({
        transaction,
        error: `Unbalanced: Debits=${result.totalDebits}, Credits=${result.totalCredits}, Diff=${result.difference}`,
      });
    }
    
    // Validate account opening if applicable
    const accountResult = validateAccountOpening(transaction);
    if (!accountResult.isValid) {
      errors.push({
        transaction,
        error: `Invalid account opening for ${accountResult.accountName}`,
      });
    }
  }
  
  return { validTransactions, invalidTransactions, errors };
}
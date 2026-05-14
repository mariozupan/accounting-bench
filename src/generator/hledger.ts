import type { Transaction, Posting } from "../types";

/**
 * Generates hledger-format journal entries from transactions
 */
export function generateHledgerJournal(transactions: Transaction[]): string {
  const lines: string[] = [];
  
  lines.push("; Auto-generated hledger journal from accounting benchmark");
  lines.push(`; Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const transaction of transactions) {
    lines.push(formatTransaction(transaction));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Formats a single transaction in hledger format
 */
export function formatTransaction(transaction: Transaction): string {
  const lines: string[] = [];

  // Date and optional flag
  let line = transaction.date;
  if (transaction.flag) {
    line += ` ${transaction.flag}`;
  }
  lines.push(line);

  // Payee/Narration
  if (transaction.payee || transaction.narration) {
    const text = transaction.payee || transaction.narration || "";
    lines.push(`    ${text}`);
  }

  // Postings
  for (const posting of transaction.postings) {
    let postingLine = `    ${posting.account}`;
    
    // Amount (right-aligned for hledger format)
    if (posting.amount !== 0) {
      const amountStr = formatAmount(posting.amount);
      postingLine = postingLine.padEnd(40) + amountStr;
    }
    
    lines.push(postingLine);
  }

  // Tags and links
  if (transaction.tags && transaction.tags.length > 0) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine + "  " + transaction.tags.map(t => `#${t}`).join(" ");
  }
  
  if (transaction.links && transaction.links.length > 0) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine + "  " + transaction.links.map(l => `^${l}`).join(" ");
  }

  return lines.join("\n");
}

/**
 * Formats amount for hledger (handles negative amounts with parentheses)
 */
export function formatAmount(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2);
  
  if (amount < 0) {
    return `(${formatted})`;
  }
  return formatted;
}

/**
 * Parses an hledger entry string back to Transaction object
 */
export function parseHledgerEntry(entryText: string): Transaction | null {
  try {
    const lines = entryText.trim().split("\n").map(l => l.trim());
    
    if (lines.length < 2) return null;

    // Parse date
    const dateLine = lines[0];
    const dateMatch = dateLine.match(/^(\d{4}-\d{2}-\d{2})(?:\s+([*!]))?/);
    if (!dateMatch) return null;
    
    const date = dateMatch[1];
    const flag = dateMatch[2];

    // Parse payee/narration
    const payee = lines[1].startsWith("    ") ? lines[1].replace(/^    /, "") : undefined;

    // Parse postings
    const postings: Posting[] = [];
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments and empty lines
      if (line.startsWith(";") || !line.trim()) continue;
      
      // Check for tags/links at end of line
      let cleanLine = line;
      const tags: string[] = [];
      const links: string[] = [];
      
      const tagMatch = cleanLine.match(/(.*?)(?:\s+#(\w+))+/g);
      if (tagMatch) {
        const tagResult = cleanLine.match(/#(\w+)/g);
        if (tagResult) {
          tags.push(...tagResult.map(t => t.substring(1)));
        }
        const linkResult = cleanLine.match(/\^(\w+)/g);
        if (linkResult) {
          links.push(...linkResult.map(l => l.substring(1)));
        }
      }

      // Parse account and amount
      const postingMatch = cleanLine.match(/^\s+(\S.*?)(?:\s+([\d.-]+(?:\s+\w{3})?|\([\d.-]+\))(?:\s+\S.*?)?)?\s*$/);
      if (postingMatch) {
        const account = postingMatch[1];
        const amountStr = postingMatch[2]?.replace(/[()]/g, "").trim();
        const amount = amountStr ? parseFloat(amountStr) : 0;
        
        // Determine debit/credit from account type
        const type = determinePostingType(account, amount);
        
        postings.push({
          account,
          amount: Math.abs(amount),
          type,
        });
      }
    }

    return {
      date,
      flag,
      payee,
      postings,
    };
  } catch {
    return null;
  }
}

/**
 * Determines if a posting is a debit or credit based on account type
 */
export function determinePostingType(account: string, amount: number): "debit" | "credit" {
  const name = account.toLowerCase();
  
  // For positive amounts, determine type based on account
  // For assets and expenses: positive = debit
  // For liabilities, equity, income: positive = credit
  if (name.includes("expense") || name.includes("cost") || 
      name.includes("bank") || name.includes("cash") || name.includes("asset")) {
    return amount >= 0 ? "debit" : "credit";
  }
  
  return amount >= 0 ? "credit" : "debit";
}

/**
 * Validates hledger format
 */
export function validateHledgerFormat(journal: string): {
  isValid: boolean;
  lineCount: number;
  transactionCount: number;
  errors: string[];
} {
  const lines = journal.split("\n");
  const errors: string[] = [];
  let transactionCount = 0;
  
  let inTransaction = false;
  let postingCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith(";") || !line) continue;
    
    // Check for date line
    if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
      if (inTransaction && postingCount < 2) {
        errors.push(`Line ${i + 1}: Transaction must have at least 2 postings`);
      }
      inTransaction = true;
      postingCount = 0;
      transactionCount++;
    } else if (inTransaction && line.match(/^\s+\S/)) {
      postingCount++;
    }
  }
  
  return {
    isValid: errors.length === 0,
    lineCount: lines.length,
    transactionCount,
    errors,
  };
}

/**
 * Converts hledger journal to balanced transaction list
 */
export function journalToTransactions(journal: string): Transaction[] {
  const transactions: Transaction[] = [];
  const entries = journal.split(/(?=\d{4}-\d{2}-\d{2})/);
  
  for (const entry of entries) {
    const transaction = parseHledgerEntry(entry);
    if (transaction) {
      transactions.push(transaction);
    }
  }
  
  return transactions;
}
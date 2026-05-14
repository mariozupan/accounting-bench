import { createExtension } from "./extension";

// Debug: Log when module is loaded
console.log("[accounting-bench] Module loaded");

export { evaluateSession } from "./evaluator/session";
export { validateDoubleEntry, validateAccountOpening } from "./validator/double-entry";
export { validateBalanceSheet, validatePNL, validateCashFlow } from "./validator/statements";
export { generateHledgerJournal, parseHledgerEntry } from "./generator/hledger";
export { loadSessionsFromHF, loadSessionsFromLocal } from "./hf/loader";
export type {
  AccountingBenchmarkResult,
  Session,
  Transaction,
  Posting,
  Account,
  FinancialStatements,
  ScoreWeights
} from "./types";

// Default export for pi extension loader
export default createExtension;
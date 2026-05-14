import type { Session, EvaluateOptions } from "../types";

/**
 * Load sessions from HuggingFace dataset
 */
export async function loadSessionsFromHF(
  repoId: string,
  options?: Partial<EvaluateOptions>
): Promise<Session[]> {
  // Placeholder - implement with HF client
  // This would use @huggingface/hub to load sessions from HF
  console.log(`Loading sessions from HF: ${repoId}`);
  
  // For now, return empty array - implement with actual HF client
  return [];
}

/**
 * Load sessions from local directory
 */
export async function loadSessionsFromLocal(
  directory: string,
  options?: Partial<EvaluateOptions>
): Promise<Session[]> {
  const { readdirSync, readFileSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  
  if (!existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`);
  }
  
  const files = readdirSync(directory).filter(f => f.endsWith(".jsonl"));
  const sessions: Session[] = [];
  
  for (const file of files) {
    try {
      const session = await loadSessionFromPath(join(directory, file));
      sessions.push(session);
    } catch (error) {
      console.error(`Failed to load ${file}:`, error);
    }
  }
  
  return sessions;
}

/**
 * Load a single session from file path
 */
export async function loadSessionFromPath(sessionPath: string): Promise<Session> {
  const { readFileSync, existsSync } = await import("node:fs");
  const { basename } = await import("node:path");
  
  if (!existsSync(sessionPath)) {
    throw new Error(`Session file not found: ${sessionPath}`);
  }
  
  const content = readFileSync(sessionPath, "utf-8");
  const lines = content.split("\n").filter(l => l.trim());
  
  if (lines.length === 0) {
    throw new Error(`Empty session file: ${sessionPath}`);
  }
  
  // Parse pi session format (JSONL)
  const messages: Session["messages"] = [];
  const transactions: Session["transactions"] = [];
  let duration = 0;
  let model = "";
  let provider = "";
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      // Pi session entry format
      if (entry.role === "user" || entry.role === "assistant" || entry.role === "system") {
        messages.push({
          role: entry.role,
          content: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content),
          timestamp: entry.timestamp,
        });
      } else if (entry.type === "custom") {
        // Check for accounting transactions in custom entries
        if (entry.customType === "transaction" || entry.customType === "accounting") {
          transactions.push(entry.data || entry);
        }
      } else if (entry.duration || entry.elapsed) {
        duration = entry.duration || entry.elapsed;
      } else if (entry.model) {
        model = entry.model;
      } else if (entry.provider) {
        provider = entry.provider;
      }
    } catch {
      // Skip unparseable lines
    }
  }
  
  return {
    id: basename(sessionPath, ".jsonl"),
    timestamp: new Date().toISOString(),
    duration,
    model,
    provider,
    messages,
    transactions,
  };
}

/**
 * Load session from HuggingFace dataset URL
 */
export async function loadSessionFromHFUrl(
  repoId: string,
  filename: string,
  options?: { revision?: string }
): Promise<Session> {
  // Placeholder for HF client implementation
  // Would use @huggingface/hub to download file
  
  throw new Error("HF loading not implemented - use local files for now");
}

/**
 * Parse session content from text (for extracted text from pi sessions)
 */
export function parseSessionFromText(text: string): Session {
  const lines = text.split("\n");
  const messages: Session["messages"] = [];
  const transactions: Session["transactions"] = [];
  
  let currentRole: "user" | "assistant" | "system" | "tool" = "user";
  let currentContent = "";
  let inTransaction = false;
  let currentTransaction: any = null;
  
  for (const line of lines) {
    // Check for role markers
    if (line.startsWith("User:") || line.startsWith(">")) {
      if (currentContent) {
        messages.push({ role: currentRole, content: currentContent });
        currentContent = "";
      }
      currentRole = "user";
      currentContent = line.replace(/^(User:|>)\s*/, "");
    } else if (line.startsWith("Assistant:") || line.startsWith("")) {
      if (currentContent && currentRole === "user") {
        messages.push({ role: currentRole, content: currentContent });
        currentContent = "";
      }
      currentRole = "assistant";
      currentContent += (currentContent ? "\n" : "") + line.replace(/^Assistant:\s*/, "");
    } else if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
      // This is an hledger transaction line
      if (!inTransaction) {
        inTransaction = true;
        currentTransaction = { date: line.split(" ")[0], postings: [] };
      }
    }
  }
  
  if (currentContent) {
    messages.push({ role: currentRole, content: currentContent });
  }
  
  return {
    id: `parsed-${Date.now()}`,
    timestamp: new Date().toISOString(),
    duration: 0,
    model: "unknown",
    provider: "unknown",
    messages,
    transactions,
  };
}

/**
 * List available sessions in directory
 */
export async function listSessions(directory: string): Promise<string[]> {
  const { readdirSync, existsSync } = await import("node:fs");
  
  if (!existsSync(directory)) {
    return [];
  }
  
  return readdirSync(directory)
    .filter(f => f.endsWith(".jsonl"))
    .sort();
}
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { evaluateSession } from "./evaluator/session";
import { loadSessionsFromHF, loadSessionsFromLocal } from "./hf/loader";
import type { EvaluateOptions, ScoreWeights } from "./types";
import { DEFAULT_WEIGHTS } from "./types";

export function createExtension(_settingsManager: any): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    // Register evaluation tools
    pi.registerTool({
      name: "evaluate_session",
      label: "Evaluate Session",
      description: "Evaluate a pi session for accounting benchmark - validates double-entry bookkeeping, financial statements, and generates hledger journal",
      parameters: Type.Object({
        sessionPath: Type.String({ description: "Path to session JSONL file" }),
        weights: Type.Optional(Type.String({ description: "JSON string of custom ScoreWeights" })),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          const weights: ScoreWeights = params.weights 
            ? JSON.parse(params.weights) 
            : DEFAULT_WEIGHTS;
          
          const result = await evaluateSession(params.sessionPath, { weights });
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2),
            }],
            details: result,
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            }],
            isError: true,
          };
        }
      },
    });

    pi.registerTool({
      name: "generate_hledger",
      label: "Generate Hledger",
      description: "Generate hledger journal entries from accounting session",
      parameters: Type.Object({
        sessionPath: Type.String({ description: "Path to session JSONL file" }),
        outputPath: Type.Optional(Type.String({ description: "Output path for hledger journal" })),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          const result = await evaluateSession(params.sessionPath, {
            weights: DEFAULT_WEIGHTS,
          });
          
          if (params.outputPath) {
            // Write to file
            const { writeFileSync } = await import("node:fs");
            writeFileSync(params.outputPath, result.generatedJournal);
            return {
              content: [{
                type: "text",
                text: `Generated hledger journal saved to ${params.outputPath}`,
              }],
              details: { outputPath: params.outputPath, lineCount: result.transactions.length },
            };
          }
          
          return {
            content: [{
              type: "text",
              text: result.generatedJournal,
            }],
            details: { transactions: result.transactions },
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Hledger generation failed: ${error instanceof Error ? error.message : String(error)}`,
            }],
            isError: true,
          };
        }
      },
    });

    // Register benchmark commands
    pi.registerCommand("accounting-bench", {
      description: "Run accounting benchmark evaluation",
      getArgumentCompletions: (prefix: string) => {
        const commands = [
          { value: "evaluate", label: "evaluate" },
          { value: "list", label: "list" },
          { value: "generate", label: "generate" },
          { value: "report", label: "report" },
        ];
        return commands.filter(c => c.value.startsWith(prefix));
      },
      handler: async (args, ctx) => {
        const [command, ...rest] = (args || "").split(" ");
        
        if (command === "evaluate") {
          await ctx.ui.notify("Running accounting benchmark...", "info");
          await ctx.waitForIdle();
          ctx.ui.notify("Use /eval-session tool for session evaluation", "info");
        } else if (command === "list") {
          ctx.ui.notify("Use /eval-list command - coming soon", "info");
        } else if (command === "report") {
          ctx.ui.notify("Generating benchmark report - coming soon", "info");
        } else {
          ctx.ui.notify("Commands: evaluate, list, report", "info");
        }
      },
    });

    pi.registerCommand("hledger-generate", {
      description: "Generate hledger journal from session",
      handler: async (args, ctx) => {
        if (!args) {
          ctx.ui.notify("Usage: /hledger-generate <session.jsonl>", "info");
          return;
        }
        ctx.ui.notify(`Generating hledger from ${args}...`, "info");
      },
    });

    pi.registerCommand("accounting-stats", {
      description: "Show accounting benchmark statistics",
      handler: async (_args, ctx) => {
        const stats = `
**Accounting Benchmark Stats**

📊 Sessions Evaluated: 0
📈 Average Score: N/A
⏱️  Total Reasoning Time: N/A

**Score Breakdown:**
- Account Opening: N/A
- Double-Entry: N/A
- Balance Sheet: N/A
- P&L: N/A
- Cash Flow: N/A

**Usage:**
/accounting-bench evaluate <session.jsonl>
/hledger-generate <session.jsonl>
        `.trim();
        
        ctx.ui.notify(stats, "info");
      },
    });

    // Notify on load
    pi.on("session_start", async (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify("Accounting Benchmark extension loaded", "info");
      }
    });
  };
}

type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
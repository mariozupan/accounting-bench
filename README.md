# Accounting Benchmark

A benchmark for evaluating LLMs on accounting tasks - double-entry bookkeeping, hledger journals, and financial statement validation.

Inspired by [SWE-bench](https://github.com/princeton-nlp/SWE-bench) for software engineering evaluation.

## Features

- **Session Evaluation**: Evaluate pi coding agent sessions on accounting tasks
- **Double-Entry Validation**: Validate debits = credits for all transactions
- **Financial Statement Validation**: Check balance sheet, P&L, and cash flow
- **hledger Generation**: Generate hledger-format journal entries from sessions
- **Benchmark Metrics**: Comprehensive scoring for accounting accuracy

## Installation

```bash
# Clone the repository
git clone https://github.com/mariozupan/accounting-bench.git
cd accounting-bench

# Install dependencies
npm install

# Build
npm run build
```

## Usage

### As a pi Extension

```bash
pi install git:github.com/yourusername/accounting-bench
pi
```

Then use the commands:
- `/accounting-bench evaluate <session.jsonl>` - Run benchmark evaluation
- `/hledger-generate <session.jsonl>` - Generate hledger journal
- `/accounting-stats` - Show benchmark statistics

### Command Line

```bash
# Evaluate a session
node dist/cli.js evaluate --source local:.pi/hf-sessions/

# Evaluate from HuggingFace dataset
node dist/cli.js evaluate --source hf://username/accounting-sessions

# Generate hledger journal
node dist/cli.js generate --session session.jsonl --output journal.journal
```

## Evaluation Metrics

| Metric | Weight | Description |
|--------|--------|-------------|
| Account Opening Validity | 15% | Are accounts opened correctly? |
| Double-Entry Validity | 25% | Do debits equal credits? |
| Balance Sheet Validity | 20% | Assets = Liabilities + Equity? |
| P&L Validity | 20% | Revenue - Expenses = Net Income? |
| Cash Flow Validity | 10% | Cash flow reconciles? |
| Reasoning Time | 5% | How fast did the session complete? |
| Account Mapping | 5% | Correct account selection? |

## Data Source

Uses sessions collected with [pi-share-hf](https://github.com/badlogic/pi-share-hf):

1. Collect sessions: `pi-share-hf collect --provider openai --model gpt-5`
2. Evaluate with accounting-bench: `accounting-bench evaluate --source local:.pi/hf-sessions/`
3. Upload to HuggingFace dataset

## Output Format

```json
{
  "sessionId": "2024-01-15T11-03-04_b8b30402",
  "taskType": "transaction",
  "difficulty": "easy",
  "scores": {
    "accountOpeningValidity": 100,
    "doubleEntryValidity": 100,
    "balanceSheetValidity": 100,
    "pnlValidity": 100,
    "cashFlowValidity": 100,
    "reasoningTimeScore": 80,
    "accountMappingAccuracy": 100,
    "overall": 97.5
  },
  "generatedJournal": "; Auto-generated hledger journal\n2024-01-15 * \"Grocery Store\"\n    expenses:food:groceries    $45.00\n    assets:bank:checking            $45.00",
  "errors": [],
  "warnings": [],
  "suggestions": []
}
```

## Architecture

```
┌──────────────────┐     ┌─────────────────────────┐
│   pi-share-hf    │────▶│   HuggingFace Dataset   │
│  (collect/upload)│     │   (jsonl sessions)      │
└──────────────────┘     └───────────┬─────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   Accounting Benchmark          │
                    │   Evaluator Extension           │
                    │                                 │
                    │  src/                           │
                    │  ├── evaluator/session.ts      │
                    │  ├── validator/double-entry.ts │
                    │  ├── validator/statements.ts   │
                    │  ├── generator/hledger.ts     │
                    │  └── hf/loader.ts              │
                    └─────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint and format
npm run check

# Build
npm run build
```

## Contributing

Contributions welcome! Please:
1. Add tests for new features
2. Follow the existing code style
3. Update documentation for any API changes

## License

MIT

## Related Projects

- [pi coding agent](https://github.com/badlogic/pi-mono) - The coding agent framework
- [pi-share-hf](https://github.com/badlogic/pi-share-hf) - Session collection and upload
- [hledger](https://hledger.org/) - Plain-text accounting tools
- [SWE-bench](https://github.com/princeton-nlp/SWE-bench) - Software engineering benchmark

## Citation

If you use accounting-bench in your research, please cite:

```bibtex
@software{accounting-bench,
  title = {Accounting Benchmark},
  author = {Your Name},
  year = {2024},
  url = {https://github.com/yourusername/accounting-bench}
}
```

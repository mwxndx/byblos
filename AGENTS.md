# BYBLOS — ENGINEERING AGENT VERIFICATION & TESTING POLICY

This repository enforces strict **Continuous Verification**. Every coding agent operating within Byblos (including Gemini, Antigravity, Everything Claude Code [ECC], Claude Code, Cursor, and automated bots) must comply with this policy before declaring any engineering task complete.

---

## 1. Non-Negotiable Rules for Coding Agents

Before declaring any engineering task complete, every agent MUST:

1. **Identify Affected Components**: Map all modified or dependent domains (frontend, API routes, database, background workers, payments, logistics).
2. **Identify Required Tests**: Determine which existing tests cover the affected area and write new tests if coverage is missing.
3. **Execute Relevant Automated Checks**: Run the targeted tests locally or in the isolated test environment.
4. **Execute Regression Checks**: When modifying shared components, authentication, payments, database schemas, financial calculations, or order lifecycles, run the full regression suite (`npm run test:app`, `npm run test:journeys`).
5. **Record Exact Commands**: Log the precise command lines executed and their working directory.
6. **Report Actual Exit Codes**: State the real exit code (0, 1, etc.) for each executed command.
7. **Report Test Counts**: Provide passed, failed, skipped, and blocked counts.
8. **Identify Test Files**: Explicitly link to or reference all test files covering the changes.
9. **Preserve Failure Evidence**: Include relevant logs, stack traces, or artifact references for any unresolved issues.
10. **State Omissions Honestly**: Explicitly state which tests were not run and why (e.g., lack of external hardware, mock vs live gateway).
11. **Distinguish Facts from Assumptions**: Clearly separate verified behavior from assumptions or unverified edge cases.
12. **Review Final Diff**: Inspect `git status` and `git diff` to confirm zero unintended changes or regressions.

---

## 2. Strictly Prohibited Agent Behaviors

- **NEVER** claim a command passed without actually executing it.
- **NEVER** equate "build passed" with "tests passed".
- **NEVER** equate "unit tests passed" with "end-to-end business journey verified".
- **NEVER** represent a mocked test as verification against a live external provider (e.g. real Safaricom M-Pesa or live Paystack).
- **NEVER** suppress errors or hide test failures by weakening assertions, commenting out tests, or masking exit codes (`|| true`).
- **NEVER** leave dangling resources, leaked database connections, or uncleaned test artifacts.

---

## 3. Mandatory Completion Report Format

Every task completed by an engineering agent must conclude with a structured **Test Evidence** section using this format:

```markdown
### Test Evidence & Verification Report

**Engineering task:**
[Concise summary of what was implemented or resolved and why]

**Tests added or updated:**
[Exact file paths of new or updated tests and the behaviors they verify]

**Commands executed:**
[Exact command lines, working directory, and execution environment]

**Results:**
[Pass/fail/blocked/not-run status, exit codes, and test counts]

**Regression coverage:**
[Existing suites and business journeys checked to ensure zero regressions]

**Failure evidence:**
[Relevant logs, reports, traces, or artifact references, if any]

**Known gaps & remaining risks:**
[Unverified behavior, environmental limitations, or staging prerequisites]

**Final diff:**
[List of modified files and explicit confirmation that unrelated user work was preserved]
```

---

## 4. Verification Commands Quick Reference

Agents should use the following standard commands for validation:

| Purpose | Command |
| :--- | :--- |
| **All Business Journeys (Gates 1-4)** | `npm run test:journeys` |
| **Core Commerce Journey (Gate 1)** | `npm run test:journeys:gate1` |
| **Order Lifecycle Journey (Gate 2)** | `npm run test:journeys:gate2` |
| **Financial Workflows Journey (Gate 3)** | `npm run test:journeys:gate3` |
| **Admin & Authorization Journey (Gate 4)** | `npm run test:journeys:gate4` |
| **Application System Contract Audit** | `npm run test:app` |
| **Frontend Typecheck** | `npm run typecheck` |
| **Frontend Lint** | `npm run lint` |
| **Backend Lint** | `npm --prefix server run lint` |
| **Backend Integration Tests** | `npm --prefix server run test:integration` |
| **Staging Smoke Verification** | `npm run test:staging:smoke` |
| **Test Environment Health Check** | `npm run test:env:check` |

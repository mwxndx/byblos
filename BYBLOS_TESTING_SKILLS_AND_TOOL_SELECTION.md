# BYBLOS — TESTING SKILLS AND TOOL SELECTION MATRIX
**Phase 0 Deliverable: Skill Discovery, Evaluation, and Selection**
**Date:** 2026-11-14  
**Project:** Byblos E-Commerce Ecosystem  
**Target Environment:** Isolated Test Environment (Docker + PostgreSQL + Node.js/Vite)

---

## 1. Executive Summary

In accordance with Phase 0 of the Byblos Live Application Testing, Functional Validation, Security, and Load Readiness mandate, this document details the discovery, inspection, and selection of specialized testing skills from both the **Everything Claude Code (ECC)** plugin and the **Matt Pocock** plugin, supplemented by dedicated execution tools and test frameworks.

Every chosen skill was evaluated against its actual instruction set (`SKILL.md`) to ensure alignment with our rigorous testing requirements across architecture discovery, business workflow tracing, browser UI testing, security assessment, database verification, and performance/concurrency measurement.

---

## 2. Discovered Skills Inventory

An inventory check of installed plugins identified the following active capability repositories:
- **ECC Plugin Directory:** `C:\Users\Administrator\.gemini\config\plugins\ecc\skills` (180+ specialized engineering skills)
- **Matt Pocock Plugin Directory:** `C:\Users\Administrator\.gemini\config\plugins\mattpocock-skills\skills` (40+ domain, testing, and debugging skills)

### Skills Evaluated for Core Testing Activities:

| Domain / Activity | Evaluated Candidates |
| :--- | :--- |
| **Application Exploration** | `codebase-onboarding` (ECC), `code-tour` (ECC), `domain-modeling` (Matt Pocock), `repo-scan` (ECC) |
| **Architecture & Code Understanding** | `codebase-onboarding` (ECC), `domain-modeling` (Matt Pocock), `backend-patterns` (ECC), `database-migrations` (ECC) |
| **Test Planning & Governance** | `verification-loop` (ECC), `tdd-workflow` (ECC), `delivery-gate` (ECC), `ai-regression-testing` (ECC) |
| **Browser & UI Interaction** | `browser-qa` (ECC), `ui-demo` (ECC), `frontend-patterns` (ECC) |
| **End-to-End Journey Testing** | `e2e-testing` (ECC), `browser-qa` (ECC) |
| **API Testing & Contracts** | `contract-first` (ECC), `api-design` (ECC), `terminal-ops` (ECC) |
| **Database Verification** | `postgres-patterns` (ECC), `database-migrations` (ECC), `data-throughput-accelerator` (ECC) |
| **Security Testing** | `security-review` (ECC), `security-scan` (ECC), `security-bounty-hunter` (ECC), `defi-amm-security` (ECC) |
| **Performance & Load Testing** | `benchmark` (ECC), `benchmark-methodology` (ECC), `benchmark-optimization-loop` (ECC) |
| **Test Failure Diagnosis** | `diagnosing-bugs` (Matt Pocock), `agent-introspection-debugging` (ECC) |

---

## 3. Skills Selection Matrix

The table below maps each testing phase and activity to its authoritative selected skill and establishes why the skill was chosen over alternatives:

| Testing Activity | Selected Skill | Plugin Source | Selection Justification |
| :--- | :--- | :--- | :--- |
| **1. Application Exploration** | `codebase-onboarding` | ECC | Provides a structured 2-phase reconnaissance and architecture mapping procedure for scanning entry points, manifests, routes, and controllers without making unwarranted assumptions. |
| **2. Architecture & Domain Logic** | `domain-modeling` | Matt Pocock | Focuses on active domain entity modeling, boundary clarification, ubiquitous language, and cross-referencing code rules against business invariants. |
| **3. Test Planning & Quality Gates** | `verification-loop` & `tdd-workflow` | ECC | Enforces a multi-stage verification cycle (typecheck, lint, unit, integration, E2E, security) and guarantees strict red/green evidence logging before declaring passing states. |
| **4. Browser UI & Visual Testing** | `browser-qa` | ECC | Outlines automated visual verification, responsive breakpoint testing (mobile, tablet, desktop), navigation link verification, and form interaction checks. |
| **5. End-to-End Commerce Journeys** | `e2e-testing` | ECC | Implements structured Page Object Model (POM) patterns, user flow sequencing, network response interception, and state verification. |
| **6. API & Contract Verification** | `contract-first` | ECC | Specializes in machine-checkable API contract validation, request/response schema alignment, field drift prevention, and status code consistency. |
| **7. Database State Verification** | `postgres-patterns` | ECC | Provides patterns for relational integrity, index usage, transaction boundaries, row-level locking, and connection pool behavior under PostgreSQL. |
| **8. Security & Vulnerability Assessment** | `security-review` | ECC | Supplies an actionable security checklist covering authentication, IDOR/BOLA, parameter manipulation, input sanitization, webhook signature validation, and financial tampering. |
| **9. Performance & Concurrency** | `benchmark` & `benchmark-methodology` | ECC | Defines precise benchmarking methodology: measuring TTFB, p50/p95/p99 latencies, sustained RPS vs bursts, and error rate tracking under multi-virtual-user load. |
| **10. Bug Diagnosis & Root Cause Analysis** | `diagnosing-bugs` | Matt Pocock | Provides a 5-phase deterministic debugging protocol (tight feedback loop, minimal reproduction, hypothesis ranking, instrumentation, fix verification). |

---

## 4. Supporting Tools and Test Frameworks

While plugin skills provide the methodology and operational discipline, concrete execution requires underlying automated engines and harnesses:

1. **Test Runners & Assertion Engines:**
   - **Vitest (`v3.2.x`):** Native runner for unit, integration, and contract tests across frontend and backend modules.
   - **Supertest:** In-process HTTP testing for Express backend controllers and middleware.
   - **Playwright / Puppeteer:** Headless Chromium/WebKit browser driver for responsive UI interaction and screenshot capture.

2. **Database & Infrastructure Automation:**
   - **Docker & Docker Compose:** Container orchestration for isolated PostgreSQL and Redis instances.
   - **`pg` (node-postgres) & Knex/Migration runner:** Direct connection pooling for database state assertions, transaction verification, and ledger reconciliation.

3. **Performance & Concurrency Load Harness:**
   - **Autocannon / Custom Node Concurrency Harness (`worker_threads` / HTTP agent pooling):** Generates high concurrency (10 to 1,000 virtual users) and sustained request throughput (10 to 100+ RPS) against the isolated backend.

---

## 5. Unavailable or Environmentally Constrained Capabilities

1. **Live Cellular Hardware (Real Safaricom M-Pesa SIMs / USSD Handsets):**
   - *Limitation:* Physical SIM card USSD prompts cannot be executed in headless environments without live hardware.
   - *Mitigation:* Safaricom Daraja sandbox and Paystack test mode API endpoints with valid signature simulation will be exercised.
2. **Real Customer Payouts & External Bank Accounts:**
   - *Limitation:* Live transfers to real human bank accounts or mobile wallets are strictly prohibited and legally restricted.
   - *Mitigation:* Sandbox payout and simulated ledger state transitions will be verified against PostgreSQL transaction tables.
3. **External Real-World Courier Vehicles:**
   - *Limitation:* Mzigo delivery drivers cannot physically traverse city streets during synthetic testing.
   - *Mitigation:* Synthetic GPS coordinates, webhooks, and driver confirmation endpoints will verify the end-to-end delivery workflow state machine.

---
**Status:** Phase 0 complete. Proceeding immediately to Phase 1: Complete Application Discovery.


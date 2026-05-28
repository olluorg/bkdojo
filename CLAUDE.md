# Project: Backend Interview Trainer

## Goal

Build a web MVP for adaptive preparation for Java/Kotlin backend interviews.

The app is inspired by Duolingo, but it is not childish. It should feel like a serious daily trainer for backend developers.

## Core domains

- Java Core
- Spring Boot
- Databases
- Message Brokers

(System Design Basics is post-MVP, not implemented yet.)

## MVP constraints

- No persistent backend / database; the only server code is a stateless, optional serverless eval proxy (`api/evaluate.ts` → OpenRouter). It holds the API key and is opt-in via `VITE_EVAL_ENDPOINT`.
- No authentication
- No payments
- Chrome-first: full functionality is only required in Google Chrome Desktop
- Open-answer questions are evaluated by AI: on-device via the Chrome Built-in AI / Prompt API first, then the serverless OpenRouter proxy if configured, then manual self-assessment. Keyword matching is NOT the product evaluation mechanism — it survives only as a test/emergency fallback.
- All evaluators sit behind the `AnswerEvaluator` abstraction; the UI binds only to `EvaluationResult` / `AnswerOutcome`.
- Content is stored as JSON
- User progress is stored locally
- React + TypeScript + Vite, Bun as package manager / test runner

## Product principles

- The app adapts to the user's level.
- Basic questions are allowed if the user needs them.
- Strong users should not be forced through basics.
- Every question should help the user answer better in an interview.
- The main value is not just knowledge, but interview-ready explanation.

## Code principles

- Keep modules small.
- Prefer plain TypeScript.
- Avoid overengineering.
- Avoid global mutable state.
- Add tests for scoring and selection algorithms.
- Keep UI components separate from domain logic.
- Keep answer evaluation behind an abstraction: UI and the ability/review layers depend only on `EvaluationResult` / `AnswerOutcome`, never on a specific evaluator or the Prompt API directly.

## Do not do

- Do not add backend unless explicitly requested.
- Do not add auth.
- Do not add payment.
- Do not rewrite the whole project without asking.
- Do not introduce large dependencies without justification.

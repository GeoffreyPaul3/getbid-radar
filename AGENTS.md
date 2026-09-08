# GetBidRadar Development Guidelines

> [!IMPORTANT]
>
> - Avoid rewriting published git history — do not force push, rebase, amend, or squash commits that are already pushed.
> - Keep the repository in a working state with passing tests, typechecks, and builds.
> - Centralized AI Gateway: Google Gemini 2.5 Flash (Primary) → Groq (Fallback 1) → OpenRouter (Fallback 2).
> - Deterministic scoring engine is the sole authority for BID / REVIEW / NO-BID decisions.

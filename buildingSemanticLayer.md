# Building a Semantic Layer for LLMs: A Field Guide to the Five Types

*By Vishal Mysore*

---

If you've spent any time wiring a Large Language Model up to a real database, you already know the failure mode. The model joins the wrong tables, invents column names, and confidently reports a "revenue" number that has nothing to do with how your finance team actually defines revenue. The schema is technically correct, and the answer is technically wrong.

The fix is not a bigger model or a cleverer prompt. The fix is a **semantic layer**.

A semantic layer gives the LLM standardized business metrics, logic, and context. It acts as a translation system that sits between raw tables and the model, guiding the AI to interact with data exactly the way the business defines it. Instead of letting the model guess what "active customer" or "net margin" means, you encode those definitions once and force every query through them. Hallucinations and schema-based errors drop because the model is no longer reasoning from scratch — it's reasoning from your business's shared vocabulary.

But "semantic layer" is not one thing. There are several distinct types, and they differ mainly by **where they live in the data stack**. Choosing the right one depends on your warehouse, your tooling, and how much you care about portability versus simplicity. Here are the five.

---

## 1. Universal (Cross-Platform) Semantic Layers

These are standalone, vendor-agnostic middleware platforms. They sit between your data warehouse and *all* of your downstream consumers — AI agents, BI dashboards, notebooks, internal apps. The layer processes natural language, maps the concepts it finds to your data models, and pushes the resulting query down to the database for execution.

The defining trait is **centralization without lock-in**. Your KPI definitions live in one place and are served identically to every tool that asks, regardless of which database sits underneath.

**Best for:** Multi-tool environments where you want consistent, centralized business logic across many consumers and refuse to be tied to a single vendor's ecosystem.

---

## 2. Built-in (BI-Native) Semantic Layers

These semantic models are tightly integrated inside a single Business Intelligence platform. The metrics, dimensions, and relationships are defined within the BI tool itself, and they shine when you query data through that same vendor's conversational AI assistant.

The trade-off is convenience for portability: the logic is excellent inside its home ecosystem and largely invisible outside it.

**Best for:** Teams that operate primarily within a single BI or data-visualization ecosystem and want their LLM assistant to inherit definitions that already power their dashboards.

---

## 3. Transformation Layer-Embedded Semantic Layers

These define metrics, dimensions, and semantics **as code** — typically YAML — sitting right alongside the raw SQL transformations that build your tables. Business definitions become a first-class part of the data pipeline rather than a separate artifact bolted on afterward.

Because everything is code, everything is version-controlled. Definitions are reviewed in pull requests, diffed over time, and flow seamlessly from the transformation step into query engines and LLMs.

**Best for:** Data teams that want git-native, version-controlled modeling, where a change to a metric definition is a tracked, reviewable event just like any other code change.

---

## 4. Database-Native Semantic Layers

Instead of standing up a separate tool, these semantic layers are built directly into the cloud database or data platform itself. The platform translates and executes user intent natively, leaning on its own query optimizer and built-in AI/LLM integrations.

The big win is architectural simplicity. There is no external service to operate and no data movement between systems — the semantics, the optimizer, and the model integration all live in one place.

**Best for:** Streamlined architectures that want to eliminate external services and keep the entire path — from intent to execution — inside a single platform.

---

## 5. Knowledge Graph & Active Semantic Layers

Unlike the tabular layers above, these use graph databases to capture complex relationships and entity definitions. Rather than just mapping a phrase to a column, they provide a reasoning engine — a knowledge graph — that excels at multi-hop and deeply contextual questions where the answer depends on chains of relationships.

Their other strength is reach: they are well suited to connecting unstructured sources (documents, tickets, chat logs) with structured enterprise definitions, so an agent can reason across both worlds at once.

**Best for:** Advanced AI agents that need to answer multi-hop questions and bridge unstructured content with structured business definitions.

---

## How to Choose

The five types are not ranked — each is the right answer for a different stack:

| Type | Lives in | Pick it when |
|------|----------|--------------|
| Universal (Cross-Platform) | Standalone middleware | You serve many tools and want no lock-in |
| Built-in (BI-Native) | A single BI platform | You live inside one BI ecosystem |
| Transformation-Embedded | Your data pipeline (as code) | You want git-native, reviewable definitions |
| Database-Native | The warehouse itself | You want to eliminate external services |
| Knowledge Graph & Active | A graph + reasoning engine | You need multi-hop and unstructured context |

The decision usually comes down to two questions: **what data warehouse or platform are you running on, and which BI or visualization tools (if any) does your team already live in?** A team standardized on one BI suite will get the fastest payoff from a BI-native layer; a team spread across many tools is better served by a universal one; a code-first data team will feel most at home embedding definitions in the transformation layer; and a team chasing minimal moving parts will favor whatever ships natively in their warehouse.

Whichever you choose, the underlying principle is the same: stop asking the model to guess what your business means, and start handing it the definitions. That single shift is what turns a brittle demo into a system you can actually trust in production.

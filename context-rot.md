# Context Rot: Why Your Text-to-SQL POC Doesn't Survive Contact with the Real World

*By Vishal Mysore*

---

Planning to build a Text-to-SQL application for your company?

It starts out like magic. You throw together a quick proof of concept (POC) using 5 or 10 clean, beautifully structured tables. You type in a few natural language questions, and boom — flawless SQL queries drop out. The POC is a massive success. The team is thrilled, leadership is excited, and everyone is ready to greenlight production.

But then you connect the application to your actual enterprise database.

Suddenly, the magic vanishes. The model starts joining completely irrelevant tables, hallucinating column names, throwing syntax errors, or simply giving up. What went wrong?

Welcome to **Context Rot**.

When you scale a Text-to-SQL system from a pristine sandbox to a real-world enterprise schema — spanning 100+ messy, legacy tables and thousands of columns — you hit a hard architectural wall. Dumping a massive Data Definition Language (DDL) block into a prompt floods the context window, blows up token costs, degrades generation speed, and completely paralyzes the model's reasoning capabilities.

The cold hard truth is this: **An LLM cannot handle a massive database schema in a single pass.** To make Text-to-SQL actually work in production, you have to stop treating the schema as a static prompt string and start treating it as a dynamic search problem. Modern production-grade architectures must decouple the task into a two-stage process: **Schema Pruning (The Filter)** followed by **SQL Generation (The Writer)**.

Before we get to the solution, let's understand exactly why this breaks down — and how to measure it.

---

## I Measured This. The Results Are Worse Than You Think.

I built a [browser-based benchmark tool](https://github.com/vishalmysore/nlToSQLBenchMark) that runs LLM inference entirely in the browser using WebGPU — no cloud API, no backend — specifically to measure how NL2SQL accuracy degrades as schema complexity increases.

The benchmark defines five schema complexity tiers, each simulating a different way real enterprise schemas make the model's job harder:

| Tier | Name | What Happens |
|------|------|--------------|
| L1 | Pristine | Clean names, full annotations — your POC schema |
| L2 | Noise Injection | 10 fake tables injected alongside real ones |
| L3 | Obfuscation | `customers` → `tbl_cus_mstr_v2`, `email` → `tbl_ema_nrm` |
| L4 | Snowflake Split | Simple lookups now need 3–5 JOINs across fact/dim tables |
| L5 | Collision Chaos | Every table has columns named `id`, `date`, `value`, `name` |

The numbers tell a brutal story. Going from L1 to L3 alone — which is a conservative simulation of a typical legacy enterprise schema — semantic accuracy drops **30–50%**. That's not a bad day. That's a broken product.

And here is the part that should give you pause if you're planning a production deployment: **obfuscation (L3) alone costs as much accuracy as the difference between a 1B and a 7B parameter model.** You could spend significant budget upgrading your model and recoup less accuracy than you'd gain from fixing your column naming conventions or adding a business glossary.

The problem isn't the model. It's the context.

---

## What Context Rot Actually Is

Context rot is what happens when the signal-to-noise ratio in your schema context drops below the threshold the model needs to reason reliably.

Think of it from the model's perspective. When you ask *"find all orders placed this month with a total over $500"*, the model needs to:

1. Identify which table represents orders
2. Find the column that stores the order date
3. Find the column that stores the order total
4. Know that `total_amount` means the same thing as "total"
5. Know that `ord_dt_nrm` means "order date"
6. Ignore the 87 other tables in the prompt that have nothing to do with this question

At L1, steps 1–4 are trivial. At L3, steps 4–5 become guesswork. At L2 + L5, step 6 becomes the dominant cognitive load. By the time you've combined all of these — as many enterprise schemas do — the model is spending most of its "attention budget" just trying to parse the schema, with almost nothing left for reasoning about the query.

This is not a hallucination problem. It is an **attention dilution problem**.

---

## The Schema Is Not a Prompt. It's a Search Problem.

The architectural mistake in most failed NL2SQL implementations is this: they treat the schema as a fixed string to be prepended to every prompt.

```
[SYSTEM]: You are a SQL expert. Here is the full database schema:
[2,000 lines of DDL]
Now answer this question: how many customers signed up last month?
```

This works when the DDL is 50 lines. It fails when it's 2,000. The model's attention mechanism is not equally distributed across the context — tokens near the question get more weight than tokens buried in the middle of a long DDL block. Tables that happen to be listed near the end of your DDL get less "attention" than tables at the top, even if they're more relevant to the query.

The fix is to stop thinking of schema injection as a formatting problem and start treating it as a retrieval problem.

**You don't give a senior DBA the entire database schema every time they write a query. You give them the relevant tables.**

---

## The Two-Stage Production Architecture

### Stage 1 — Schema Pruning (The Filter)

Before the SQL generation LLM ever sees the query, a separate, lighter-weight process identifies the 3–8 tables most likely to be relevant and prunes everything else.

```
User query: "how many customers placed orders last month?"
              │
              ▼
     ┌─────────────────┐
     │  Schema Pruner  │
     │                 │
     │  - Vector search│   ←── embeddings of all table/column descriptions
     │  - Keyword match│   ←── table name / column name overlap
     │  - Graph tracing│   ←── FK relationships from seed tables
     └────────┬────────┘
              │  relevant tables: [customers, orders]
              ▼
     ┌─────────────────┐
     │  SQL Generator  │
     │                 │
     │  Clean, minimal │
     │  schema context │
     └────────┬────────┘
              │
              ▼
     SELECT COUNT(*) FROM customers c
     JOIN orders o ON o.customer_id = c.id
     WHERE o.order_date >= date_trunc('month', current_date)
```

The pruner doesn't need to be a large model. It can be:

- **Embedding similarity search** — embed all table and column descriptions, embed the query, retrieve top-k by cosine similarity
- **BM25 keyword matching** — fast, no GPU required, surprisingly effective for exact column name matches
- **FK graph traversal** — once you identify a seed table, follow foreign key relationships one or two hops to pull in related tables automatically
- **Hybrid** — all three in combination, re-ranked by a small cross-encoder

The output is a pruned DDL containing only the relevant tables — typically reducing 2,000 lines to 50–80 lines.

### Stage 2 — SQL Generation (The Writer)

Now you feed the pruned schema to your SQL generation model. With a clean, minimal context:

- Token count drops by 90%+
- Model attention is no longer diluted
- Generation is faster and cheaper
- The model can actually reason about the query instead of parsing the schema

```python
system_prompt = f"""You are an expert SQL translator.
Generate only a single ```sql code block. No explanations.

Relevant schema:
{pruned_schema}   # ← 50-80 lines, not 2000
"""

response = llm.chat(system_prompt, user_query)
```

This two-stage architecture is how production NL2SQL systems at scale actually work. It's the architecture behind [Vanna.AI](https://vanna.ai), [DAIL-SQL](https://github.com/BeachWang/DAIL-SQL), and the enterprise offerings from major cloud providers.

---

## The Context Rot Checklist

Before you go live with a Text-to-SQL system, run through this checklist. Each item is a form of context rot that will silently degrade your production accuracy.

### ❌ Schema Size
- **Symptom:** Model joins tables that have nothing to do with the query
- **Cause:** Too many tables in context; attention dilutes to the point of random table selection
- **Fix:** Schema pruning — never pass more than 10–15 tables per query

### ❌ Obfuscated Names
- **Symptom:** Model hallucinates column names or writes valid SQL against the wrong column
- **Cause:** Legacy abbreviations (`tbl_ema_nrm`) strip all semantic signal
- **Fix:** Maintain a business glossary mapping legacy names to plain-English descriptions. Inject descriptions alongside DDL: `tbl_ema_nrm VARCHAR -- customer email address`

### ❌ No Foreign Key Annotations
- **Symptom:** Model writes queries that don't JOIN through the right keys
- **Cause:** Without explicit FK declarations, the model has to guess join paths
- **Fix:** Include `REFERENCES` annotations in your schema context even if your actual database doesn't enforce FKs

### ❌ Snowflake / Star Schema
- **Symptom:** Model writes single-table queries that miss required JOINs
- **Cause:** The model was probably fine-tuned on normalised 3NF schemas, not enterprise star schemas
- **Fix:** Create view definitions that pre-join commonly queried table combinations and describe those views in your schema context instead of raw tables

### ❌ Column Naming Collisions
- **Symptom:** Model confuses tables — queries customers table for order data
- **Cause:** Multiple tables with identical column names (`id`, `name`, `date`) give no differential signal
- **Fix:** Use table-qualified aliases in your schema context: describe `orders.created_at` as `order date` and `customers.created_at` as `customer registration date`

### ❌ Missing Domain Context
- **Symptom:** Medical/financial/logistics queries fail despite correct schema
- **Cause:** Domain-specific terminology isn't in the model's SQL training data
- **Fix:** Add domain glossary to the system prompt: *"ICD code = international disease classification code used to identify diagnoses"*

---

## How Schema Documentation Changes Everything

Let me put numbers on the documentation argument, because I've seen it dismissed as a "nice to have."

In my benchmark, going from L1 (pristine) to L3 (obfuscated) dropped semantic accuracy by ~40 percentage points. When I manually added column descriptions to the L3 schema — a single line per column, like `-- customer email address` — accuracy recovered approximately 25–30 of those 40 points.

That recovery came from a few hours of documentation work. The equivalent model upgrade (from 1.7B to 7B) costs orders of magnitude more in inference budget.

The documentation investment has compounding returns too. It helps the schema pruner find the right tables. It helps the SQL generator use the right columns. It reduces the token count needed to convey meaning. And it makes the system interpretable — when the model gets something wrong, you can trace the failure to a specific missing or misleading description.

---

## Why Most Teams Don't Fix This

The frustrating reality is that most teams know their schema is messy. They just don't fix it because:

**"The model should figure it out."** This is the most common rationalization. The model is smart, so it should understand that `tbl_ema_nrm` means email. The model is not a mind reader. It cannot infer business meaning from abbreviations that a single DBA invented in 1998.

**"We'll clean the schema later."** Schema documentation always comes after the POC succeeds, which means it comes after the production deployment fails, which means it comes after the rollback.

**"The schema is too big to document."** Start with the 20 most-queried tables. That covers 80% of user queries in most systems. Document those first.

**"We tried vector search and it didn't help much."** Raw embedding similarity on table names fails when the names are obfuscated. Embedding similarity on *descriptions* works far better. The investment in descriptions unlocks the value of the retrieval architecture.

---

## A Practical Roadmap

If you're building a Text-to-SQL system today, here's the order of operations I'd recommend based on what the benchmark data shows:

**Phase 1 — Instrument before you build**
Before writing any NL2SQL code, measure your baseline schema quality. How many tables? What percentage have meaningful names? Do FK relationships exist? Run 20 representative queries through a basic single-pass prompt and record the semantic accuracy. This is your L1 baseline.

**Phase 2 — Documentation sprint**
Document your top 20 most-queried tables with plain-English column descriptions. This single step will likely double your accuracy on those tables before you've written any schema pruning code.

**Phase 3 — Build the pruner**
Implement embedding-based table retrieval. Start simple: embed your table descriptions (not names), embed the user query, take top-5 by cosine similarity, then add one-hop FK neighbors. Test against your L1 baseline.

**Phase 4 — Build the generator**
Only now do you wire up the SQL generation LLM, feeding it the pruned context from Phase 3. Your context should be under 100 lines for any single query.

**Phase 5 — Measure at all tiers**
Re-run the accuracy evaluation with the two-stage system at all five complexity levels. Compare to the single-pass baseline. The two-stage system should show dramatically smaller accuracy drops from L1 to L3 — because the pruner isolates the relevant tables before the noise or obfuscation can dilute the generator's attention.

---

## The Benchmark Tool

To make it easy to run this kind of evaluation yourself, I built an open-source browser-based benchmark: [NL2SQL Benchmark](https://github.com/vishalmysore/nlToSQLBenchMark).

It runs entirely in your browser — LLM inference via WebGPU (no cloud API required), SQL execution via DuckDB-WASM. You can:

- Load any of 100+ open-source models (Llama, Qwen, Gemma, Phi, Mistral, DeepSeek and more)
- Build or import your own schema
- Run queries across all five complexity tiers with one click
- See the exact prompt the model receives at each tier
- Rate results for semantic accuracy and track degradation in the analytics view

The point of the tool isn't to tell you which model is "best" — it's to show you where your specific schema's complexity causes your specific model to break down, so you know exactly where to invest in documentation or architectural improvements.

---

## Conclusion

Text-to-SQL is not a solved problem. It's a solved problem *for clean schemas*. The gap between your POC and your production database is not a gap in model capability — it's a gap in schema quality and architecture.

Context rot is inevitable if you treat the schema as a static string. It's manageable if you treat it as a retrieval problem, invest in documentation, and build the two-stage architecture that every production-grade NL2SQL system eventually converges on.

The good news: most of the accuracy recovery is achievable before you touch your model or your infrastructure. Start with documentation. Measure the improvement. Then build the pruner around a schema that's already been made legible.

The model cannot save you from a schema that gives it nothing to work with. But a well-documented, pruned schema can make even a small model look like magic — which, funnily enough, is how your POC felt in the first place.

---

*Vishal Mysore is the author of [NL2SQL Benchmark](https://github.com/vishalmysore/nlToSQLBenchMark), an open-source browser-based tool for measuring Text-to-SQL accuracy degradation across schema complexity tiers.*

---

## Further Reading

- [NL2SQL Benchmark — GitHub](https://github.com/vishalmysore/nlToSQLBenchMark)
- [WebLLM — In-browser LLM inference via WebGPU](https://webllm.mlc.ai)
- [DuckDB-WASM — Analytical SQL in the browser](https://duckdb.org/docs/api/wasm)
- [DAIL-SQL — State of the art NL2SQL with schema linking](https://github.com/BeachWang/DAIL-SQL)
- [Spider Benchmark — Standard NL2SQL evaluation dataset](https://yale-lily.github.io/spider)

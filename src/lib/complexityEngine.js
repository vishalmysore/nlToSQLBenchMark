// Complexity Engine — transforms schema + prompt based on tier level

const NOISE_TABLE_NAMES = [
  "tbl_audit_log_v3", "sys_cfg_metadata", "tmp_etl_staging_zzz",
  "legacy_crm_export", "bkp_orders_2019", "ref_geo_mapping_intl",
  "cache_session_tkn", "idx_search_vector_nrm", "arch_events_cold",
  "stg_pipeline_delta", "dim_product_cat_hier", "fact_sales_raw_dump",
];

const NOISE_COLUMN_TYPES = ["INTEGER", "VARCHAR", "BOOLEAN", "TIMESTAMP", "FLOAT", "BIGINT"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Deterministic obfuscation — same name always → same result */
export function obfuscateName(name, seed = 42) {
  const rng = seededRandom(name.split("").reduce((a, c) => a + c.charCodeAt(0), seed));
  const prefix = ["tbl_", "sys_", "obj_", "stg_", "dim_"][Math.floor(rng() * 5)];
  // abbrev: take first 3 chars of each word segment
  const parts = name.split(/[_\s]+/).map((p) => p.slice(0, 3).toLowerCase());
  const suffix = ["_v2", "_mstr", "_nrm", "_raw", "_cur"][Math.floor(rng() * 5)];
  return prefix + parts.join("_") + suffix;
}

function generateNoiseSchema(index) {
  const tableName = NOISE_TABLE_NAMES[index % NOISE_TABLE_NAMES.length] + `_${index}`;
  const colCount = 3 + (index % 4);
  const cols = Array.from({ length: colCount }, (_, i) => ({
    name: `col_${String.fromCharCode(97 + i)}_${index}`,
    type: randomItem(NOISE_COLUMN_TYPES),
  }));
  return { name: tableName, columns: cols };
}

export function generateNoiseSchemasSQL(count = 10) {
  return Array.from({ length: count }, (_, i) => {
    const s = generateNoiseSchema(i);
    return (
      `Table "${s.name}" (\n` +
      s.columns.map((c) => `  ${c.name} ${c.type}`).join(",\n") +
      `\n);`
    );
  }).join("\n\n");
}

/** Build deduplication-aware aliases for level 5 */
function buildAmbiguousSchema(tables) {
  // Rename columns to generic conflicting names
  const genericNames = ["id", "date", "value", "name", "type", "status", "code", "amount"];
  return tables.map((t) => ({
    ...t,
    name: t.name.split("_")[0], // shorten table name to create collisions
    columns: t.columns.map((c, i) => ({
      ...c,
      name: genericNames[i % genericNames.length],
    })),
  }));
}

/** Split a flat schema into a snowflake-style star schema for level 4 */
function snowflakeSchema(tables) {
  const result = [];
  for (const t of tables) {
    // Keep original table as fact
    const factCols = t.columns.slice(0, Math.max(2, Math.ceil(t.columns.length / 2)));
    const dimCols  = t.columns.slice(Math.max(2, Math.ceil(t.columns.length / 2)));
    result.push({ ...t, columns: factCols });
    if (dimCols.length > 0) {
      result.push({
        name: `dim_${t.name}`,
        columns: [
          { name: `${t.name}_id`, type: "INTEGER", isForeignKey: true, refTable: t.name, refColumn: "id" },
          ...dimCols,
        ],
      });
      // Add a sub-dimension
      if (dimCols.length > 1) {
        result.push({
          name: `subdim_${t.name}`,
          columns: [
            { name: `dim_${t.name}_id`, type: "INTEGER", isForeignKey: true, refTable: `dim_${t.name}`, refColumn: `${t.name}_id` },
            { name: "detail_key", type: "VARCHAR" },
            { name: "detail_value", type: "VARCHAR" },
          ],
        });
      }
    }
  }
  return result;
}

/**
 * Generate the system prompt based on schema and complexity level.
 * Returns { systemPrompt, displayClean, displayObfuscated }
 */
export function generateSystemPrompt(schemaData, complexityLevel) {
  const tables = schemaData?.tables ?? [];

  let workingTables = JSON.parse(JSON.stringify(tables)); // deep clone
  let schemaDescription = "";
  let cleanDescription = "";

  // Always build clean version for the split-screen diff view
  cleanDescription = workingTables
    .map((t) => {
      return (
        `Table "${t.name}" (\n` +
        t.columns
          .map(
            (c) =>
              `  ${c.name} ${c.type}${c.isForeignKey ? ` REFERENCES ${c.refTable}(${c.refColumn})` : ""}`
          )
          .join(",\n") +
        `\n);`
      );
    })
    .join("\n\n");

  if (complexityLevel === 1) {
    schemaDescription = cleanDescription;
  } else if (complexityLevel === 2) {
    schemaDescription = cleanDescription + "\n\n-- [NOISE TABLES]\n\n" + generateNoiseSchemasSQL(10);
  } else if (complexityLevel === 3) {
    workingTables = workingTables.map((t) => ({
      ...t,
      name: obfuscateName(t.name),
      columns: t.columns.map((c) => ({ ...c, name: obfuscateName(c.name) })),
    }));
    schemaDescription = workingTables
      .map(
        (t) =>
          `Table "${t.name}" (\n` +
          t.columns.map((c) => `  ${c.name} ${c.type}`).join(",\n") +
          `\n);`
      )
      .join("\n\n");
  } else if (complexityLevel === 4) {
    workingTables = snowflakeSchema(workingTables);
    schemaDescription = workingTables
      .map(
        (t) =>
          `Table "${t.name}" (\n` +
          t.columns
            .map(
              (c) =>
                `  ${c.name} ${c.type}${c.isForeignKey ? ` REFERENCES ${c.refTable}(${c.refColumn})` : ""}`
            )
            .join(",\n") +
          `\n);`
      )
      .join("\n\n");
  } else if (complexityLevel === 5) {
    workingTables = buildAmbiguousSchema(workingTables);
    schemaDescription = workingTables
      .map(
        (t) =>
          `Table "${t.name}" (\n` +
          t.columns.map((c) => `  ${c.name} ${c.type}`).join(",\n") +
          `\n);`
      )
      .join("\n\n");
  }

  const systemPrompt = `You are an expert SQL translator. Output ONLY a single SQL code block using exactly this format:

\`\`\`sql
SELECT ...
\`\`\`

Rules:
- Start the code block with \`\`\`sql (not \`\`\`markdown or anything else)
- No explanations, no comments, no extra text before or after the code block
- Use only tables and columns from the schema below
- Generate valid DuckDB SQL

Database schema:
${schemaDescription}`;

  return {
    systemPrompt,
    cleanDescription,
    obfuscatedDescription: schemaDescription,
  };
}

export const COMPLEXITY_META = [
  {
    level: 1,
    label: "Pristine",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    description: "Clean schema, descriptive names, explicit FK links",
  },
  {
    level: 2,
    label: "Noise Injection",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
    description: "10 irrelevant decoy schemas injected into context",
  },
  {
    level: 3,
    label: "Obfuscation",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    dot: "bg-orange-500",
    description: "Table/column names cryptically renamed, no semantic hints",
  },
  {
    level: 4,
    label: "Snowflake Split",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    description: "Flat data split into star schema requiring 3–5 nested JOINs",
  },
  {
    level: 5,
    label: "Collision Chaos",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    dot: "bg-purple-500",
    description: "Duplicate column names (id, date, value) across tables — aliasing hell",
  },
];

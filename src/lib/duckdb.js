import * as duckdb from "@duckdb/duckdb-wasm";

let db = null;
let conn = null;

export async function initDuckDB() {
  if (db) return { db, conn };

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })
  );

  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);

  conn = await db.connect();
  return { db, conn };
}

export async function executeSQL(sql) {
  if (!conn) await initDuckDB();
  try {
    const result = await conn.query(sql);
    const schema = result.schema?.fields?.map((f) => f.name) ?? [];
    const rows = result.toArray().map((row) => {
      const obj = {};
      for (const key of schema) {
        const val = row[key];
        obj[key] = val === null ? null : typeof val === "bigint" ? Number(val) : val;
      }
      return obj;
    });
    return { success: true, rows, schema, rowCount: rows.length };
  } catch (err) {
    return { success: false, error: err.message, rows: [], schema: [] };
  }
}

/** Create real in-memory tables from schema definition with sample data */
export async function createTablesFromSchema(schemaData) {
  if (!conn) await initDuckDB();
  const tables = schemaData?.tables ?? [];

  // Drop existing tables (reverse order to avoid FK constraint issues)
  for (const t of [...tables].reverse()) {
    try { await conn.query(`DROP TABLE IF EXISTS "${t.name}";`); } catch (_) {}
  }

  // Create tables and bulk-insert 20 realistic sample rows each
  for (const t of tables) {
    const colDefs = t.columns.map((c) => `"${c.name}" ${c.type}`).join(", ");
    await conn.query(`CREATE TABLE IF NOT EXISTS "${t.name}" (${colDefs});`);

    const rows = generateSampleRows(t, 20);
    // Build a single multi-row INSERT for speed
    const valsList = rows.map((row) =>
      "(" + t.columns.map((c) => formatValue(row[c.name], c.type)).join(", ") + ")"
    );
    try {
      await conn.query(
        `INSERT INTO "${t.name}" VALUES ${valsList.join(",\n")};`
      );
    } catch (_) {
      // Fall back to row-by-row if bulk fails
      for (const row of rows) {
        const vals = t.columns.map((c) => formatValue(row[c.name], c.type)).join(", ");
        try { await conn.query(`INSERT INTO "${t.name}" VALUES (${vals});`); } catch (_) {}
      }
    }
  }
}

function formatValue(val, type) {
  if (val === null) return "NULL";
  const T = type.toUpperCase();
  if (T.includes("INT") || T.includes("FLOAT") || T.includes("DECIMAL") || T.includes("NUMERIC") || T.includes("BIGINT")) {
    return String(val);
  }
  if (T.includes("BOOL")) return val ? "TRUE" : "FALSE";
  return `'${String(val).replace(/'/g, "''")}'`;
}

// ── Seeded pseudo-random so rows are deterministic but varied ─────────────────
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);                 // 0..1
}

function pick(arr, seed) { return arr[Math.floor(seededRand(seed) * arr.length)]; }

function generateSampleRows(table, count) {
  const rows = [];
  const name = table.name.toLowerCase();

  for (let i = 1; i <= count; i++) {
    const row = {};
    for (const col of table.columns) {
      row[col.name] = sampleValue(col, i, name, count);
    }
    rows.push(row);
  }
  return rows;
}

function sampleValue(col, i, tableName, total) {
  const T  = col.type.toUpperCase();
  const n  = col.name.toLowerCase();
  const r  = seededRand(i * 97 + n.charCodeAt(0) * 13);   // 0..1, stable per col+row
  const r2 = seededRand(i * 53 + n.length * 7);

  // ── Primary key: sequential ─────────────────────────────────────────────
  if (n === "id") return i;

  // ── Foreign key: reference a valid id in the target table ───────────────
  if (col.isForeignKey) {
    return Math.floor(r * Math.min(total, 20)) + 1;
  }

  // ── By column name patterns ─────────────────────────────────────────────
  if (n.includes("email"))        return `user${i}@example.com`;
  if (n === "name" || n.includes("full_name"))
    return pick(["Alice Johnson","Bob Smith","Carol White","David Lee","Eva Brown",
                 "Frank Miller","Grace Davis","Hank Wilson","Iris Moore","Jack Taylor",
                 "Karen Anderson","Leo Thomas","Mia Jackson","Noah Harris","Olivia Martin",
                 "Paul Thompson","Quinn Garcia","Rachel Martinez","Sam Robinson","Tina Clark"], i - 1);
  if (n.includes("first_name"))   return pick(["Alice","Bob","Carol","David","Eva","Frank","Grace","Hank","Iris","Jack","Karen","Leo","Mia","Noah","Olivia","Paul","Quinn","Rachel","Sam","Tina"], i - 1);
  if (n.includes("last_name"))    return pick(["Johnson","Smith","White","Lee","Brown","Miller","Davis","Wilson","Moore","Taylor","Anderson","Thomas","Jackson","Harris","Martin","Thompson","Garcia","Martinez","Robinson","Clark"], i - 1);
  if (n.includes("phone"))        return `+1-555-${String(1000 + i).padStart(4,"0")}`;
  if (n.includes("address") || n.includes("street"))
    return `${100 + i} Main St`;
  if (n.includes("city"))         return pick(["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","San Jose"], i - 1);
  if (n.includes("country"))      return pick(["USA","Canada","UK","Germany","France","Australia","Japan","India","Brazil","Mexico"], i - 1);
  if (n.includes("zip") || n.includes("postal")) return String(10000 + i * 37);
  if (n.includes("gender"))       return pick(["Male","Female","Non-binary","Prefer not to say"], i % 4);
  if (n.includes("blood_type"))   return pick(["A+","A-","B+","B-","O+","O-","AB+","AB-"], i % 8);
  if (n.includes("specialty"))    return pick(["Cardiology","Neurology","Orthopedics","Pediatrics","Oncology","Radiology","Dermatology","Psychiatry","General Surgery","Emergency Medicine"], i - 1);
  if (n.includes("department"))   return pick(["Engineering","Marketing","Sales","HR","Finance","Operations","Legal","Product","Design","Support"], i - 1);
  if (n.includes("position") || n.includes("job_title") || n.includes("title"))
    return pick(["Manager","Engineer","Analyst","Director","Coordinator","Specialist","Consultant","Developer","Designer","Executive"], i - 1);
  if (n.includes("category"))     return pick(["Electronics","Clothing","Food","Books","Sports","Home","Garden","Toys","Automotive","Health"], i - 1);
  if (n.includes("status")) {
    if (tableName.includes("order"))  return pick(["pending","processing","shipped","delivered","cancelled"], i % 5);
    if (tableName.includes("patient") || tableName.includes("admission")) return pick(["admitted","discharged","critical","stable","outpatient"], i % 5);
    return pick(["active","inactive","pending","suspended"], i % 4);
  }
  if (n.includes("type")) {
    if (tableName.includes("insurance") || n.includes("policy")) return pick(["Health","Auto","Life","Home","Business"], i % 5);
    return pick(["TypeA","TypeB","TypeC","TypeD"], i % 4);
  }
  if (n.includes("description") || n.includes("notes") || n.includes("comment"))
    return `Sample ${col.name} for record ${i}.`;
  if (n.includes("tag") || n.includes("label"))   return pick(["urgent","review","approved","draft","archived"], i % 5);
  if (n.includes("color"))        return pick(["Red","Blue","Green","Black","White","Gray","Yellow","Purple"], i % 8);
  if (n.includes("brand"))        return pick(["BrandA","BrandB","BrandC","BrandD","BrandE"], i % 5);
  if (n.includes("sku") || n.includes("code"))    return `SKU-${String(1000 + i).padStart(5,"0")}`;
  if (n.includes("url") || n.includes("link"))    return `https://example.com/item/${i}`;
  if (n.includes("drug") || n.includes("medication")) return pick(["Aspirin","Ibuprofen","Amoxicillin","Metformin","Lisinopril","Atorvastatin","Omeprazole","Amlodipine","Metoprolol","Levothyroxine"], i - 1);
  if (n.includes("diagnosis") || n.includes("icd")) return pick(["J06.9","I10","E11","M54.5","J18.9","K21.0","F41.1","E78.5","N39.0","G43.9"], i - 1);
  if (n.includes("frequency"))    return pick(["Once daily","Twice daily","Every 8 hours","As needed","Weekly","Monthly"], i % 6);
  if (n.includes("dosage") || n.includes("dose")) return `${(i * 25) % 500 + 50}mg`;
  if (n.includes("symptom"))      return pick(["Fever","Headache","Cough","Fatigue","Nausea","Chest pain","Dizziness","Shortness of breath","Back pain","Joint pain"], i - 1);
  if (n.includes("vessel") || n.includes("ship") || n.includes("carrier"))
    return pick(["MSC Cargo","Evergreen","Maersk","CMA CGM","COSCO","ONE","Yang Ming","HMM","ZIM","PIL"], i % 10);
  if (n.includes("port") || n.includes("origin") || n.includes("destination"))
    return pick(["Shanghai","Rotterdam","Los Angeles","Singapore","Busan","Dubai","Hamburg","Antwerp","Qingdao","Hong Kong"], i - 1);
  if (n.includes("tracking"))     return `TRK${String(100000 + i * 7).padStart(8,"0")}`;
  if (n.includes("weight"))       return +(r * 990 + 10).toFixed(1);
  if (n.includes("salary") || n.includes("wage")) return Math.round(40000 + r * 120000);
  if (n.includes("score") || n.includes("rating") || n.includes("stars"))
    return +(r * 4 + 1).toFixed(1);
  if (n.includes("age"))          return Math.floor(r * 60) + 18;
  if (n.includes("qty") || n.includes("quantity") || n.includes("stock") || n.includes("count"))
    return Math.floor(r * 200) + 1;
  if (n.includes("duration") || n.includes("days")) return Math.floor(r * 30) + 1;

  // ── By data type ────────────────────────────────────────────────────────
  if (T.includes("BOOL"))       return i % 2 === 0;

  if (T.includes("TIMESTAMP")) {
    const month = String(Math.floor(r * 12) + 1).padStart(2,"0");
    const day   = String(Math.floor(r2 * 28) + 1).padStart(2,"0");
    const hour  = String(Math.floor(r * 23)).padStart(2,"0");
    const min   = String(Math.floor(r2 * 59)).padStart(2,"0");
    return `2024-${month}-${day} ${hour}:${min}:00`;
  }

  if (T.includes("DATE")) {
    const month = String(Math.floor(r * 12) + 1).padStart(2,"0");
    const day   = String(Math.floor(r2 * 28) + 1).padStart(2,"0");
    return `2024-${month}-${day}`;
  }

  if (T.includes("INT") || T.includes("BIGINT") || T.includes("SERIAL")) {
    // Catch-all integers: scale by name hint
    if (n.includes("year"))  return 2018 + (i % 7);
    if (n.includes("month")) return (i % 12) + 1;
    return Math.floor(r * 1000) + 1;
  }

  if (T.includes("FLOAT") || T.includes("DECIMAL") || T.includes("NUMERIC")) {
    // Catch-all decimals: wide range so filters like "> 50" always return rows
    if (n.includes("price") || n.includes("amount") || n.includes("total") || n.includes("cost") || n.includes("revenue"))
      return +(r * 4900 + 100).toFixed(2);          // 100–5000
    if (n.includes("tax") || n.includes("fee") || n.includes("discount"))
      return +(r * 200).toFixed(2);                  // 0–200
    if (n.includes("lat"))  return +(r * 180 - 90).toFixed(6);
    if (n.includes("lng") || n.includes("lon")) return +(r * 360 - 180).toFixed(6);
    return +(r * 9900 + 100).toFixed(2);             // 100–10000
  }

  // ── Generic VARCHAR fallback ─────────────────────────────────────────────
  return `${col.name}_${i}`;
}

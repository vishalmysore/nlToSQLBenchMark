import Dexie from "dexie";

export const db = new Dexie("nl2sql_benchmark");

// version 1 — original
db.version(1).stores({
  schemas:   "++id, name, createdAt",
  queryLogs: "++id, schemaId, complexityLevel, modelId, timestamp",
});

// version 2 — adds humanFeedback index
db.version(2).stores({
  schemas:   "++id, name, createdAt",
  queryLogs: "++id, complexityLevel, modelId, timestamp, humanFeedback",
});

export async function saveSchema(schema) {
  return db.schemas.add({ ...schema, createdAt: Date.now() });
}
export async function loadSchemas() {
  return db.schemas.toArray();
}
export async function deleteSchema(id) {
  return db.schemas.delete(id);
}

export async function logQuery(entry) {
  // humanFeedback: null | "correct" | "incorrect"
  return db.queryLogs.add({ humanFeedback: null, ...entry, timestamp: Date.now() });
}

/** Update just the humanFeedback field on an existing log row */
export async function setFeedback(id, feedback) {
  return db.queryLogs.update(id, { humanFeedback: feedback });
}

export async function getQueryLogs(limit = 500) {
  return db.queryLogs.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function clearLogs() {
  return db.queryLogs.clear();
}

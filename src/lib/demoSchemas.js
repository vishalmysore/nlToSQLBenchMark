// ─── Pre-built domain schemas ─────────────────────────────────────────────────

function uid(prefix, n) { return `${prefix}_${n}`; }

export const DEMO_SCHEMAS = {
  // ── E-Commerce (original demo) ────────────────────────────────────────────
  ecommerce: {
    label: "🛒 E-Commerce",
    description: "Customers, orders, products and line items",
    tables: [
      {
        id: "customers", name: "customers",
        columns: [
          { id: uid("c",1), name: "id",          type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("c",2), name: "name",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("c",3), name: "email",        type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("c",4), name: "phone",        type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("c",5), name: "created_at",   type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "products", name: "products",
        columns: [
          { id: uid("p",1), name: "id",           type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("p",2), name: "name",          type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("p",3), name: "category",      type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("p",4), name: "price",         type: "DECIMAL", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("p",5), name: "stock_qty",     type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "orders", name: "orders",
        columns: [
          { id: uid("o",1), name: "id",            type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("o",2), name: "customer_id",   type: "INTEGER",   isForeignKey: true,  refTable: "customers", refColumn: "id" },
          { id: uid("o",3), name: "total_amount",  type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("o",4), name: "status",        type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("o",5), name: "order_date",    type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "order_items", name: "order_items",
        columns: [
          { id: uid("oi",1), name: "id",           type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("oi",2), name: "order_id",     type: "INTEGER", isForeignKey: true,  refTable: "orders",   refColumn: "id" },
          { id: uid("oi",3), name: "product_id",   type: "INTEGER", isForeignKey: true,  refTable: "products", refColumn: "id" },
          { id: uid("oi",4), name: "quantity",     type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("oi",5), name: "unit_price",   type: "DECIMAL", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },

  // ── Healthcare ────────────────────────────────────────────────────────────
  healthcare: {
    label: "🏥 Healthcare",
    description: "Patients, doctors, appointments, prescriptions & diagnoses",
    tables: [
      {
        id: "patients", name: "patients",
        columns: [
          { id: uid("pt",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pt",2), name: "full_name",       type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pt",3), name: "date_of_birth",   type: "DATE",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pt",4), name: "gender",          type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pt",5), name: "blood_type",      type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pt",6), name: "admission_date",  type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "doctors", name: "doctors",
        columns: [
          { id: uid("dr",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dr",2), name: "full_name",       type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dr",3), name: "specialty",       type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dr",4), name: "department",      type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dr",5), name: "years_experience",type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "appointments", name: "appointments",
        columns: [
          { id: uid("ap",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ap",2), name: "patient_id",     type: "INTEGER",   isForeignKey: true,  refTable: "patients", refColumn: "id" },
          { id: uid("ap",3), name: "doctor_id",      type: "INTEGER",   isForeignKey: true,  refTable: "doctors",  refColumn: "id" },
          { id: uid("ap",4), name: "scheduled_at",   type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ap",5), name: "status",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ap",6), name: "notes",          type: "TEXT",      isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "diagnoses", name: "diagnoses",
        columns: [
          { id: uid("dg",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dg",2), name: "appointment_id", type: "INTEGER",   isForeignKey: true,  refTable: "appointments", refColumn: "id" },
          { id: uid("dg",3), name: "icd_code",       type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dg",4), name: "description",    type: "TEXT",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dg",5), name: "diagnosed_at",   type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "prescriptions", name: "prescriptions",
        columns: [
          { id: uid("rx",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("rx",2), name: "diagnosis_id",   type: "INTEGER",   isForeignKey: true,  refTable: "diagnoses", refColumn: "id" },
          { id: uid("rx",3), name: "drug_name",      type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("rx",4), name: "dosage_mg",      type: "FLOAT",     isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("rx",5), name: "frequency",      type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("rx",6), name: "duration_days",  type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },

  // ── Insurance ─────────────────────────────────────────────────────────────
  insurance: {
    label: "📋 Insurance",
    description: "Policyholders, policies, claims, agents & coverage tiers",
    tables: [
      {
        id: "policyholders", name: "policyholders",
        columns: [
          { id: uid("ph",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ph",2), name: "full_name",       type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ph",3), name: "email",           type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ph",4), name: "date_of_birth",   type: "DATE",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ph",5), name: "risk_score",      type: "FLOAT",     isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "agents", name: "agents",
        columns: [
          { id: uid("ag",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ag",2), name: "full_name",       type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ag",3), name: "region",          type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ag",4), name: "commission_rate", type: "FLOAT",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "policies", name: "policies",
        columns: [
          { id: uid("po",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",2), name: "policyholder_id",type: "INTEGER",   isForeignKey: true,  refTable: "policyholders", refColumn: "id" },
          { id: uid("po",3), name: "agent_id",       type: "INTEGER",   isForeignKey: true,  refTable: "agents",        refColumn: "id" },
          { id: uid("po",4), name: "policy_type",    type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",5), name: "premium_amount", type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",6), name: "coverage_limit", type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",7), name: "start_date",     type: "DATE",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",8), name: "end_date",       type: "DATE",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",9), name: "status",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "claims", name: "claims",
        columns: [
          { id: uid("cl",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("cl",2), name: "policy_id",      type: "INTEGER",   isForeignKey: true,  refTable: "policies", refColumn: "id" },
          { id: uid("cl",3), name: "claim_date",     type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("cl",4), name: "amount_claimed", type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("cl",5), name: "amount_approved",type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("cl",6), name: "status",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("cl",7), name: "incident_type",  type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "coverage_items", name: "coverage_items",
        columns: [
          { id: uid("ci",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ci",2), name: "policy_id",      type: "INTEGER", isForeignKey: true,  refTable: "policies", refColumn: "id" },
          { id: uid("ci",3), name: "coverage_type",  type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ci",4), name: "deductible",     type: "DECIMAL", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ci",5), name: "max_payout",     type: "DECIMAL", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },

  // ── Manufacturing ─────────────────────────────────────────────────────────
  manufacturing: {
    label: "🏭 Manufacturing",
    description: "Products, BOMs, suppliers, work orders, quality checks & inventory",
    tables: [
      {
        id: "products", name: "products",
        columns: [
          { id: uid("mp",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("mp",2), name: "sku",             type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("mp",3), name: "product_name",    type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("mp",4), name: "category",        type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("mp",5), name: "unit_cost",       type: "DECIMAL", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "components", name: "components",
        columns: [
          { id: uid("co",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("co",2), name: "component_name", type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("co",3), name: "unit_of_measure", type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("co",4), name: "lead_time_days",  type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "bill_of_materials", name: "bill_of_materials",
        columns: [
          { id: uid("bm",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("bm",2), name: "product_id",     type: "INTEGER", isForeignKey: true,  refTable: "products",   refColumn: "id" },
          { id: uid("bm",3), name: "component_id",   type: "INTEGER", isForeignKey: true,  refTable: "components", refColumn: "id" },
          { id: uid("bm",4), name: "qty_required",   type: "FLOAT",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "suppliers", name: "suppliers",
        columns: [
          { id: uid("su",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("su",2), name: "supplier_name",  type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("su",3), name: "country",        type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("su",4), name: "reliability_score", type: "FLOAT", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "purchase_orders", name: "purchase_orders",
        columns: [
          { id: uid("po",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",2), name: "supplier_id",    type: "INTEGER",   isForeignKey: true,  refTable: "suppliers",  refColumn: "id" },
          { id: uid("po",3), name: "component_id",   type: "INTEGER",   isForeignKey: true,  refTable: "components", refColumn: "id" },
          { id: uid("po",4), name: "quantity",       type: "FLOAT",     isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",5), name: "unit_price",     type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",6), name: "ordered_at",     type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("po",7), name: "received_at",    type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "work_orders", name: "work_orders",
        columns: [
          { id: uid("wo",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wo",2), name: "product_id",     type: "INTEGER",   isForeignKey: true,  refTable: "products", refColumn: "id" },
          { id: uid("wo",3), name: "qty_planned",    type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wo",4), name: "qty_produced",   type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wo",5), name: "started_at",     type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wo",6), name: "completed_at",   type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wo",7), name: "status",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "quality_checks", name: "quality_checks",
        columns: [
          { id: uid("qc",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("qc",2), name: "work_order_id",  type: "INTEGER",   isForeignKey: true,  refTable: "work_orders", refColumn: "id" },
          { id: uid("qc",3), name: "inspector_name", type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("qc",4), name: "defect_count",   type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("qc",5), name: "pass",           type: "BOOLEAN",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("qc",6), name: "checked_at",     type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },

  // ── Logistics ─────────────────────────────────────────────────────────────
  logistics: {
    label: "🚚 Logistics",
    description: "Shipments, carriers, warehouses, routes & delivery events",
    tables: [
      {
        id: "warehouses", name: "warehouses",
        columns: [
          { id: uid("wh",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wh",2), name: "name",           type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wh",3), name: "city",           type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wh",4), name: "country",        type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("wh",5), name: "capacity_sqm",   type: "FLOAT",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "carriers", name: "carriers",
        columns: [
          { id: uid("ca",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ca",2), name: "name",           type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ca",3), name: "mode",           type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ca",4), name: "on_time_rate",   type: "FLOAT",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "shipments", name: "shipments",
        columns: [
          { id: uid("sh",1), name: "id",               type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sh",2), name: "tracking_number",   type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sh",3), name: "origin_warehouse_id",    type: "INTEGER", isForeignKey: true, refTable: "warehouses", refColumn: "id" },
          { id: uid("sh",4), name: "destination_warehouse_id", type: "INTEGER", isForeignKey: true, refTable: "warehouses", refColumn: "id" },
          { id: uid("sh",5), name: "carrier_id",        type: "INTEGER",   isForeignKey: true,  refTable: "carriers", refColumn: "id" },
          { id: uid("sh",6), name: "weight_kg",         type: "FLOAT",     isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sh",7), name: "shipped_at",        type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sh",8), name: "estimated_arrival", type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sh",9), name: "status",            type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "delivery_events", name: "delivery_events",
        columns: [
          { id: uid("de",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("de",2), name: "shipment_id",    type: "INTEGER",   isForeignKey: true,  refTable: "shipments", refColumn: "id" },
          { id: uid("de",3), name: "event_type",     type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("de",4), name: "location",       type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("de",5), name: "occurred_at",    type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("de",6), name: "notes",          type: "TEXT",      isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },

  // ── HR / Payroll ──────────────────────────────────────────────────────────
  hr: {
    label: "👥 HR & Payroll",
    description: "Employees, departments, roles, timesheets & payroll runs",
    tables: [
      {
        id: "departments", name: "departments",
        columns: [
          { id: uid("dp",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dp",2), name: "name",           type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dp",3), name: "cost_center",    type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("dp",4), name: "headcount_limit",type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "roles", name: "roles",
        columns: [
          { id: uid("ro",1), name: "id",             type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ro",2), name: "title",          type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ro",3), name: "grade",          type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ro",4), name: "base_salary",    type: "DECIMAL", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "employees", name: "employees",
        columns: [
          { id: uid("em",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("em",2), name: "full_name",       type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("em",3), name: "email",           type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("em",4), name: "department_id",   type: "INTEGER",   isForeignKey: true,  refTable: "departments", refColumn: "id" },
          { id: uid("em",5), name: "role_id",         type: "INTEGER",   isForeignKey: true,  refTable: "roles",       refColumn: "id" },
          { id: uid("em",6), name: "manager_id",      type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("em",7), name: "hire_date",       type: "DATE",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("em",8), name: "employment_type", type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "timesheets", name: "timesheets",
        columns: [
          { id: uid("ts",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ts",2), name: "employee_id",    type: "INTEGER",   isForeignKey: true,  refTable: "employees", refColumn: "id" },
          { id: uid("ts",3), name: "week_start",     type: "DATE",      isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ts",4), name: "hours_regular",  type: "FLOAT",     isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ts",5), name: "hours_overtime",  type: "FLOAT",    isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ts",6), name: "approved",       type: "BOOLEAN",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "payroll_runs", name: "payroll_runs",
        columns: [
          { id: uid("pr",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pr",2), name: "employee_id",    type: "INTEGER",   isForeignKey: true,  refTable: "employees", refColumn: "id" },
          { id: uid("pr",3), name: "pay_period",     type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pr",4), name: "gross_pay",      type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pr",5), name: "tax_deducted",   type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pr",6), name: "net_pay",        type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("pr",7), name: "paid_at",        type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },

  // ── SaaS / Product Analytics ──────────────────────────────────────────────
  saas: {
    label: "📊 SaaS Analytics",
    description: "Users, subscriptions, feature events, sessions & billing",
    tables: [
      {
        id: "users", name: "users",
        columns: [
          { id: uid("us",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("us",2), name: "email",           type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("us",3), name: "plan",            type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("us",4), name: "country",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("us",5), name: "signed_up_at",    type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("us",6), name: "churned_at",      type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "subscriptions", name: "subscriptions",
        columns: [
          { id: uid("sb",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sb",2), name: "user_id",         type: "INTEGER",   isForeignKey: true,  refTable: "users", refColumn: "id" },
          { id: uid("sb",3), name: "plan_name",       type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sb",4), name: "monthly_price",   type: "DECIMAL",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sb",5), name: "started_at",      type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("sb",6), name: "cancelled_at",    type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "sessions", name: "sessions",
        columns: [
          { id: uid("ss",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ss",2), name: "user_id",         type: "INTEGER",   isForeignKey: true,  refTable: "users", refColumn: "id" },
          { id: uid("ss",3), name: "started_at",      type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ss",4), name: "duration_secs",   type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ss",5), name: "device_type",     type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("ss",6), name: "country",         type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "feature_events", name: "feature_events",
        columns: [
          { id: uid("fe",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("fe",2), name: "user_id",         type: "INTEGER",   isForeignKey: true,  refTable: "users",    refColumn: "id" },
          { id: uid("fe",3), name: "session_id",      type: "INTEGER",   isForeignKey: true,  refTable: "sessions", refColumn: "id" },
          { id: uid("fe",4), name: "feature_name",    type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("fe",5), name: "event_type",      type: "VARCHAR",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("fe",6), name: "occurred_at",     type: "TIMESTAMP", isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
      {
        id: "invoices", name: "invoices",
        columns: [
          { id: uid("iv",1), name: "id",             type: "INTEGER",   isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("iv",2), name: "subscription_id", type: "INTEGER",  isForeignKey: true,  refTable: "subscriptions", refColumn: "id" },
          { id: uid("iv",3), name: "amount",          type: "DECIMAL",  isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("iv",4), name: "status",          type: "VARCHAR",  isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("iv",5), name: "issued_at",       type: "TIMESTAMP",isForeignKey: false, refTable: "", refColumn: "" },
          { id: uid("iv",6), name: "paid_at",         type: "TIMESTAMP",isForeignKey: false, refTable: "", refColumn: "" },
        ],
      },
    ],
  },
};

export const DEMO_SCHEMA_KEYS = Object.keys(DEMO_SCHEMAS);

// Example queries per domain
export const DOMAIN_QUERIES = {
  ecommerce:     ["Get all customers", "Find orders with total over 50", "Count orders per customer", "Show top 5 products by price", "Get average order total by status"],
  healthcare:    ["List all patients", "Find appointments for doctor 1", "Show prescriptions with dosage over 100mg", "Count diagnoses by icd_code", "List patients admitted this year"],
  insurance:     ["Show all active policies", "Find claims with amount over 5000", "Count claims by status", "List policyholders with risk score above 0.7", "Get total premiums by policy type"],
  manufacturing: ["Show all work orders in progress", "Find components with lead time over 10 days", "List quality checks that failed", "Get total qty produced per product", "Find suppliers with reliability below 0.8"],
  logistics:     ["Show all in-transit shipments", "Find delayed deliveries", "Count shipments per carrier", "List warehouses by capacity", "Get average weight per carrier"],
  hr:            ["List all employees in engineering", "Find employees hired this year", "Show overtime hours by employee", "Get total net pay per department", "List unapproved timesheets"],
  saas:          ["Count active subscriptions by plan", "Find users who churned last month", "Show top features by usage", "Get average session duration by country", "List unpaid invoices"],
};

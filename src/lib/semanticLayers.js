// ─── Semantic Layer documents ──────────────────────────────────────────────
// Per-domain markdown documents describing business semantics that the raw
// schema does not encode: measure definitions, conventions, and
// disambiguation rules. Based on the "Semantic Layers for LLM-Powered Data
// Analytics" approach (arXiv:2604.25149) — supplementing the schema with a
// short contextual document measurably improves text-to-SQL accuracy.

export const SEMANTIC_LAYERS = {
  ecommerce: `## Semantic Layer

**Measures**
- "Revenue" / "sales" = SUM(orders.total_amount) for orders where status != 'cancelled'.
- "Order value" refers to orders.total_amount, not order_items.unit_price.
- "Active customers" = customers with at least one order in the last 90 days.

**Conventions**
- orders.status takes values: 'pending', 'shipped', 'delivered', 'cancelled'.
- order_items.unit_price is the price at time of purchase and may differ from products.price (current price).
- Dates: orders.order_date and customers.created_at are timestamps in UTC.

**Disambiguation**
- "Top products" by default means by total quantity sold (SUM(order_items.quantity)), not by price.
- "Customer" always refers to a row in customers, joined via orders.customer_id.`,

  healthcare: `## Semantic Layer

**Measures**
- "Active patients" = patients with an appointment in the last 12 months.
- "Prescription duration" = prescriptions.duration_days; "dosage" = prescriptions.dosage_mg.
- "Diagnosis count" should be grouped by diagnoses.icd_code unless otherwise specified.

**Conventions**
- appointments.status takes values: 'scheduled', 'completed', 'cancelled', 'no-show'.
- Only 'completed' appointments should be counted for diagnosis/prescription analysis.
- doctors.years_experience is a snapshot value, not historical.

**Disambiguation**
- "Patient admitted this year" refers to patients.admission_date, not appointments.scheduled_at.
- A "visit" refers to a row in appointments; a "case" refers to a diagnoses row linked via appointment_id.`,

  insurance: `## Semantic Layer

**Measures**
- "Premium revenue" = SUM(policies.premium_amount) for policies where status = 'active'.
- "Loss ratio" = SUM(claims.amount_approved) / SUM(policies.premium_amount).
- "Claim approval rate" = COUNT(claims WHERE amount_approved > 0) / COUNT(claims).

**Conventions**
- policies.status takes values: 'active', 'expired', 'cancelled'.
- claims.amount_claimed is the requested amount; claims.amount_approved is the paid-out amount (may be 0 or less than claimed).
- "Risk score" (policyholders.risk_score) ranges 0.0 (lowest risk) to 1.0 (highest risk).

**Disambiguation**
- "Active policies expiring this year" means status = 'active' AND end_date is within the current calendar year.
- "Agent performance" refers to commission_rate and the count/value of policies sold via policies.agent_id.`,

  manufacturing: `## Semantic Layer

**Measures**
- "Production output" = SUM(work_orders.qty_produced); "planned output" = SUM(work_orders.qty_planned).
- "Yield rate" = qty_produced / qty_planned for completed work orders.
- "Defect rate" = SUM(quality_checks.defect_count) / SUM(work_orders.qty_produced).

**Conventions**
- work_orders.status takes values: 'planned', 'in_progress', 'completed', 'cancelled'.
- "Stock below reorder point" compares an inventory quantity against components.lead_time_days as a proxy threshold (no explicit reorder_point column).
- quality_checks.pass = TRUE means the inspection passed (no defects above tolerance).

**Disambiguation**
- "Components" are raw materials/parts (table: components); "products" are finished goods (table: products), linked via bill_of_materials.
- "Supplier reliability" refers to suppliers.reliability_score (0.0–1.0, higher is better), not on_time delivery dates.`,

  logistics: `## Semantic Layer

**Measures**
- "On-time delivery rate" = carriers.on_time_rate (precomputed); do not recompute from timestamps unless asked explicitly.
- "Delayed shipments" = shipments where shipped_at + (estimated_arrival - shipped_at) has passed but status != 'delivered', i.e. status = 'in_transit' AND estimated_arrival < current timestamp.
- "Shipment volume" = COUNT(shipments) or SUM(shipments.weight_kg) depending on context (count for "how many shipments", weight for "total volume").

**Conventions**
- shipments.status takes values: 'pending', 'in_transit', 'delivered', 'delayed', 'cancelled'.
- delivery_events is an append-only log of tracking events per shipment; the latest event by occurred_at represents current status detail.
- "Origin"/"destination" refer to shipments.origin_warehouse_id / destination_warehouse_id, both FKs to warehouses.

**Disambiguation**
- "Carrier" always refers to carriers, joined via shipments.carrier_id.
- "Capacity" refers to warehouses.capacity_sqm (square meters of storage), not shipment weight.`,

  hr: `## Semantic Layer

**Measures**
- "Headcount" = COUNT(DISTINCT employees.id) where employment_type != 'terminated' (employees table holds current staff only).
- "Total compensation" = payroll_runs.gross_pay; "take-home pay" = payroll_runs.net_pay.
- "Overtime" refers to timesheets.hours_overtime, summed per employee or department.

**Conventions**
- employees.department_id and role_id are FKs to departments and roles respectively.
- timesheets.approved = FALSE means the timesheet is still pending manager approval — exclude these from payroll totals unless asked for "all" or "unapproved" timesheets.
- "Salary" without further qualification refers to roles.base_salary (the role's standard pay), not payroll_runs.gross_pay (an actual payment).

**Disambiguation**
- "Employees in engineering" filters by departments.name = 'Engineering' via employees.department_id.
- "Department average salary" = AVG(roles.base_salary) for employees in that department, joined employees → roles.`,

  saas: `## Semantic Layer

**Measures**
- "Active subscriptions" = subscriptions where cancelled_at IS NULL.
- "MRR" (monthly recurring revenue) = SUM(subscriptions.monthly_price) for active subscriptions.
- "Churned users" = users where churned_at IS NOT NULL; "churn this month" filters churned_at to the relevant month.

**Conventions**
- users.plan reflects the user's current plan label; subscriptions.plan_name is the plan tied to a specific subscription record (a user may have multiple historical subscriptions).
- feature_events.event_type distinguishes actions (e.g. 'click', 'view', 'export'); "usage" generally means COUNT(feature_events) grouped by feature_name.
- invoices.status takes values: 'paid', 'unpaid', 'overdue', 'refunded'.

**Disambiguation**
- "Session duration" refers to sessions.duration_secs (seconds), not feature_events timestamps.
- "Top features by usage" = feature_name ranked by COUNT(feature_events.id), not by COUNT(DISTINCT user_id) unless asked for "by users".`,
};

export function getSemanticLayer(domainKey) {
  return SEMANTIC_LAYERS[domainKey] ?? "";
}

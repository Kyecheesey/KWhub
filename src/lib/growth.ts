import { sql } from "./db";

/** Growth numbers pulled straight from the hub's own data, for Directions. */
export interface GrowthSnapshot {
  clients_total: number;
  clients_new_30d: number;
  signups_30d: number;
  pipeline_active: number;
  pipeline_value_cents: number;
  won_90d: number;
  jobs_open: number;
  invoices_unpaid_cents: number;
}

export async function growthSnapshot(): Promise<GrowthSnapshot> {
  const [row] = await sql`
    SELECT
      (SELECT COUNT(*) FROM clients)                                                                  AS clients_total,
      (SELECT COUNT(*) FROM clients  WHERE created_at > NOW() - INTERVAL '30 days')                   AS clients_new_30d,
      (SELECT COUNT(*) FROM clients  WHERE source = 'signup' AND created_at > NOW() - INTERVAL '30 days') AS signups_30d,
      (SELECT COUNT(*) FROM potentials WHERE status IN ('new','contacted','qualified','proposal'))    AS pipeline_active,
      (SELECT COALESCE(SUM(value_cents),0) FROM potentials WHERE status IN ('new','contacted','qualified','proposal')) AS pipeline_value_cents,
      (SELECT COUNT(*) FROM potentials WHERE status = 'won' AND updated_at > NOW() - INTERVAL '90 days') AS won_90d,
      (SELECT COUNT(*) FROM client_jobs WHERE status != 'done')                                       AS jobs_open,
      (SELECT COALESCE(SUM(amount_cents),0) FROM invoices WHERE status != 'paid')                     AS invoices_unpaid_cents
  ` as {
    clients_total: string; clients_new_30d: string; signups_30d: string;
    pipeline_active: string; pipeline_value_cents: string; won_90d: string;
    jobs_open: string; invoices_unpaid_cents: string;
  }[];
  return {
    clients_total: Number(row?.clients_total ?? 0),
    clients_new_30d: Number(row?.clients_new_30d ?? 0),
    signups_30d: Number(row?.signups_30d ?? 0),
    pipeline_active: Number(row?.pipeline_active ?? 0),
    pipeline_value_cents: Number(row?.pipeline_value_cents ?? 0),
    won_90d: Number(row?.won_90d ?? 0),
    jobs_open: Number(row?.jobs_open ?? 0),
    invoices_unpaid_cents: Number(row?.invoices_unpaid_cents ?? 0),
  };
}

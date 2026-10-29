import { GET as me } from "../me/route";
import { GET as messages } from "../messages/route";
import { GET as projects } from "../projects/route";
import { GET as approvals } from "../approvals/route";
import { GET as files } from "../files/route";
import { GET as invoices } from "../invoices/route";
import { GET as checklist } from "../checklist/route";
import { GET as jobs } from "../jobs/route";
import { GET as modules } from "../modules/route";
import { GET as posts } from "../posts/route";
import { GET as support } from "../support/route";
import { GET as services } from "../services/route";
import { GET as orientation } from "../orientation/route";
import { GET as plan } from "../plan/route";

const SECTIONS = {
  me, messages, projects, approvals, files, invoices, checklist,
  jobs, modules, posts, support, services, orientation, plan,
} as const;

/**
 * GET ?client_id= → everything the client portal shows on load, in one
 * response. Opening the portal used to fire 14 requests at once, each able
 * to take one of the database's 15 shared connections; this runs them all
 * in one function on one connection. Each part reuses its own route (same
 * auth and scoping) and is null if that part fails.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entries = await Promise.all(
    Object.entries(SECTIONS).map(async ([key, handler]) => {
      try {
        const sub = new Request(new URL(`/api/portal/${key}${url.search}`, url), { headers: request.headers });
        const res = await handler(sub);
        return [key, res?.ok ? await res.json() : null] as const;
      } catch {
        return [key, null] as const;
      }
    })
  );
  return Response.json(Object.fromEntries(entries));
}

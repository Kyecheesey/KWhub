import { put, del } from "@vercel/blob";
import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyClient, notifyStaff } from "@/lib/portalNotify";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT * FROM portal_files WHERE client_id = ${r.scope.clientId} ORDER BY created_at DESC
  `;
  return Response.json(rows);
}

// Multipart upload — both staff and clients can share files
export async function POST(request: Request) {
  await migrate();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "File storage isn't configured yet (BLOB_READ_WRITE_TOKEN missing)." }, { status: 503 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const bodyClientId = form.get("client_id") ? parseInt(String(form.get("client_id")), 10) : null;
  const r = await resolvePortalScope(request, { bodyClientId });
  if ("error" in r) return r.error;

  if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is too large (15MB max)." }, { status: 400 });

  const blob = await put(`portal/${r.scope.clientId}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const rows = await sql`
    INSERT INTO portal_files (client_id, filename, url, size_bytes, uploaded_by)
    VALUES (${r.scope.clientId}, ${file.name}, ${blob.url}, ${file.size}, ${r.scope.name})
    RETURNING *
  `;

  if (r.scope.role === "staff") {
    await notifyClient(r.scope.clientId, `New file from KW Innovations: ${file.name}`,
      `${r.scope.name ?? "The KW team"} shared "${file.name}" in your portal.\n\nSign in to download it.`);
  } else {
    await notifyStaff(r.scope.clientId, `Client uploaded a file: ${file.name}`,
      `${r.scope.name ?? "A client"} uploaded "${file.name}" to their portal.`);
  }
  return Response.json(rows[0], { status: 201 });
}

export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const rows = await sql`
    DELETE FROM portal_files WHERE id = ${body.id} AND client_id = ${r.scope.clientId}
    RETURNING url
  `;
  const removed = rows[0] as { url: string } | undefined;
  if (removed && process.env.BLOB_READ_WRITE_TOKEN) {
    try { await del(removed.url); } catch { /* blob already gone */ }
  }
  return Response.json({ ok: true });
}

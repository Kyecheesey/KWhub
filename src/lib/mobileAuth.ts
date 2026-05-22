import { jwtVerify } from "jose";

export async function verifyMobileToken(request: Request): Promise<{ id: string; name: string; username: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.sub),
      name: String(payload.name ?? ""),
      username: String(payload.username ?? ""),
    };
  } catch {
    return null;
  }
}

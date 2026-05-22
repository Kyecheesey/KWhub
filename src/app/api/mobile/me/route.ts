import { verifyMobileToken } from "@/lib/mobileAuth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const user = await verifyMobileToken(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  return Response.json(user, { headers: corsHeaders });
}

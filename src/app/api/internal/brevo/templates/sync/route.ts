import { brevoTemplateCatalogSchema, syncBrevoTemplateCatalog } from "@/lib/brevo/templates";
import { authenticateN8nRequest } from "@/lib/internal-api/authenticate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authentication = authenticateN8nRequest(request);
  if (!authentication.authenticated) return authentication.response;

  const parsed = brevoTemplateCatalogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Catálogo de modelos inválido." }, { status: 400 });
  }

  try {
    const syncedCount = await syncBrevoTemplateCatalog(parsed.data);
    return Response.json({
      syncedCount,
      synchronizedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "Não foi possível sincronizar os modelos da Brevo." }, { status: 500 });
  }
}

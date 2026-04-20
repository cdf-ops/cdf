import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if ((path.startsWith("/events") || path.startsWith("/expositores") || path.startsWith("/usuarios")) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/events";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/events/:path*", "/expositores/:path*", "/usuarios/:path*", "/login"],
};

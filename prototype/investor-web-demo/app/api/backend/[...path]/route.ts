const ALLOWED_ROUTES = new Map<string, Set<string>>([
  ["/health", new Set(["GET"])],
  ["/v1/auth/web-demo", new Set(["POST"])],
  ["/v1/beta/me", new Set(["GET"])],
  ["/v1/analyses", new Set(["GET", "POST"])],
]);

function isAllowed(pathname: string, method: string) {
  const exact = ALLOWED_ROUTES.get(pathname);
  if (exact?.has(method)) return true;
  return /^\/v1\/analyses\/[a-zA-Z0-9_-]+$/.test(pathname) &&
    new Set(["GET", "DELETE"]).has(method);
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const pathname = `/${path.join("/")}`;
  if (!isAllowed(pathname, request.method)) {
    return Response.json(
      { code: "PROXY_ROUTE_NOT_ALLOWED", message: "接口不在演示范围内" },
      { status: 404 },
    );
  }
  const backendBaseUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");
  if (!backendBaseUrl) {
    return Response.json(
      { code: "DEMO_BACKEND_NOT_CONFIGURED", message: "演示服务尚未完成连接" },
      { status: 503 },
    );
  }

  const headers = new Headers({ accept: "application/json" });
  for (const name of ["authorization", "content-type", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(`${backendBaseUrl}${pathname}`, {
      method: request.method,
      headers,
      body: ["POST", "DELETE"].includes(request.method)
        ? await request.arrayBuffer()
        : undefined,
      signal: controller.signal,
      redirect: "error",
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return Response.json(
      {
        code: timedOut ? "DEMO_BACKEND_TIMEOUT" : "DEMO_BACKEND_UNAVAILABLE",
        message: timedOut
          ? "分析服务响应超时，请稍后再试"
          : "分析服务暂时不可用，请稍后再试",
      },
      { status: timedOut ? 504 : 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const dynamic = "force-dynamic";

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;

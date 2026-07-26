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

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64ToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importProxyKey(encodedKey: string) {
  const keyBytes = base64ToBytes(encodedKey);
  if (keyBytes.length !== 32) throw new Error("INVALID_PROXY_KEY");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptProxyPayload(value: unknown, encodedKey: string) {
  const key = await importProxyKey(encodedKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext),
  );
  return {
    nonce: bytesToBase64Url(nonce),
    ciphertext: bytesToBase64Url(ciphertext),
  };
}

async function decryptProxyPayload<T>(
  envelope: { nonce?: string; ciphertext?: string },
  encodedKey: string,
) {
  const key = await importProxyKey(encodedKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(String(envelope.nonce || "")) },
    key,
    base64ToBytes(String(envelope.ciphertext || "")),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
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
    const body = ["POST", "DELETE"].includes(request.method)
      ? await request.text()
      : "";
    const proxyKey = process.env.BACKEND_PROXY_KEY;
    let response: Response;
    if (proxyKey) {
      const safeHeaders: Record<string, string> = {};
      for (const name of ["authorization", "content-type", "idempotency-key"]) {
        const value = headers.get(name);
        if (value) safeHeaders[name] = value;
      }
      const envelope = await encryptProxyPayload(
        {
          issuedAt: Date.now(),
          method: request.method,
          path: pathname,
          headers: safeHeaders,
          body,
        },
        proxyKey,
      );
      const encryptedResponse = await fetch(`${backendBaseUrl}/v1/web-proxy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
        signal: controller.signal,
        redirect: "error",
      });
      if (!encryptedResponse.ok) throw new Error("ENCRYPTED_PROXY_REJECTED");
      const decrypted = await decryptProxyPayload<{
        status: number;
        contentType: string;
        body: string;
      }>(
        (await encryptedResponse.json()) as {
          nonce?: string;
          ciphertext?: string;
        },
        proxyKey,
      );
      response = new Response(decrypted.body, {
        status: decrypted.status,
        headers: { "content-type": decrypted.contentType },
      });
    } else {
      if (!backendBaseUrl.startsWith("https://")) {
        throw new Error("PLAINTEXT_BACKEND_FORBIDDEN");
      }
      response = await fetch(`${backendBaseUrl}${pathname}`, {
        method: request.method,
        headers,
        body: body || undefined,
        signal: controller.signal,
        redirect: "error",
      });
    }
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

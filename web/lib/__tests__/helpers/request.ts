import { NextRequest } from "next/server";

interface RequestOpts {
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
}

export function makeRequest(
  method: string,
  url: string,
  opts: RequestOpts = {}
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };
  if (opts.cookie) {
    headers["Cookie"] = opts.cookie;
  }

  return new NextRequest(fullUrl, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

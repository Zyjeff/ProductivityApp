// Netlify Function — proxies the browser to api.anthropic.com,
// injecting the API key server-side so it never reaches the client.
//
// Required env var on Netlify: ANTHROPIC_API_KEY

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const key = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not set on Netlify site" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.text();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });
};

export const config = {
  path: "/api/anthropic",
};

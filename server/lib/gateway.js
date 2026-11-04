// Opt-in connectivity check for a saved provider profile.
//
// Security notes:
//  - The key is read from THIS process's environment (the shell that started RumiStack) and is only ever
//    sent to the profile's own validated base URL (HTTPS, or loopback HTTP). It is never stored, logged or echoed.
//  - Redirects are not followed, so a gateway cannot bounce the Authorization header to another host.
//  - Only model IDs are returned from the response body.

export async function testProvider(profile, env = process.env) {
  const key = env[profile.apiKeyEnv];
  const headers = { Accept: 'application/json', 'User-Agent': 'RumiStack-provider-test' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const result = { ok: false, keySet: Boolean(key), status: null, latencyMs: null, modelCount: null, models: [], modelListed: null, message: '' };
  const started = Date.now();

  let res;
  try {
    res = await fetch(`${profile.baseUrl}/models`, { headers, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    const code = err?.cause?.code ?? err?.code;
    result.latencyMs = Date.now() - started;
    result.message = err?.name === 'TimeoutError' ? 'Timed out after 10 s. Is the gateway running and reachable?'
      : code === 'ECONNREFUSED' ? 'Connection refused. Is the gateway running on that address and port?'
      : code === 'ENOTFOUND' ? 'Host name not found. Check the base URL.'
      : `Request failed${code ? ` (${code})` : ''}.`;
    return result;
  }

  result.status = res.status;
  result.latencyMs = Date.now() - started;

  if (res.status >= 300 && res.status < 400) {
    result.message = 'The gateway answered with a redirect. RumiStack does not follow redirects, so credentials are never sent elsewhere. Use the final URL as the base URL.';
    return result;
  }
  if (res.status === 401 || res.status === 403) {
    result.message = result.keySet
      ? `The gateway rejected the key stored in ${profile.apiKeyEnv}.`
      : `The gateway needs a key but ${profile.apiKeyEnv} is not set in the shell that started RumiStack. Set it, restart RumiStack and test again.`;
    return result;
  }
  if (res.status === 404) {
    result.message = 'No /models endpoint at this URL. The base URL may be wrong, or the gateway does not implement model listing.';
    return result;
  }
  if (!res.ok) {
    result.message = `The gateway returned HTTP ${res.status}.`;
    return result;
  }

  let ids = [];
  try {
    const text = await res.text();
    if (text.length > 2_000_000) throw new Error('too large');
    const data = JSON.parse(text);
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null;
    if (!list) throw new Error('unrecognised shape');
    ids = list.map((m) => (typeof m === 'string' ? m : m?.id)).filter((id) => typeof id === 'string');
  } catch {
    result.message = 'The gateway responded, but not with a model list RumiStack understands.';
    return result;
  }

  result.ok = true;
  result.modelCount = ids.length;
  result.models = ids.slice(0, 40);
  result.modelListed = ids.length ? ids.includes(profile.model) : null;
  result.message = ids.length === 0 ? 'Connected, but the gateway lists no models.'
    : result.modelListed ? `Connected. ${ids.length} model(s) available and "${profile.model}" is listed.`
    : `Connected. ${ids.length} model(s) available, but "${profile.model}" is not in the list. Check the model ID (some gateways accept aliases that are not listed).`;
  return result;
}

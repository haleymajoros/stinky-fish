// Vercel's Redis Marketplace has more than one provider, and they inject
// different environment variables depending on which one you pick:
//
//   - Upstash (and the old "Vercel KV"): KV_REST_API_URL + KV_REST_API_TOKEN
//     (an HTTP REST API - no persistent connection, ideal for serverless)
//   - "Redis" / Redis Cloud: a single REDIS_URL connection string
//     (standard Redis protocol over TCP - needs a real client like ioredis)
//
// Rather than requiring a specific provider, this picks whichever one is
// configured and exposes the same small async interface either way, so the
// rest of the app doesn't need to know which backend is in use.
//
// Deliberately NOT cached at module scope across the whole lifetime of the
// process: a long-warm serverless container could otherwise hold onto a
// client built from environment variables that were true at cold-start time
// but are no longer accurate after a redeploy. Re-checking env vars on every
// call is cheap (they're just property reads), and the ioredis connection
// itself is still reused via the global slot below.

async function getRawClient() {
  const upstashUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  // Guard rail: @upstash/redis will happily construct a client with
  // undefined config and only fail later, deep in its own internals, with a
  // confusing "Failed to parse URL from /pipeline" error. Refuse up front
  // with a message that actually says what's wrong.
  if (upstashUrl || upstashToken) {
    if (!upstashUrl || !upstashToken) {
      throw new Error(
        'Upstash Redis is partially configured (one of KV_REST_API_URL / KV_REST_API_TOKEN is set but not both). Check your Vercel environment variables.'
      );
    }
    const { Redis } = await import('@upstash/redis');
    const client = new Redis({ url: upstashUrl, token: upstashToken });
    return { kind: 'upstash', client };
  }

  if (redisUrl) {
    const { default: IORedis } = await import('ioredis');
    // Reuse a single connection across invocations on the same warm
    // serverless instance instead of opening a new TCP connection per
    // request, which is the main cost of using a TCP-based Redis client
    // in a serverless environment. This part IS safe to cache globally,
    // since the connection target (redisUrl) is re-read above on every
    // call - if it ever changes, a fresh client below would pick it up
    // on the next cold start, and the stale-warm-container risk that
    // applies to "which provider" doesn't apply to "reuse this socket".
    const globalKey = '__stinkyFishIORedisClient';
    if (!globalThis[globalKey] || globalThis[globalKey].__sourceUrl !== redisUrl) {
      const client = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: false,
        connectTimeout: 5000,
        // ioredis retries forever by default - cap it so an unreachable
        // host fails fast instead of hanging the request indefinitely.
        retryStrategy(times) {
          if (times > 2) return null; // stop retrying, surface the error
          return Math.min(times * 200, 1000);
        },
      });
      client.__sourceUrl = redisUrl;
      // Without this, connection errors before the first successful
      // connect can become unhandled 'error' events and crash the
      // function instead of rejecting the pending get/set call.
      client.on('error', (e) => {
        console.error('ioredis connection error:', e.message);
      });
      globalThis[globalKey] = client;
    }
    return { kind: 'ioredis', client: globalThis[globalKey] };
  }

  return { kind: 'none', client: null };
}

// Unified interface. All methods are async regardless of backend.
// Values passed to `set` may be any JSON-serializable value; `get` returns
// them already parsed back to the same shape, normalizing the difference
// between Upstash's automatic (de)serialization and ioredis's raw strings.

const COMMAND_TIMEOUT_MS = 8000;

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out waiting for the database (${label}).`)), COMMAND_TIMEOUT_MS)
    ),
  ]);
}

export async function redisGet(key) {
  const { kind, client } = await getRawClient();
  if (kind === 'none') throw new Error('No Redis connection configured.');
  if (kind === 'upstash') {
    return withTimeout(client.get(key), 'get'); // @upstash/redis auto-deserializes JSON
  }
  const raw = await withTimeout(client.get(key), 'get');
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // plain string value, not JSON
  }
}

export async function redisSet(key, value) {
  const { kind, client } = await getRawClient();
  if (kind === 'none') throw new Error('No Redis connection configured.');
  if (kind === 'upstash') {
    return withTimeout(client.set(key, value), 'set');
  }
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return withTimeout(client.set(key, serialized), 'set');
}

export async function redisSadd(key, member) {
  const { kind, client } = await getRawClient();
  if (kind === 'none') throw new Error('No Redis connection configured.');
  return withTimeout(client.sadd(key, member), 'sadd');
}

export async function redisSmembers(key) {
  const { kind, client } = await getRawClient();
  if (kind === 'none') throw new Error('No Redis connection configured.');
  return withTimeout(client.smembers(key), 'smembers');
}

export async function isRedisConfigured() {
  const { kind } = await getRawClient();
  return kind !== 'none';
}

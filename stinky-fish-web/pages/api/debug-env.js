// TEMPORARY DEBUG ENDPOINT - delete this file once the storage issue is
// resolved. It reports which environment variables are present (never
// their actual values) and which Redis client this code would select,
// without trying to connect to anything. This exists purely to answer
// "what does the deployed code actually see right now?" without guessing.

export default async function handler(req, res) {
  const presence = {
    REDIS_URL: Boolean(process.env.REDIS_URL),
    KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
  };

  let selected = 'none';
  if (presence.KV_REST_API_URL || presence.UPSTASH_REDIS_REST_URL ||
      presence.KV_REST_API_TOKEN || presence.UPSTASH_REDIS_REST_TOKEN) {
    selected = 'upstash-branch';
  } else if (presence.REDIS_URL) {
    selected = 'ioredis-branch';
  }

  return res.status(200).json({
    envVarsPresent: presence,
    codePathThatWouldBeSelected: selected,
    deployedAt: new Date().toISOString(),
  });
}

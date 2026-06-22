export function describeRedisError(err) {
  const msg = err && err.message ? err.message : String(err);
  if (msg.includes('No Redis connection configured')) {
    return 'No database is connected to this project yet. Add a Redis database from the Storage tab in Vercel, then redeploy.';
  }
  return `Could not reach the database: ${msg}`;
}

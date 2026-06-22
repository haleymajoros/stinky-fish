import { Redis } from '@upstash/redis';

// Vercel's Redis Marketplace integration (Upstash) injects KV_REST_API_URL /
// KV_REST_API_TOKEN automatically. We also fall back to the plain Upstash
// names in case someone wires up a database directly instead of through the
// Vercel integration.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Data model
// -----------
// fish:{code}            -> a Redis SET of fish ids submitted in this session
// fish:{code}:{fishId}   -> the fish's text (a plain string)
// state:{code}           -> { quick: [ids], big: [ids], actions: [{fishId,what,who,when} x3] }
//
// Fish submission writes a brand-new key per fish and adds its id to a set -
// both operations are additive, so two people submitting at the same moment
// can never overwrite each other's fish. Categorization/actions are stored
// separately in one small JSON blob, since those are edited by one person at
// a time in practice during the meeting; last-write-wins there is an
// acceptable tradeoff for staying simple.

function fishSetKey(code) {
  return `fish:${code}`;
}
function fishTextKey(code, fishId) {
  return `fish:${code}:${fishId}`;
}
function stateKey(code) {
  return `state:${code}`;
}

function emptyState() {
  return {
    quick: [],
    big: [],
    actions: [
      { fishId: null, what: '', who: '', when: '' },
      { fishId: null, what: '', who: '', when: '' },
      { fishId: null, what: '', who: '', when: '' },
    ],
  };
}

export async function addFish(code, fishList) {
  // fishList: [{id, text}]
  if (!fishList.length) return;
  const setKey = fishSetKey(code);
  await Promise.all(
    fishList.map(async (f) => {
      await redis.set(fishTextKey(code, f.id), f.text);
      await redis.sadd(setKey, f.id);
    })
  );
}

export async function getFullBoard(code) {
  const ids = await redis.smembers(fishSetKey(code));
  const fish = ids.length
    ? await Promise.all(
        ids.map(async (id) => {
          const text = await redis.get(fishTextKey(code, id));
          return text ? { id, text } : null;
        })
      )
    : [];
  const state = (await redis.get(stateKey(code))) || emptyState();
  return {
    fish: fish.filter(Boolean),
    quick: state.quick || [],
    big: state.big || [],
    actions: state.actions && state.actions.length === 3 ? state.actions : emptyState().actions,
  };
}

export async function setState(code, partialState) {
  const current = (await redis.get(stateKey(code))) || emptyState();
  const next = { ...current, ...partialState };
  await redis.set(stateKey(code), next);
  return next;
}

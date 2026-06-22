import { getFullBoard, addFish } from '../../../lib/kv';
import { normalizeCode, isValidCode } from '../../../lib/validate';
import { describeRedisError } from '../../../lib/errors';

export default async function handler(req, res) {
  const code = normalizeCode(req.query.code);
  if (!isValidCode(code)) {
    return res.status(400).json({ error: 'Invalid session code.' });
  }

  if (req.method === 'GET') {
    try {
      const board = await getFullBoard(code);
      return res.status(200).json(board);
    } catch (err) {
      console.error('GET board failed', err);
      return res.status(500).json({ error: describeRedisError(err) });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fish } = req.body || {};
      if (!Array.isArray(fish) || fish.length === 0) {
        return res.status(400).json({ error: 'No fish provided.' });
      }
      const cleaned = fish
        .filter((f) => f && typeof f.text === 'string' && f.text.trim().length > 0)
        .slice(0, 3) // a person submits at most 3 at a time
        .map((f) => ({
          id: typeof f.id === 'string' && f.id.length > 0 ? f.id : cryptoRandomId(),
          text: f.text.trim().slice(0, 280),
        }));
      if (!cleaned.length) {
        return res.status(400).json({ error: 'No valid fish text provided.' });
      }
      await addFish(code, cleaned);
      const board = await getFullBoard(code);
      return res.status(200).json(board);
    } catch (err) {
      console.error('POST board failed', err);
      return res.status(500).json({ error: describeRedisError(err) });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}

function cryptoRandomId() {
  // Fallback id generator if the client didn't send one.
  return 'fish-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

import { setState, getFullBoard } from '../../../../lib/kv';
import { normalizeCode, isValidCode } from '../../../../lib/validate';
import { describeRedisError } from '../../../../lib/errors';

export default async function handler(req, res) {
  const code = normalizeCode(req.query.code);
  if (!isValidCode(code)) {
    return res.status(400).json({ error: 'Invalid session code.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  try {
    const { quick, big, actions } = req.body || {};
    const patch = {};
    if (Array.isArray(quick)) patch.quick = quick.filter((id) => typeof id === 'string').slice(0, 200);
    if (Array.isArray(big)) patch.big = big.filter((id) => typeof id === 'string').slice(0, 200);
    if (Array.isArray(actions) && actions.length === 3) {
      patch.actions = actions.map((a) => ({
        fishId: typeof a?.fishId === 'string' ? a.fishId : null,
        what: typeof a?.what === 'string' ? a.what.slice(0, 200) : '',
        who: typeof a?.who === 'string' ? a.who.slice(0, 200) : '',
        when: typeof a?.when === 'string' ? a.when.slice(0, 200) : '',
      }));
    }

    await setState(code, patch);
    const board = await getFullBoard(code);
    return res.status(200).json(board);
  } catch (err) {
    console.error('POST state failed', err);
    return res.status(500).json({ error: describeRedisError(err) });
  }
}

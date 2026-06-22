export async function fetchBoard(code) {
  const res = await fetch(`/api/board/${encodeURIComponent(code)}`);
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(body?.error || `Failed to load board (${res.status})`);
  }
  return res.json();
}

export async function submitFish(code, fish) {
  const res = await fetch(`/api/board/${encodeURIComponent(code)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fish }),
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(body?.error || `Failed to submit fish (${res.status})`);
  }
  return res.json();
}

export async function updateState(code, patch) {
  const res = await fetch(`/api/board/${encodeURIComponent(code)}/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(body?.error || `Failed to update board (${res.status})`);
  }
  return res.json();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

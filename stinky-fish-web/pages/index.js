import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { v4 as uuidv4 } from 'uuid';
import FishIcon from '../components/FishIcon';
import Bubbles from '../components/Bubbles';
import { fetchBoard, submitFish, updateState } from '../lib/api';

const QUAD_DEFS = [
  { key: 'uncertain', label: 'What are your uncertainties?', placeholder: 'What\u2019s unclear or unknown...' },
  { key: 'afraid', label: 'What\u2019s making you feel afraid or anxious?', placeholder: 'Name the fear...' },
  { key: 'unspoken', label: 'What is everybody thinking and no one is saying?', placeholder: 'Speak the unspeakable...' },
  { key: 'past', label: 'What are the past issues we can\u2019t get over?', placeholder: 'Old wounds, unresolved...' },
];

function normalizeCodeInput(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function Home() {
  const [screen, setScreen] = useState('join'); // join | quadrants | submitted | board
  const [sessionCode, setSessionCode] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [codeDraft, setCodeDraft] = useState('');
  const [quadrants, setQuadrants] = useState({ uncertain: '', afraid: '', unspoken: '', past: '' });
  const [selectedFish, setSelectedFish] = useState([]);
  const [customFishDraft, setCustomFishDraft] = useState('');
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef(null);
  const actionDebounceRef = useRef({});
  const latestActionsRef = useRef(null);

  const startPolling = useCallback((code) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await fetchBoard(code);
        setBoard((prev) => {
          // Preserve locally-edited actions — they may be ahead of Redis if
          // the debounced save hasn't landed yet. Only fish/quick/big need polling.
          const merged = prev ? { ...fresh, actions: prev.actions } : fresh;
          return JSON.stringify(merged) !== JSON.stringify(prev) ? merged : prev;
        });
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    }, 3000);
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  function handleJoin() {
    const code = normalizeCodeInput(codeDraft);
    if (!code) return;
    setSessionCode(code);
    setScreen('quadrants');
  }

  function getCandidates() {
    const seen = new Set();
    const candidates = [];
    QUAD_DEFS.forEach((def) => {
      const raw = quadrants[def.key] || '';
      raw.split('\n').forEach((line) => {
        const t = line.trim();
        if (t.length > 0 && !seen.has(t)) {
          seen.add(t);
          candidates.push(t);
        }
      });
    });
    return candidates;
  }

  function toggleCandidate(text) {
    setSelectedFish((prev) => {
      if (prev.includes(text)) return prev.filter((t) => t !== text);
      if (prev.length >= 3) return prev;
      return [...prev, text];
    });
  }

  function addCustomFish() {
    const val = customFishDraft.trim();
    if (!val || selectedFish.length >= 3) return;
    if (!selectedFish.includes(val)) setSelectedFish((prev) => [...prev, val]);
    setCustomFishDraft('');
  }

  async function handleSubmitFish() {
    setSubmitting(true);
    setError(null);
    const fishPayload = selectedFish.map((text) => ({ id: uuidv4(), text }));
    try {
      const freshBoard = await submitFish(sessionCode, fishPayload);
      setBoard(freshBoard);
      setScreen('submitted');
      startPolling(sessionCode);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function goToBoard() {
    setScreen('board');
  }

  async function moveFishToZone(fishId, zone) {
    let computedQuick = null;
    let computedBig = null;
    setBoard((prev) => {
      if (!prev) return prev;
      const quick = prev.quick.filter((id) => id !== fishId);
      const big = prev.big.filter((id) => id !== fishId);
      if (zone === 'quick') quick.push(fishId);
      else if (zone === 'big') big.push(fishId);
      computedQuick = quick;
      computedBig = big;
      return { ...prev, quick, big };
    });
    try {
      const fresh = await updateState(sessionCode, {
        quick: computedQuick || [],
        big: computedBig || [],
      });
      setBoard((prev) => (prev ? { ...fresh, actions: prev.actions } : fresh));
    } catch (e) {
      setError(e.message);
    }
  }

  async function assignFishToAction(fishId, idx) {
    let computedActions = null;
    setBoard((prev) => {
      if (!prev) return prev;
      const nextActions = prev.actions.map((a, i) => (i === idx ? { ...a, fishId } : a));
      computedActions = nextActions;
      return { ...prev, actions: nextActions };
    });
    try {
      await updateState(sessionCode, { actions: computedActions || [] });
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateActionField(idx, field, value) {
    setBoard((prev) => {
      if (!prev) return prev;
      const nextActions = prev.actions.map((a, i) => (i === idx ? { ...a, [field]: value } : a));
      latestActionsRef.current = nextActions;
      return { ...prev, actions: nextActions };
    });
    const key = `${idx}-${field}`;
    clearTimeout(actionDebounceRef.current[key]);
    actionDebounceRef.current[key] = setTimeout(async () => {
      if (!latestActionsRef.current) return;
      try {
        await updateState(sessionCode, { actions: latestActionsRef.current });
      } catch (e) {
        setError(e.message);
      }
    }, 500);
  }

  function leaveSession() {
    stopPolling();
    setScreen('join');
    setSessionCode('');
    setBoard(null);
    setError(null);
    setQuadrants({ uncertain: '', afraid: '', unspoken: '', past: '' });
    setSelectedFish([]);
  }

  return (
    <>
      <Head>
        <title>Address the Stinky Fish</title>
      </Head>
      <div className="waterline" />
      <Bubbles />
      <div className="app">
        {screen === 'join' && (
          <JoinScreen
            nameDraft={nameDraft}
            setNameDraft={setNameDraft}
            codeDraft={codeDraft}
            setCodeDraft={setCodeDraft}
            onJoin={handleJoin}
          />
        )}

        {screen !== 'join' && (
          <>
            <Topbar sessionCode={sessionCode} onLeave={leaveSession} error={error} />
            <PhaseTrack
              activeIdx={screen === 'quadrants' ? 0 : screen === 'submitted' ? 1 : 2}
            />
            {screen === 'quadrants' && (
              <QuadrantsScreen
                quadrants={quadrants}
                setQuadrants={setQuadrants}
                selectedFish={selectedFish}
                toggleCandidate={toggleCandidate}
                customFishDraft={customFishDraft}
                setCustomFishDraft={setCustomFishDraft}
                addCustomFish={addCustomFish}
                getCandidates={getCandidates}
                onSubmit={handleSubmitFish}
                submitting={submitting}
              />
            )}
            {screen === 'submitted' && <SubmittedScreen onGoToBoard={goToBoard} />}
            {screen === 'board' && board && (
              <BoardScreen
                board={board}
                sessionCode={sessionCode}
                onMoveFishToZone={moveFishToZone}
                onAssignFishToAction={assignFishToAction}
                onUpdateActionField={updateActionField}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------

function JoinScreen({ nameDraft, setNameDraft, codeDraft, setCodeDraft, onJoin }) {
  return (
    <div className="join-wrap">
      <div className="card join-card">
        <FishIcon color="#FF8C61" className="join-fish" />
        <h2>Address the Stinky Fish</h2>
        <p className="tagline">Turning courageous conversations into action</p>
        <div className="field">
          <label htmlFor="nameInput">Your name</label>
          <input
            id="nameInput"
            type="text"
            placeholder="e.g. Jordan"
            autoComplete="off"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <div className="hint">Only visible to you &mdash; never shared with your team.</div>
        </div>
        <div className="field">
          <label htmlFor="codeInput">Team session code</label>
          <input
            id="codeInput"
            type="text"
            placeholder="e.g. marketing-q3"
            autoComplete="off"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onJoin();
            }}
          />
          <div className="hint">Make one up and share it with your team, or enter theirs to join.</div>
        </div>
        <button className="btn btn-primary btn-block" onClick={onJoin}>
          Dive in
        </button>
      </div>
    </div>
  );
}

function Topbar({ sessionCode, onLeave, error }) {
  return (
    <>
      <div className="topbar">
        <div className="brand">
          <FishIcon color="#FF8C61" className="brand-fish" />
          <div>
            <h1>Address the Stinky Fish</h1>
            <p className="sub">Turning courageous conversations into action</p>
          </div>
        </div>
        <div className="session-pill">
          <span>Session</span>
          <span className="code">{sessionCode}</span>
          <button onClick={onLeave}>leave</button>
        </div>
      </div>
      {error && (
        <div className="storage-error">
          <strong>Sync problem:</strong> {error}
        </div>
      )}
    </>
  );
}

function PhaseTrack({ activeIdx }) {
  const steps = ['Your stinky fish', 'Waiting room', 'Team board'];
  return (
    <div className="phase-track">
      {steps.map((label, i) => {
        let cls = 'phase-step';
        if (i < activeIdx) cls += ' done';
        if (i === activeIdx) cls += ' active';
        return (
          <div className={cls} key={label}>
            <span className="num">{i + 1}</span>
            {label}
          </div>
        );
      })}
    </div>
  );
}

function QuadrantsScreen({
  quadrants,
  setQuadrants,
  selectedFish,
  toggleCandidate,
  customFishDraft,
  setCustomFishDraft,
  addCustomFish,
  getCandidates,
  onSubmit,
  submitting,
}) {
  const candidates = getCandidates();
  const selectedCustom = selectedFish.filter((s) => !candidates.includes(s));

  return (
    <>
      <div className="quad-intro">
        <h2>What&rsquo;s in the tank?</h2>
        <p>Answer privately. No one sees this until you submit your top 3.</p>
      </div>
      <div className="quad-grid">
        <div className="center-fish-wrap" style={{ gridColumn: '1 / -1' }}>
          <FishIcon color="#5DCAA5" className="center-fish" />
        </div>
        {QUAD_DEFS.map((def) => (
          <div className="quad-cell" key={def.key}>
            <label>{def.label}</label>
            <textarea
              placeholder={def.placeholder}
              value={quadrants[def.key]}
              onChange={(e) => setQuadrants((prev) => ({ ...prev, [def.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="top3-section">
        <h3>Pick your top 3 stinky fish</h3>
        <p className="help">Tap up to 3 from what you wrote above. These get shared anonymously with the team.</p>
        <div className="candidate-list">
          {candidates.length === 0 && selectedCustom.length === 0 && (
            <p className="no-candidates">Write something in the boxes above and it&rsquo;ll show up here to pick from.</p>
          )}
          {candidates.map((c) => {
            const isSelected = selectedFish.includes(c);
            const disabled = !isSelected && selectedFish.length >= 3;
            return (
              <button
                type="button"
                key={c}
                className={`candidate-chip ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && toggleCandidate(c)}
              >
                <span className="chip-check">{isSelected ? '\u2713' : ''}</span>
                <span className="chip-text">{c}</span>
              </button>
            );
          })}
          {selectedCustom.map((c) => (
            <button type="button" key={c} className="candidate-chip selected" onClick={() => toggleCandidate(c)}>
              <span className="chip-check">{'\u2713'}</span>
              <span className="chip-text">{c}</span>
            </button>
          ))}
        </div>
        <div className="custom-fish-row">
          <input
            type="text"
            placeholder="Or write a new one..."
            maxLength={140}
            value={customFishDraft}
            onChange={(e) => setCustomFishDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomFish();
              }
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={addCustomFish}>
            Add
          </button>
        </div>
      </div>

      <div className="submit-row">
        <button
          className="btn btn-primary"
          disabled={selectedFish.length < 1 || submitting}
          onClick={onSubmit}
        >
          {submitting ? 'Submitting...' : `Submit my fish (${selectedFish.length}/3)`}
        </button>
      </div>
    </>
  );
}

function SubmittedScreen({ onGoToBoard }) {
  return (
    <div className="join-wrap" style={{ minHeight: '50vh' }}>
      <div className="card join-card">
        <FishIcon color="#5DCAA5" className="join-fish" />
        <h2>Your fish are in the tank</h2>
        <p className="tagline">Waiting for the rest of the team to submit theirs.</p>
        <button className="btn btn-primary btn-block" onClick={onGoToBoard}>
          Go to team board
        </button>
      </div>
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea ref={ref} placeholder={placeholder} value={value} rows={1} onChange={onChange} />
  );
}

function FishCard({ fish, onDragStart, onDragEnd }) {
  return (
    <div
      className="fish-card"
      draggable
      onDragStart={(e) => onDragStart(e, fish.id)}
      onDragEnd={onDragEnd}
    >
      <div className="fish-icon-row">
        <FishIcon color="#D9572E" />
      </div>
      <span className="fish-text">{fish.text}</span>
    </div>
  );
}

async function downloadActionPDF(board, sessionCode) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 48;
  const col = margin + 90;
  let y = margin;

  // Header bar
  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, W, 72, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Address the Stinky Fish', margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 180, 200);
  doc.text('Course of Action', margin, 52);

  // Meta row
  y = 96;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Session: ${sessionCode}`, margin, y);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, W - margin, y, { align: 'right' });

  // Divider
  y += 14;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 24;

  board.actions.forEach((action, i) => {
    const fish = board.fish.find((f) => f.id === action.fishId);
    const rows = [
      { label: 'STINKY FISH', value: fish ? fish.text : '—' },
      { label: 'WHAT', value: action.what || '—' },
      { label: 'WHO', value: action.who || '—' },
      { label: 'WHEN', value: action.when || '—' },
    ];

    // Card background
    const cardX = margin;
    const cardW = W - margin * 2;
    // Measure card height first
    let cardHeight = 16;
    rows.forEach(({ value }) => {
      const lines = doc.splitTextToSize(value, cardW - 110);
      cardHeight += lines.length * 14 + 10;
    });
    cardHeight += 8;

    doc.setFillColor(248, 244, 238);
    doc.roundedRect(cardX, y, cardW, cardHeight, 8, 8, 'F');

    // Priority badge
    doc.setFillColor(27, 110, 140);
    doc.circle(cardX + 20, y + 20, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), cardX + 20, y + 24.5, { align: 'center' });

    // Fields
    let fy = y + 14;
    rows.forEach(({ label, value }) => {
      const lines = doc.splitTextToSize(value, cardW - 110);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(27, 110, 140);
      doc.text(label, cardX + 40, fy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(10, 37, 64);
      doc.text(lines, cardX + 110, fy);
      fy += lines.length * 14 + 10;
    });

    y += cardHeight + 16;
  });

  doc.save(`stinky-fish-${sessionCode}.pdf`);
}

function BoardScreen({ board, onMoveFishToZone, onAssignFishToAction, onUpdateActionField, sessionCode }) {
  const sortedIds = new Set([...board.quick, ...board.big]);
  const unsorted = board.fish.filter((f) => !sortedIds.has(f.id));
  const quickFish = board.fish.filter((f) => board.quick.includes(f.id));
  const bigFish = board.fish.filter((f) => board.big.includes(f.id));

  function handleDragStart(e, fishId) {
    e.dataTransfer.setData('text/plain', fishId);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  }
  function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
  }

  function handleZoneDrop(e, zone) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const fishId = e.dataTransfer.getData('text/plain');
    if (fishId) onMoveFishToZone(fishId, zone);
  }
  function handleTankDrop(e) {
    e.preventDefault();
    const fishId = e.dataTransfer.getData('text/plain');
    if (fishId) onMoveFishToZone(fishId, null);
  }
  function handleActionDrop(e, idx) {
    e.preventDefault();
    const fishId = e.dataTransfer.getData('text/plain');
    if (fishId) onAssignFishToAction(fishId, idx);
  }

  return (
    <>
      <div className="board-header">
        <h2>The team&rsquo;s tank</h2>
        <p>All fish submitted so far &mdash; anonymous, pooled together.</p>
      </div>
      <div className="sync-indicator">
        <span className="sync-dot" /> live &mdash; updates as teammates submit
      </div>

      <div className="tank" onDragOver={(e) => e.preventDefault()} onDrop={handleTankDrop}>
        <h3>1. Consolidated stinky fish ({board.fish.length})</h3>
        {unsorted.length ? (
          <div className="fish-pool">
            {unsorted.map((f) => (
              <FishCard key={f.id} fish={f} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            ))}
          </div>
        ) : (
          <div className="tank-empty">No unsorted fish right now.</div>
        )}
      </div>

      <div className="wins-grid">
        <div
          className="win-zone quick"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('dragover');
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
          onDrop={(e) => handleZoneDrop(e, 'quick')}
        >
          <h3>
            <FishIcon color="#1A9A72" />
            Quick wins
          </h3>
          <p className="zone-sub">High impact, low difficulty</p>
          {quickFish.length ? (
            <div className="fish-pool">
              {quickFish.map((f) => (
                <FishCard key={f.id} fish={f} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
              ))}
            </div>
          ) : (
            <div className="empty-hint">Drag fish here</div>
          )}
        </div>
        <div
          className="win-zone big"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('dragover');
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
          onDrop={(e) => handleZoneDrop(e, 'big')}
        >
          <h3>
            <FishIcon color="#D9572E" />
            Big wins
          </h3>
          <p className="zone-sub">High impact, high difficulty</p>
          {bigFish.length ? (
            <div className="fish-pool">
              {bigFish.map((f) => (
                <FishCard key={f.id} fish={f} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
              ))}
            </div>
          ) : (
            <div className="empty-hint">Drag fish here</div>
          )}
        </div>
      </div>

      <div className="action-section">
        <h3>3. Define course of action</h3>
        <p className="help">Drag your top 3 priority fish below, then agree on next steps.</p>
        <div className="action-slots">
          {board.actions.map((action, i) => {
            const fish = board.fish.find((f) => f.id === action.fishId);
            return (
              <div className="action-slot" key={i}>
                <div className="slot-num">{i + 1}</div>
                <div className="slot-fields">
                  <div>
                    <span className="action-field-label">Stinky fish</span>
                    <div
                      className={`slot-fish ${fish ? 'filled' : ''}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleActionDrop(e, i)}
                    >
                      {fish ? fish.text : 'Drag a top fish here'}
                    </div>
                  </div>
                  <div>
                    <span className="action-field-label">What</span>
                    <AutoTextarea
                      placeholder="What should we do about it?"
                      value={action.what || ''}
                      onChange={(e) => onUpdateActionField(i, 'what', e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="action-field-label">Who</span>
                    <AutoTextarea
                      placeholder="Who will take the lead?"
                      value={action.who || ''}
                      onChange={(e) => onUpdateActionField(i, 'who', e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="action-field-label">When</span>
                    <AutoTextarea
                      placeholder="What's our timeframe?"
                      value={action.when || ''}
                      onChange={(e) => onUpdateActionField(i, 'when', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pdf-row">
          <button className="btn btn-primary" onClick={() => downloadActionPDF(board, sessionCode)}>
            Download PDF
          </button>
        </div>
      </div>
    </>
  );
}

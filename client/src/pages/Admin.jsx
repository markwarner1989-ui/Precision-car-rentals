import { useEffect, useState } from 'react';
import { api, money } from '../lib/api.js';

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('pcr_admin') || '');
  if (!token) return <Login onLogin={(t) => { localStorage.setItem('pcr_admin', t); setToken(t); }} />;
  return <Dashboard token={token} onLogout={() => { localStorage.removeItem('pcr_admin'); setToken(''); }} />;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@precisioncarrentals.us');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError('');
    try { const d = await api.login(email, password); onLogin(d.token); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 20 }}>
          <div className="brand-mark">P</div>
          <div className="brand-name">Precision Admin<span>Booking control</span></div>
        </div>
        {error && <div className="note note-error">{error}</div>}
        <div className="field"><label>Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label>
          <input className="input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <button className="btn btn-teal btn-block" disabled={busy} onClick={submit}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('pending');
  const [bookings, setBookings] = useState([]);
  const [active, setActive] = useState(null);
  const [view, setView] = useState('bookings'); // bookings | availability

  const loadStats = () => api.adminGet('/stats', token).then((d) => setStats(d.stats)).catch(() => {});
  const loadBookings = () => {
    const q = tab === 'all' ? '' : `?status=${tab}`;
    api.adminGet(`/bookings${q}`, token).then((d) => setBookings(d.bookings)).catch(() => {});
  };
  useEffect(() => { loadStats(); }, []);
  useEffect(() => { if (view === 'bookings') loadBookings(); }, [tab, view]);

  function refresh() { loadStats(); loadBookings(); }

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <div className="container">
          <div className="brand">
            <div className="brand-mark">P</div>
            <div className="brand-name" style={{ color: '#fff' }}>Precision Admin<span style={{ color: '#bfe0dc' }}>Booking control</span></div>
          </div>
          <button className="btn btn-ghost" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      <div className="container">
        {stats && (
          <div className="stat-grid">
            <Stat n={stats.total} l="Total bookings" />
            <Stat n={stats.pending} l="Pending" />
            <Stat n={stats.approved} l="Approved" />
            <Stat n={money(stats.deposits_collected)} l="Deposits collected" />
          </div>
        )}

        <div className="tabs">
          <button className={`tab ${view === 'bookings' ? 'active' : ''}`} onClick={() => setView('bookings')}>Bookings</button>
          <button className={`tab ${view === 'availability' ? 'active' : ''}`} onClick={() => setView('availability')}>Availability</button>
        </div>

        {view === 'bookings' ? (
          <>
            <div className="tabs">
              {['pending', 'approved', 'declined', 'all'].map((t) => (
                <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <BookingsTable bookings={bookings} onOpen={setActive} />
          </>
        ) : (
          <Availability token={token} />
        )}
      </div>

      {active && (
        <BookingModal booking={active} token={token} onClose={() => setActive(null)}
                      onChanged={() => { setActive(null); refresh(); }} />
      )}
    </div>
  );
}

function Stat({ n, l }) { return <div className="stat"><div className="n">{n}</div><div className="l">{l}</div></div>; }

function BookingsTable({ bookings, onOpen }) {
  if (!bookings.length) return <div className="panel panel-pad" style={{ marginTop: 4 }}>No bookings here yet.</div>;
  return (
    <table className="bk-table">
      <thead>
        <tr><th>Ref</th><th>Customer</th><th>Class</th><th>Dates</th><th>Deposit</th><th>Status</th></tr>
      </thead>
      <tbody>
        {bookings.map((b) => (
          <tr key={b.id} className="clickable" onClick={() => onOpen(b)}>
            <td><strong>{b.reference}</strong></td>
            <td>{b.customer_name}</td>
            <td>{b.category_name}</td>
            <td>{b.pickup_at.slice(0, 10)} → {b.return_at.slice(0, 10)}</td>
            <td>{money(b.deposit)}</td>
            <td><span className={`badge ${b.status}`}>{b.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BookingModal({ booking: b, token, onClose, onChanged }) {
  const [vehicle, setVehicle] = useState(b.assigned_vehicle || '');
  const [notes, setNotes] = useState(b.admin_notes || '');
  const [busy, setBusy] = useState(false);
  async function act(kind) {
    setBusy(true);
    try {
      await api.adminPost(`/bookings/${b.id}/${kind}`, token,
        kind === 'approve' ? { assignedVehicle: vehicle, notes } : { notes });
      onChanged();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel-pad" onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginTop: 0 }}>
          <h2 className="section-title" style={{ margin: 0 }}>{b.reference}</h2>
          <span className={`badge ${b.status}`}>{b.status}</span>
        </div>
        <dl className="kv">
          <dt>Customer</dt><dd>{b.customer_name}</dd>
          <dt>Phone</dt><dd>{b.cell_phone}</dd>
          <dt>Email</dt><dd>{b.email}</dd>
          <dt>Address</dt><dd>{b.address}</dd>
          <dt>Class</dt><dd>{b.category_name}</dd>
          <dt>Pickup</dt><dd>{b.pickup_at.replace('T', ' ')}</dd>
          <dt>Return</dt><dd>{b.return_at.replace('T', ' ')}</dd>
          <dt>Coverage</dt><dd>{b.coverage_type}</dd>
          <dt>Deposit paid</dt><dd>{money(b.deposit)} · {b.payment_status} ({b.payment_mode})</dd>
          <dt>Due at pickup</dt><dd>{money(b.due_at_pickup)}</dd>
        </dl>

        <div className="field">
          <label>Documents</label>
          <div className="doc-thumbs">
            {b.license_url && <a href={b.license_url} target="_blank" rel="noreferrer">License ↗</a>}
            {b.insurance_urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">Insurance {i + 1} ↗</a>)}
          </div>
        </div>

        {b.status === 'pending' && (
          <>
            <div className="field"><label>Assign vehicle</label>
              <input className="input" placeholder="e.g. 2023 Tahoe #A14" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
            </div>
            <div className="field"><label>Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Verification notes" />
            </div>
            <div className="row-between">
              <button className="btn btn-ghost" disabled={busy} onClick={() => act('decline')}>Decline</button>
              <button className="btn btn-teal" disabled={busy} onClick={() => act('approve')}>Approve reservation</button>
            </div>
          </>
        )}
        {b.status !== 'pending' && (
          <>
            {b.assigned_vehicle && <p><strong>Assigned:</strong> {b.assigned_vehicle}</p>}
            {b.admin_notes && <p><strong>Notes:</strong> {b.admin_notes}</p>}
            <button className="btn btn-ghost btn-block" onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}

function Availability({ token }) {
  const [cats, setCats] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [f, setF] = useState({ categoryId: '', startDate: '', endDate: '', reason: '' });

  const load = () => {
    api.adminGet('/categories', token).then((d) => setCats(d.categories)).catch(() => {});
    api.adminGet('/blocks', token).then((d) => setBlocks(d.blocks)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  async function add() {
    if (!f.categoryId || !f.startDate || !f.endDate) return;
    await api.adminPost('/blocks', token, f);
    setF({ categoryId: '', startDate: '', endDate: '', reason: '' });
    load();
  }
  async function remove(id) { await api.adminDelete(`/blocks/${id}`, token); load(); }

  return (
    <div className="split">
      <div className="panel panel-pad">
        <h2 className="section-title" style={{ fontSize: 20 }}>Blocked date ranges</h2>
        <p className="section-sub">Blocked classes can’t be booked for the dates shown. Customers see them greyed out.</p>
        {!blocks.length && <p className="section-sub">No blocks. Every class is bookable.</p>}
        <table className="bk-table">
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.category_name}</strong></td>
                <td>{b.start_date} → {b.end_date}</td>
                <td>{b.reason || '—'}</td>
                <td><button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => remove(b.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel panel-pad">
        <h3 className="section-title" style={{ fontSize: 18 }}>Block a class</h3>
        <div className="field"><label>Class</label>
          <select className="select" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            <option value="">Select…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field"><label>From</label><input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
        <div className="field"><label>To</label><input className="input" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        <div className="field"><label>Reason (optional)</label><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <button className="btn btn-teal btn-block" onClick={add}>Add block</button>
      </div>
    </div>
  );
}

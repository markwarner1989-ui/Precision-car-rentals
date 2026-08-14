const BASE = '/api';

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  meta: () => fetch(`${BASE}/meta`).then(json),
  categories: (pickup, ret) => {
    const q = pickup && ret ? `?pickup=${encodeURIComponent(pickup)}&return=${encodeURIComponent(ret)}` : '';
    return fetch(`${BASE}/categories${q}`).then(json);
  },
  quote: (body) =>
    fetch(`${BASE}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json),
  createBooking: (formData) =>
    fetch(`${BASE}/bookings`, { method: 'POST', body: formData }).then(json),

  // admin
  login: (email, password) =>
    fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(json),
  adminGet: (path, token) =>
    fetch(`${BASE}/admin${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(json),
  adminPost: (path, token, body) =>
    fetch(`${BASE}/admin${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    }).then(json),
  adminDelete: (path, token) =>
    fetch(`${BASE}/admin${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(json),
};

export const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

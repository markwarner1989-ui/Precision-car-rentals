import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import db from '../lib/db.js';
import { signAdmin, requireAdmin } from '../lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// ── login ──
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ token: signAdmin(email), email });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// everything below requires admin
router.use(requireAdmin);

// ── bookings ──
router.get('/bookings', (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare('SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
  res.json({ bookings: rows.map(shape) });
});

router.get('/bookings/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json({ booking: shape(b) });
});

router.post('/bookings/:id/approve', (req, res) => {
  const { assignedVehicle, notes } = req.body;
  const info = db.prepare(
    'UPDATE bookings SET status = ?, assigned_vehicle = ?, admin_notes = ? WHERE id = ?'
  ).run('approved', assignedVehicle || null, notes || null, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/bookings/:id/decline', (req, res) => {
  const { notes } = req.body;
  const info = db.prepare(
    'UPDATE bookings SET status = ?, admin_notes = ? WHERE id = ?'
  ).run('declined', notes || null, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── categories ──
router.get('/categories', (req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY sort_order').all() });
});

router.post('/categories', (req, res) => {
  const { name, example, description, image_url, daily_rate, deposit, sort_order } = req.body;
  const id = nanoid(10);
  db.prepare(`
    INSERT INTO categories (id, name, example, description, image_url, daily_rate, deposit, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, name, example, description, image_url, daily_rate, deposit, sort_order || 0);
  res.json({ ok: true, id });
});

router.put('/categories/:id', (req, res) => {
  const { name, example, description, image_url, daily_rate, deposit, sort_order, active } = req.body;
  db.prepare(`
    UPDATE categories SET name=?, example=?, description=?, image_url=?,
      daily_rate=?, deposit=?, sort_order=?, active=? WHERE id=?
  `).run(name, example, description, image_url, daily_rate, deposit, sort_order || 0,
         active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// ── availability blocks ──
router.get('/blocks', (req, res) => {
  res.json({
    blocks: db.prepare(`
      SELECT b.*, c.name AS category_name FROM category_blocks b
      JOIN categories c ON c.id = b.category_id ORDER BY b.start_date
    `).all(),
  });
});

router.post('/blocks', (req, res) => {
  const { categoryId, startDate, endDate, reason } = req.body;
  const id = nanoid(10);
  db.prepare(`
    INSERT INTO category_blocks (id, category_id, start_date, end_date, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, categoryId, startDate, endDate, reason || null);
  res.json({ ok: true, id });
});

router.delete('/blocks/:id', (req, res) => {
  db.prepare('DELETE FROM category_blocks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── simple dashboard stats ──
router.get('/stats', (req, res) => {
  const row = db.prepare(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(status='pending')                                 AS pending,
      SUM(status='approved')                                AS approved,
      SUM(status='declined')                                AS declined,
      COALESCE(SUM(CASE WHEN payment_status='paid' THEN deposit END),0) AS deposits_collected
    FROM bookings
  `).get();
  res.json({ stats: row });
});

function shape(b) {
  return {
    ...b,
    insurance_files: safeParse(b.insurance_files),
    license_url: b.license_file ? `/uploads/${b.license_file}` : null,
    insurance_urls: safeParse(b.insurance_files).map((f) => `/uploads/${f}`),
  };
}
function safeParse(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }

export default router;

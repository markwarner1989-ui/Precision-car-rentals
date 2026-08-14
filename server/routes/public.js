import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import db from '../lib/db.js';
import { quote, isCategoryAvailable, INSURANCE, rentalDays } from '../lib/pricing.js';
import { chargeDeposit, paymentMode } from '../lib/payments.js';
import { notifyBusiness } from '../lib/sms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// ── file uploads ──
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${nanoid(6)}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpe?g|png|webp|heic)|application\/pdf/.test(file.mimetype);
    cb(ok ? null : new Error('Only images or PDF allowed'), ok);
  },
});

const catStmt = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order');
const catById = db.prepare('SELECT * FROM categories WHERE id = ? AND active = 1');
const blocksFor = db.prepare('SELECT * FROM category_blocks WHERE category_id = ?');

// GET /api/categories?pickup=&return=
// Returns categories with an `available` flag when dates are supplied.
router.get('/categories', (req, res) => {
  const { pickup, return: ret } = req.query;
  const cats = catStmt.all();
  const withAvail = cats.map((c) => {
    let available = true;
    if (pickup && ret) {
      const blocks = blocksFor.all(c.id);
      available = isCategoryAvailable(blocks, pickup, ret);
    }
    return {
      id: c.id,
      name: c.name,
      example: c.example,
      description: c.description,
      image_url: c.image_url,
      daily_rate: c.daily_rate,
      deposit: c.deposit,
      available,
    };
  });
  res.json({ categories: withAvail, insurance: INSURANCE });
});

// POST /api/quote  { categoryId, pickup, return, coverageType }
router.post('/quote', (req, res) => {
  const { categoryId, pickup, return: ret, coverageType } = req.body;
  const cat = catById.get(categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (rentalDays(pickup, ret) === 0)
    return res.status(400).json({ error: 'Return must be after pickup' });

  const blocks = blocksFor.all(cat.id);
  if (!isCategoryAvailable(blocks, pickup, ret))
    return res.status(409).json({ error: 'This category is not available for those dates' });

  try {
    const q = quote(cat, pickup, ret, coverageType);
    res.json({ category: { id: cat.id, name: cat.name, example: cat.example }, quote: q });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/bookings  (multipart: license + insurance[] files, JSON fields in body)
router.post(
  '/bookings',
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'insurance', maxCount: 2 },
  ]),
  async (req, res) => {
    try {
      const {
        categoryId, pickup, return: ret, coverageType,
        customerName, address, cellPhone, email,
        paymentToken, cardExp,
      } = req.body;

      const cat = catById.get(categoryId);
      if (!cat) return res.status(404).json({ error: 'Category not found' });

      // Re-check availability at submit time (prevents race with admin blocks)
      const blocks = blocksFor.all(cat.id);
      if (!isCategoryAvailable(blocks, pickup, ret))
        return res.status(409).json({ error: 'This category just became unavailable for those dates' });

      const cov = INSURANCE[coverageType];
      if (!cov) return res.status(400).json({ error: 'Invalid coverage type' });

      // Enforce insurance photo rule server-side
      const insFiles = (req.files?.insurance || []);
      if (insFiles.length < cov.photosRequired)
        return res.status(400).json({
          error: `${cov.label} requires ${cov.photosRequired} insurance photo(s); received ${insFiles.length}`,
        });
      if (!req.files?.license?.length)
        return res.status(400).json({ error: 'Driver\u2019s license upload is required' });

      const q = quote(cat, pickup, ret, coverageType);

      // Charge the FIXED deposit now
      const reference = 'PCR-' + nanoid(8).replace(/-/g, '0').toUpperCase();
      const pay = await chargeDeposit({
        amount: q.deposit,
        token: paymentToken,
        exp: cardExp,
        name: customerName,
        reference,
      });

      if (!pay.ok) {
        return res.status(402).json({ error: 'Deposit payment failed: ' + pay.error });
      }

      const id = nanoid(12);
      db.prepare(`
        INSERT INTO bookings (
          id, reference, category_id, category_name, pickup_at, return_at, days,
          customer_name, address, cell_phone, email,
          coverage_type, insurance_daily, daily_rate,
          rental_subtotal, insurance_subtotal, deposit, due_at_pickup,
          license_file, insurance_files,
          payment_status, payment_ref, payment_mode, status
        ) VALUES (
          @id, @reference, @category_id, @category_name, @pickup_at, @return_at, @days,
          @customer_name, @address, @cell_phone, @email,
          @coverage_type, @insurance_daily, @daily_rate,
          @rental_subtotal, @insurance_subtotal, @deposit, @due_at_pickup,
          @license_file, @insurance_files,
          'paid', @payment_ref, @payment_mode, 'pending'
        )
      `).run({
        id, reference,
        category_id: cat.id, category_name: cat.name,
        pickup_at: pickup, return_at: ret, days: q.days,
        customer_name: customerName, address, cell_phone: cellPhone, email,
        coverage_type: coverageType, insurance_daily: q.insuranceDaily, daily_rate: cat.daily_rate,
        rental_subtotal: q.rentalSubtotal, insurance_subtotal: q.insuranceSubtotal,
        deposit: q.deposit, due_at_pickup: q.dueAtPickup,
        license_file: req.files.license[0].filename,
        insurance_files: JSON.stringify(insFiles.map((f) => f.filename)),
        payment_ref: pay.ref, payment_mode: pay.mode,
      });

      // Text the business
      await notifyBusiness(
        `New paid booking ${reference} — ${cat.name}, ` +
        `${pickup.slice(0, 10)} to ${ret.slice(0, 10)}, ${customerName}. ` +
        `Deposit $${q.deposit} paid. Review & approve in admin.`
      );

      res.json({
        ok: true,
        reference,
        deposit: q.deposit,
        dueAtPickup: q.dueAtPickup,
        message:
          'Thank you! We will contact you within one hour during business hours to approve your reservation. ' +
          'A valid driver\u2019s license and a debit/credit card showing your name are required at pickup.',
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Booking failed' });
    }
  }
);

// meta for frontend
router.get('/meta', (req, res) => {
  res.json({ paymentMode });
});

export default router;

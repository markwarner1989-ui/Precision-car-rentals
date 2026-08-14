import { useEffect, useMemo, useState } from 'react';
import { api, money } from '../lib/api.js';

const STEPS = ['Dates', 'Vehicle', 'Coverage', 'Details', 'Payment'];

// tomorrow / +3 days defaults
function isoLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const now = new Date();
const defPickup = new Date(now.getTime() + 864e5); defPickup.setHours(10, 0, 0, 0);
const defReturn = new Date(now.getTime() + 864e5 * 4); defReturn.setHours(10, 0, 0, 0);

export default function Booking({ paymentMode }) {
  const [step, setStep] = useState(0);
  const [pickup, setPickup] = useState(isoLocal(defPickup));
  const [ret, setRet] = useState(isoLocal(defReturn));
  const [cats, setCats] = useState([]);
  const [insurance, setInsurance] = useState(null);
  const [catId, setCatId] = useState(null);
  const [coverage, setCoverage] = useState('full');
  const [quote, setQuote] = useState(null);
  const [form, setForm] = useState({ customerName: '', address: '', cellPhone: '', email: '' });
  const [license, setLicense] = useState(null);
  const [insFiles, setInsFiles] = useState([]);
  const [cardToken, setCardToken] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const selectedCat = useMemo(() => cats.find((c) => c.id === catId), [cats, catId]);
  const photosRequired = insurance ? insurance[coverage]?.photosRequired : 1;

  // load categories when dates change
  useEffect(() => {
    setError('');
    api.categories(pickup.slice(0, 10), ret.slice(0, 10))
      .then((d) => { setCats(d.categories); setInsurance(d.insurance); })
      .catch((e) => setError(e.message));
  }, [pickup, ret]);

  // recompute quote when inputs settle
  useEffect(() => {
    if (!catId) return;
    api.quote({ categoryId: catId, pickup, return: ret, coverageType: coverage })
      .then((d) => setQuote(d.quote))
      .catch((e) => { setQuote(null); setError(e.message); });
  }, [catId, coverage, pickup, ret]);

  const canNext = () => {
    if (step === 0) return new Date(ret) > new Date(pickup);
    if (step === 1) return !!selectedCat && selectedCat.available;
    if (step === 2) return !!quote;
    if (step === 3)
      return form.customerName && form.address && form.cellPhone && form.email &&
        license && insFiles.length >= photosRequired;
    return true;
  };

  async function submit() {
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      fd.append('categoryId', catId);
      fd.append('pickup', pickup);
      fd.append('return', ret);
      fd.append('coverageType', coverage);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('paymentToken', cardToken || 'tok_ifields_mock');
      fd.append('cardExp', cardExp);
      fd.append('license', license);
      insFiles.forEach((f) => fd.append('insurance', f));
      const res = await api.createBooking(fd);
      setConfirmation(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) return <Confirmation data={confirmation} />;

  return (
    <>
      {paymentMode === 'mock' && (
        <div className="mode-banner">
          DEMO MODE — no real card is charged. Use card number 4111 1111 1111 1111 (or type “decline” to test a failure).
        </div>
      )}
      <Nav />
      <Hero />
      <div className="container" style={{ paddingBottom: 40 }}>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s} className={`step-pill ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <b>{i < step ? '✓' : i + 1}</b>{s}
            </li>
          ))}
        </ol>

        {error && <div className="note note-error">{error}</div>}

        <div className="split">
          <div className="panel panel-pad">
            {step === 0 && <DatesStep {...{ pickup, setPickup, ret, setRet }} />}
            {step === 1 && <VehicleStep {...{ cats, catId, setCatId }} />}
            {step === 2 && <CoverageStep {...{ insurance, coverage, setCoverage, quote }} />}
            {step === 3 && (
              <DetailsStep
                {...{ form, setForm, license, setLicense, insFiles, setInsFiles, photosRequired, coverage, insurance }}
              />
            )}
            {step === 4 && (
              <PaymentStep
                {...{ quote, selectedCat, cardToken, setCardToken, cardExp, setCardExp, paymentMode }}
              />
            )}

            <div className="row-between">
              {step > 0 ? (
                <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>
              ) : <span />}
              {step < 4 ? (
                <button className="btn btn-primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>
                  Continue →
                </button>
              ) : (
                <button className="btn btn-teal" disabled={submitting} onClick={submit}>
                  {submitting ? <><span className="spinner" /> Processing…</> : `Pay deposit ${quote ? money(quote.deposit) : ''}`}
                </button>
              )}
            </div>
          </div>

          <aside className="summary">
            <SummaryCard {...{ selectedCat, quote, pickup, ret, coverage, insurance }} />
          </aside>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

/* ── steps ── */
function DatesStep({ pickup, setPickup, ret, setRet }) {
  return (
    <div>
      <h2 className="section-title">When do you need it?</h2>
      <p className="section-sub">Pick your dates and times. We’ll show which vehicle classes are available.</p>
      <div className="grid-2">
        <div className="field">
          <label>Pickup date & time</label>
          <input className="input" type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} />
        </div>
        <div className="field">
          <label>Return date & time</label>
          <input className="input" type="datetime-local" value={ret} onChange={(e) => setRet(e.target.value)} />
        </div>
      </div>
      {new Date(ret) <= new Date(pickup) && (
        <div className="note note-warn">Return must be after pickup.</div>
      )}
    </div>
  );
}

function VehicleStep({ cats, catId, setCatId }) {
  return (
    <div>
      <h2 className="section-title">Choose a vehicle class</h2>
      <p className="section-sub">
        You’re booking a category, not a specific car — we’ll assign the best available vehicle in your class at approval,
        just like Enterprise or Hertz.
      </p>
      <div className="cat-grid">
        {cats.map((c) => (
          <button
            key={c.id}
            className={`cat ${catId === c.id ? 'selected' : ''} ${!c.available ? 'blocked' : ''}`}
            disabled={!c.available}
            onClick={() => setCatId(c.id)}
          >
            {!c.available && <span className="blocked-tag">Unavailable</span>}
            <img className="cat-img" src={c.image_url} alt={c.name}
                 onError={(e) => { e.target.style.background = '#c9d6d3'; e.target.src =
                   `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250'><rect fill='%23c9d6d3' width='400' height='250'/><text x='50%25' y='50%25' font-family='sans-serif' font-size='20' fill='%230d3b40' text-anchor='middle' dominant-baseline='middle'>${c.name}</text></svg>`; }} />
            <div className="cat-body">
              <div className="cat-name">{c.name}</div>
              <div className="cat-eg">{c.example}</div>
              <div className="cat-meta">
                <div className="cat-rate"><b>{money(c.daily_rate)}</b><span> /day</span></div>
                <div className="cat-dep">deposit<b>{money(c.deposit)}</b></div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverageStep({ insurance, coverage, setCoverage, quote }) {
  if (!insurance) return null;
  return (
    <div>
      <h2 className="section-title">Insurance coverage</h2>
      <p className="section-sub">
        Your deposit is fixed by vehicle class. Coverage sets your rental’s insurance cost and how many insurance
        photos we’ll need.
      </p>
      <div className="coverage">
        {Object.entries(insurance).map(([key, v]) => (
          <button key={key} className={`cov ${coverage === key ? 'selected' : ''}`} onClick={() => setCoverage(key)}>
            <h4>{v.label}</h4>
            <p>{v.photosRequired} insurance photo{v.photosRequired > 1 ? 's' : ''} required at booking.</p>
            <div className="price">{money(v.daily)} / day</div>
          </button>
        ))}
      </div>
      {quote && (
        <div className="note note-info" style={{ marginTop: 18 }}>
          For {quote.days} day{quote.days > 1 ? 's' : ''}: insurance {money(quote.insuranceSubtotal)} + rental {money(quote.rentalSubtotal)}.
          Deposit due now stays {money(quote.deposit)}.
        </div>
      )}
    </div>
  );
}

function Uploader({ label, hint, onFiles, multiple, files }) {
  return (
    <label className={`uploader ${files.length ? 'filled' : ''}`}>
      <input type="file" accept="image/*,application/pdf" multiple={multiple}
             style={{ display: 'none' }}
             onChange={(e) => onFiles(Array.from(e.target.files))} />
      {files.length ? (
        <span className="file-tag">✓ {files.map((f) => f.name).join(', ')}</span>
      ) : (
        <><strong>{label}</strong><small>{hint}</small></>
      )}
    </label>
  );
}

function DetailsStep({ form, setForm, license, setLicense, insFiles, setInsFiles, photosRequired, coverage, insurance }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div>
      <h2 className="section-title">Your details & documents</h2>
      <p className="section-sub">We verify these before approval. A license and a card in your own name are required at pickup.</p>
      <div className="grid-2">
        <div className="field"><label>Full name</label><input className="input" value={form.customerName} onChange={set('customerName')} placeholder="Jordan Ellis" /></div>
        <div className="field"><label>Cell phone</label><input className="input" value={form.cellPhone} onChange={set('cellPhone')} placeholder="(704) 555-0100" /></div>
      </div>
      <div className="field"><label>Address</label><input className="input" value={form.address} onChange={set('address')} placeholder="Street, City, State ZIP" /></div>
      <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" /></div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Driver’s license <span className="hint">(1 photo)</span></label>
        <Uploader label="Upload your license" hint="Front of your driver’s license — image or PDF"
                  files={license ? [license] : []} onFiles={(f) => setLicense(f[0] || null)} />
      </div>

      <div className="field">
        <label>
          Insurance — {insurance?.[coverage]?.label}{' '}
          <span className="hint">({photosRequired} photo{photosRequired > 1 ? 's' : ''} required)</span>
        </label>
        <Uploader
          label={`Upload ${photosRequired} insurance photo${photosRequired > 1 ? 's' : ''}`}
          hint={coverage === 'full' ? 'Insurance card + declaration/payment page' : 'Insurance card'}
          multiple files={insFiles} onFiles={setInsFiles} />
        {insFiles.length > 0 && insFiles.length < photosRequired && (
          <div className="note note-warn" style={{ marginTop: 10 }}>
            {photosRequired - insFiles.length} more photo needed for {insurance?.[coverage]?.label}.
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentStep({ quote, selectedCat, cardToken, setCardToken, cardExp, setCardExp, paymentMode }) {
  return (
    <div>
      <h2 className="section-title">Pay your deposit</h2>
      <p className="section-sub">
        You’re paying the fixed <strong>{selectedCat?.name}</strong> deposit now. The rental + insurance balance is due at pickup.
      </p>

      {paymentMode === 'mock' ? (
        <div className="note note-info">
          Demo checkout — in production this is a secure Cardknox / Sola iFields form so card data never touches the server.
        </div>
      ) : (
        <div className="note note-info">Secure payment powered by Cardknox / Sola. Your card details are encrypted end-to-end.</div>
      )}

      <div className="field">
        <label>Card number</label>
        <input className="input" placeholder="4111 1111 1111 1111"
               value={cardToken} onChange={(e) => setCardToken(e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field"><label>Expiry (MMYY)</label><input className="input" placeholder="1228" value={cardExp} onChange={(e) => setCardExp(e.target.value)} /></div>
        <div className="field"><label>Amount due now</label><input className="input" disabled value={quote ? money(quote.deposit) : ''} /></div>
      </div>
      <div className="note note-warn">
        By paying, you agree we’ll contact you within one hour <strong>during business hours</strong> to approve your reservation.
      </div>
    </div>
  );
}

function SummaryCard({ selectedCat, quote, pickup, ret, coverage, insurance }) {
  return (
    <div className="panel panel-pad">
      <h3 className="section-title" style={{ fontSize: 20 }}>Your booking</h3>
      {!selectedCat ? (
        <p className="section-sub" style={{ marginBottom: 0 }}>Select a vehicle class to see pricing.</p>
      ) : (
        <>
          <div className="sum-pickup"><span>Class</span><strong style={{ color: 'var(--ink)' }}>{selectedCat.name}</strong></div>
          <div className="sum-pickup"><span>{selectedCat.example}</span></div>
          <div className="sum-pickup"><span>Pickup</span><span>{pickup.replace('T', ' ')}</span></div>
          <div className="sum-pickup"><span>Return</span><span>{ret.replace('T', ' ')}</span></div>
          {quote && (
            <div style={{ marginTop: 14 }}>
              <div className="sum-row"><span>Rental · {quote.days}d × {money(quote.dailyRate)}</span><span>{money(quote.rentalSubtotal)}</span></div>
              <div className="sum-row"><span>{insurance?.[coverage]?.label} · {quote.days}d</span><span>{money(quote.insuranceSubtotal)}</span></div>
              <div className="sum-row total"><span>Due at pickup</span><strong>{money(quote.dueAtPickup)}</strong></div>
              <div className="sum-due-now">
                <div className="lbl">Due now — deposit</div>
                <div className="amt">{money(quote.deposit)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Confirmation({ data }) {
  return (
    <>
      <Nav />
      <div className="container" style={{ padding: '30px 0 60px' }}>
        <div className="panel confirm">
          <div className="check">✓</div>
          <h2>Deposit received</h2>
          <div className="ref-chip">Confirmation {data.reference}</div>
          <p className="msg">{data.message}</p>
          <div className="sum-pickup" style={{ justifyContent: 'center', gap: 30, marginTop: 20 }}>
            <span>Paid now: <strong style={{ color: 'var(--teal)' }}>{money(data.deposit)}</strong></span>
            <span>Due at pickup: <strong style={{ color: 'var(--ink)' }}>{money(data.dueAtPickup)}</strong></span>
          </div>
          <a href="/" className="btn btn-ghost" style={{ marginTop: 26 }}>Make another booking</a>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

/* ── shared chrome ── */
function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a className="brand" href="/">
          <div className="brand-mark">P</div>
          <div className="brand-name">Precision Car Rentals<span>Gastonia · Charlotte</span></div>
        </a>
        <a className="nav-phone" href="tel:+17046481760">(704) 648-1760</a>
      </div>
    </nav>
  );
}
function Hero() {
  return (
    <header className="hero">
      <div className="container">
        <span className="hero-eyebrow">● Book online · Instant deposit</span>
        <h1>Reserve your class. <em>Drive away</em> without the hassle.</h1>
        <p>Pick your dates, choose a vehicle class, upload your documents, and secure your reservation with a deposit. We confirm within the hour during business hours.</p>
      </div>
    </header>
  );
}
function SiteFooter() {
  return (
    <footer className="site">
      <div className="container">
        Precision Car Rentals · Gastonia & Charlotte, NC · (704) 648-1760 — A valid driver’s license and a debit/credit card showing your name are required at pickup.
      </div>
    </footer>
  );
}

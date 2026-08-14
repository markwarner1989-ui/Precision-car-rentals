import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Booking from './pages/Booking.jsx';
import Admin from './pages/Admin.jsx';
import { api } from './lib/api.js';

export default function App() {
  const [paymentMode, setPaymentMode] = useState('mock');
  useEffect(() => { api.meta().then((d) => setPaymentMode(d.paymentMode)).catch(() => {}); }, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Booking paymentMode={paymentMode} />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

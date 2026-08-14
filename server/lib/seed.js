import db from './db.js';
import { nanoid } from 'nanoid';

// Wipe & reseed categories (safe: does not touch bookings)
db.prepare('DELETE FROM categories').run();

const categories = [
  {
    name: 'Economical',
    example: 'Nissan Versa, Kia Rio or similar',
    description: 'Fuel-efficient and budget-friendly. Great for daily driving and errands.',
    image_url: '/images/economical.svg',
    daily_rate: 39,
    deposit: 150,
    sort_order: 1,
  },
  {
    name: 'Sedan',
    example: 'Toyota Camry, Honda Accord or similar',
    description: 'Comfortable mid-size sedans with room for the whole family.',
    image_url: '/images/sedan.svg',
    daily_rate: 55,
    deposit: 200,
    sort_order: 2,
  },
  {
    name: 'SUV',
    example: 'Chevrolet Tahoe or similar',
    description: 'Full-size SUVs with space for passengers, luggage and road trips.',
    image_url: '/images/suv.svg',
    daily_rate: 89,
    deposit: 300,
    sort_order: 3,
  },
  {
    name: 'Performance',
    example: 'Dodge Charger, Challenger or similar',
    description: 'Bold styling and power for when you want to make a statement.',
    image_url: '/images/performance.svg',
    daily_rate: 99,
    deposit: 400,
    sort_order: 4,
  },
  {
    name: 'Luxury',
    example: 'BMW 5 Series, Mercedes E-Class or similar',
    description: 'Premium comfort and refinement for business or special occasions.',
    image_url: '/images/luxury.svg',
    daily_rate: 129,
    deposit: 500,
    sort_order: 5,
  },
];

const insert = db.prepare(`
  INSERT INTO categories (id, name, example, description, image_url, daily_rate, deposit, sort_order, active)
  VALUES (@id, @name, @example, @description, @image_url, @daily_rate, @deposit, @sort_order, 1)
`);

for (const c of categories) insert.run({ id: nanoid(10), ...c });

console.log(`Seeded ${categories.length} categories.`);

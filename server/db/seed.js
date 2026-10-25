/**
 * Foodeez — seed data.
 *
 * The catalogue here is the restaurant's real one (names, prices, descriptions
 * and photography), carried over from the original build. Order history is
 * generated so the admin dashboard has something to show on first run; it can
 * be wiped at any time with `npm run db:clear-orders`.
 */

import bcrypt from 'bcryptjs'
import { setSetting, backfillItemImages } from './schema.js'

export const CATEGORIES = [
  { id: 'deals',   name: 'Deals',                ur: 'ڈیلز',    sort: 1 },
  { id: 'burgers', name: 'Burgers',              ur: 'برگر',    sort: 2 },
  { id: 'broast',  name: 'Broast & Fried',       ur: 'بروسٹ',   sort: 3 },
  { id: 'pizza',   name: 'Pizza',                ur: 'پیزا',    sort: 4 },
  { id: 'bbq',     name: 'BBQ',                  ur: 'باربی کیو', sort: 5 },
  { id: 'desi',    name: 'Desi Handi & Karahi',  ur: 'دیسی',    sort: 6 },
  { id: 'chinese', name: 'Chinese',              ur: 'چائنیز',  sort: 7 },
  { id: 'rolls',   name: 'Rolls & Wraps',        ur: 'رولز',    sort: 8 },
  { id: 'sides',   name: 'Sides',                ur: 'سائیڈز',  sort: 9 },
  { id: 'drinks',  name: 'Shakes & Drinks',      ur: 'مشروبات', sort: 10 },
]

const SIZE = (s, m, l) => ({ group: 'Size', required: true, choices: [
  { n: 'Small 7"', p: s }, { n: 'Medium 10"', p: m }, { n: 'Large 13"', p: l },
] })
const PORTION = (h, f) => ({ group: 'Portion', required: true, choices: [
  { n: 'Half', p: h }, { n: 'Full', p: f },
] })
const BURGER_ADD = { group: 'Extras', required: false, multi: true, choices: [
  { n: 'Extra cheese slice', p: 80 }, { n: 'Jalapeños', p: 50 }, { n: 'Make it a meal (fries + drink)', p: 290 },
] }

export const MENU = [
  // Deals
  { id: 'd1', cat: 'deals', name: 'Family Feast for 3', descr: 'Half chicken karahi, 1 medium pizza, 2 zinger burgers, 6 naan, 1.5L drink.', price: 2990, was: 3650, img: 'karahi2.jpg', tags: ['Best seller'], serves: 3, featured: 1, prep_mins: 30 },
  { id: 'd2', cat: 'deals', name: 'Zinger Squad', descr: '4 zinger burgers, 2 regular fries, 1L drink. Built for the hostel crowd.', price: 1999, was: 2380, img: 'burgerfries.jpg', tags: ['Value'], serves: 4, featured: 1, prep_mins: 25 },
  { id: 'd3', cat: 'deals', name: 'BBQ Night Platter', descr: 'Chicken tikka (2), reshmi kabab (4), malai boti, 4 naan, raita, salad.', price: 2650, was: 3100, img: 'bbq.jpg', tags: ['Weekend'], serves: 3, prep_mins: 35 },
  { id: 'd4', cat: 'deals', name: 'Chinese Combo', descr: 'Chicken fried rice + chicken manchurian + 1L drink.', price: 1650, was: 1890, img: 'manchurian.jpg', tags: [], serves: 2, prep_mins: 25 },

  // Burgers
  { id: 'b1', cat: 'burgers', name: 'Classic Zinger', descr: 'Hand-breaded crispy fillet, iceberg, house mayo, toasted sesame bun.', price: 520, img: 'burger.jpg', tags: ['Best seller'], opts: [BURGER_ADD], featured: 1, prep_mins: 12 },
  { id: 'b2', cat: 'burgers', name: 'Mighty Zinger', descr: 'Double fillet, double cheese, jalapeños and our smoky Foodeez sauce.', price: 790, img: 'burgerfries.jpg', tags: ['Spicy'], opts: [BURGER_ADD], spice: 2, prep_mins: 15 },
  { id: 'b3', cat: 'burgers', name: 'Tower Burger', descr: 'Zinger fillet stacked with hash brown, cheese and spicy mayo.', price: 850, img: 'burger.jpg', tags: ['New'], opts: [BURGER_ADD], prep_mins: 15 },
  { id: 'b4', cat: 'burgers', name: 'Grilled Tikka Burger', descr: 'Char-grilled tikka chicken, mint mayo, onions. Lighter, smokier.', price: 560, img: 'tikka.jpg', tags: [], opts: [BURGER_ADD], prep_mins: 14 },

  // Broast
  { id: 'f1', cat: 'broast', name: 'Chicken Broast — Quarter', descr: 'Pressure-fried, juicy inside, crackling outside. Served with fries, bun & garlic sauce.', price: 650, img: 'broast.jpg', tags: ['Best seller'], featured: 1, prep_mins: 18 },
  { id: 'f2', cat: 'broast', name: 'Chicken Broast — Half', descr: '4 pieces with fries, 2 buns, coleslaw and garlic sauce.', price: 1150, img: 'broast.jpg', tags: [], prep_mins: 22 },
  { id: 'f3', cat: 'broast', name: 'Hot Wings (10 pcs)', descr: 'Tossed in our fiery red glaze. Dip included.', price: 690, img: 'popcorn.jpg', tags: ['Spicy'], spice: 3, prep_mins: 18 },
  { id: 'f4', cat: 'broast', name: 'Popcorn Chicken', descr: 'Bite-size crunchy chicken with spicy dip.', price: 480, img: 'popcorn.jpg', tags: [], prep_mins: 15 },

  // Pizza
  { id: 'p1', cat: 'pizza', name: 'Chicken Tikka Pizza', descr: 'Tikka chunks, onions, green chilli, mozzarella on house tomato sauce.', price: 650, img: 'pizza.jpg', tags: ['Best seller'], opts: [SIZE(650, 1150, 1650)], featured: 1, prep_mins: 20 },
  { id: 'p2', cat: 'pizza', name: 'Fajita Pizza', descr: 'Fajita chicken, capsicum, onion, olives and loads of cheese.', price: 650, img: 'pizza2.jpg', tags: [], opts: [SIZE(650, 1150, 1650)], prep_mins: 20 },
  { id: 'p3', cat: 'pizza', name: 'Foodeez Special', descr: 'Everything good: tikka, fajita, kabab, mushrooms, olives, double cheese.', price: 790, img: 'pizza.jpg', tags: ['Signature'], opts: [SIZE(790, 1350, 1950)], featured: 1, prep_mins: 22 },
  { id: 'p4', cat: 'pizza', name: 'Cheese Lover', descr: 'Mozzarella, cheddar, oregano. Simple and stretchy.', price: 590, img: 'pizza2.jpg', tags: [], opts: [SIZE(590, 1050, 1490)], veg: 1, prep_mins: 18 },

  // BBQ
  { id: 'q1', cat: 'bbq', name: 'Chicken Tikka (Leg/Chest)', descr: 'Marinated overnight, charcoal-grilled, served with chutney.', price: 420, img: 'tikka.jpg', tags: ['Best seller'], featured: 1, prep_mins: 20 },
  { id: 'q2', cat: 'bbq', name: 'Reshmi Kabab (4 pcs)', descr: 'Silky minced chicken kabab with cream and mild spice.', price: 690, img: 'reshmi.jpg', tags: [], prep_mins: 20 },
  { id: 'q3', cat: 'bbq', name: 'Tikka Boti (10 pcs)', descr: 'Boneless spicy boti off the seekh.', price: 750, img: 'bbq.jpg', tags: ['Spicy'], spice: 2, prep_mins: 22 },
  { id: 'q4', cat: 'bbq', name: 'Malai Boti (10 pcs)', descr: 'Creamy, cardamom-scented boneless boti.', price: 790, img: 'reshmi.jpg', tags: [], prep_mins: 22 },
  { id: 'q5', cat: 'bbq', name: 'BBQ Paratha', descr: 'Flaky paratha stuffed with tikka boti and chutney.', price: 450, img: 'paratharoll.jpg', tags: [], prep_mins: 15 },

  // Desi
  { id: 'k1', cat: 'desi', name: 'Chicken Karahi', descr: 'Tomato, ginger and green chilli karahi finished on high flame.', price: 1350, img: 'karahi.jpg', tags: ['Best seller'], opts: [PORTION(1350, 2450)], featured: 1, prep_mins: 30 },
  { id: 'k2', cat: 'desi', name: 'Chicken White Karahi', descr: 'Yogurt, cream and black pepper. Mild and rich.', price: 1450, img: 'karahi2.jpg', tags: [], opts: [PORTION(1450, 2650)], prep_mins: 30 },
  { id: 'k3', cat: 'desi', name: 'Chicken Handi (Boneless)', descr: 'Slow-cooked boneless chicken in a creamy masala handi.', price: 1250, img: 'karahi2.jpg', tags: [], opts: [PORTION(1250, 2290)], prep_mins: 28 },
  { id: 'k4', cat: 'desi', name: 'Chicken Biryani', descr: 'Fragrant sella rice layered with spiced chicken. Raita & salad.', price: 450, img: 'biryani.jpg', tags: [], prep_mins: 10 },

  // Chinese
  { id: 'c1', cat: 'chinese', name: 'Chicken Fried Rice', descr: 'Wok-tossed egg fried rice with chicken and vegetables.', price: 690, img: 'friedrice.jpg', tags: [], prep_mins: 18 },
  { id: 'c2', cat: 'chinese', name: 'Chicken Manchurian', descr: 'Crispy chicken in sweet-hot-tangy manchurian gravy.', price: 850, img: 'manchurian.jpg', tags: ['Best seller'], featured: 1, prep_mins: 20 },
  { id: 'c3', cat: 'chinese', name: 'Chicken Chow Mein', descr: 'Stir-fried noodles with chicken, cabbage and soy.', price: 750, img: 'chowmein.jpg', tags: [], prep_mins: 18 },
  { id: 'c4', cat: 'chinese', name: 'Chicken Chilli Dry', descr: 'Capsicum, onion and green chilli, dry-tossed.', price: 890, img: 'manchurian.jpg', tags: ['Spicy'], spice: 3, prep_mins: 20 },

  // Rolls
  { id: 'r1', cat: 'rolls', name: 'Chicken Paratha Roll', descr: 'Tikka chicken, onion, chutney and garlic mayo in a crisp paratha.', price: 390, img: 'paratharoll.jpg', tags: ['Best seller'], prep_mins: 12 },
  { id: 'r2', cat: 'rolls', name: 'Zinger Paratha Roll', descr: 'Crispy zinger strips with spicy mayo in paratha.', price: 450, img: 'paratharoll.jpg', tags: [], prep_mins: 12 },
  { id: 'r3', cat: 'rolls', name: 'Reshmi Kabab Roll', descr: 'Two reshmi kababs, onion, mint chutney.', price: 420, img: 'reshmi.jpg', tags: [], prep_mins: 12 },

  // Sides
  { id: 's1', cat: 'sides', name: 'Masala Fries', descr: 'Crispy fries dusted with Foodeez masala.', price: 290, img: 'fries.jpg', tags: [], veg: 1, prep_mins: 10 },
  { id: 's2', cat: 'sides', name: 'Loaded Fries', descr: 'Fries, cheese sauce, jalapeños, tikka chunks.', price: 590, img: 'fries.jpg', tags: ['New'], prep_mins: 14 },
  { id: 's3', cat: 'sides', name: 'Naan / Roghni Naan', descr: 'Fresh from the tandoor.', price: 40, img: 'karahi2.jpg', tags: [], veg: 1, opts: [{ group: 'Type', required: true, choices: [
    { n: 'Plain naan', p: 40 }, { n: 'Roghni naan', p: 70 }, { n: 'Garlic naan', p: 90 },
  ] }], prep_mins: 5 },

  // Drinks
  { id: 'w1', cat: 'drinks', name: 'Oreo Shake', descr: 'Thick vanilla shake blended with Oreo.', price: 450, img: 'shake.jpg', tags: [], veg: 1, prep_mins: 8 },
  { id: 'w2', cat: 'drinks', name: 'Chocolate Shake', descr: 'Belgian-style chocolate, whipped cream.', price: 420, img: 'shake.jpg', tags: [], veg: 1, prep_mins: 8 },
  { id: 'w3', cat: 'drinks', name: 'Soft Drink', descr: 'Chilled. 345ml / 1L / 1.5L.', price: 100, img: 'shake.jpg', tags: [], veg: 1, opts: [{ group: 'Size', required: true, choices: [
    { n: '345ml', p: 100 }, { n: '1 Litre', p: 200 }, { n: '1.5 Litre', p: 260 },
  ] }], prep_mins: 1 },
]

export const DEFAULT_SETTINGS = {
  name: 'Foodeez',
  tagline: 'Taste the joy',
  address: 'New College Road, Taunsa Sharif, Punjab',
  phone1: '0333 2402964',
  phone2: '0340 1710990',
  email: 'hello@foodeez.pk',
  hours: '12:00 PM – 1:00 AM',
  open: true,
  deliveryFee: 100,
  freeDeliveryOver: 2500,
  minOrder: 500,
  eta: 35,
  radiusKm: 6,
  taxPct: 0,
  acceptingOrders: true,
  announcements: [
    { id: 'a1', text: 'Free delivery on orders over Rs 2,500 — all of Taunsa city.', active: true },
    { id: 'a2', text: 'Family hall open for bookings. Call 0340 1710990.', active: true },
  ],
}

const RIDERS = [
  { id: 'R1', name: 'Shahid', phone: '0300 1112233', bike: 'DGK-4471', active: 1, on_shift: 1 },
  { id: 'R2', name: 'Naveed', phone: '0301 4455667', bike: 'DGK-2290', active: 1, on_shift: 1 },
  { id: 'R3', name: 'Kashif', phone: '0345 9988776', bike: 'DGK-8813', active: 0, on_shift: 0 },
]

const PROMOS = [
  { code: 'JOY10',  type: 'pct',  value: 10, min: 1000, active: 1, cap: null },
  { code: 'FIRST150', type: 'flat', value: 150, min: 800, active: 1, cap: null },
  { code: 'FAMILY500', type: 'flat', value: 500, min: 3000, active: 1, cap: null },
]

const AREAS = ['New College Road', 'Ghulam Haider Chowk', 'Daira Deen Panah Road', 'Mangrotha Road', 'Kot Qaisrani Road', 'Model Town', 'Basti Rindan', 'Shah Sulaiman Colony', 'Railway Road', 'Vehova Road']

/* deterministic PRNG so the demo history looks the same on every machine */
function rnd(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

export function seed(db, { historyDays = 7 } = {}) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n
  if (count > 0) return { seeded: false }

  const t = Date.now()

  db.exec('BEGIN')
  try {
    for (const c of CATEGORIES) {
      db.prepare('INSERT INTO categories(id,name,ur,sort) VALUES(?,?,?,?)').run(c.id, c.name, c.ur, c.sort)
    }

    const insItem = db.prepare(`INSERT INTO menu_items
      (id,cat,name,descr,price,was,img,tags,serves,available,featured,spice,veg,prep_mins,sort,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    const insGroup = db.prepare('INSERT INTO option_groups(item_id,label,required,multi,sort) VALUES(?,?,?,?,?)')
    const insChoice = db.prepare('INSERT INTO option_choices(group_id,label,delta,sort) VALUES(?,?,?,?)')

    MENU.forEach((m, i) => {
      insItem.run(
        m.id, m.cat, m.name, m.descr || '', m.price, m.was ?? null,
        `assets/food/${m.img}`, JSON.stringify(m.tags || []),
        m.serves ?? null, m.available === 0 ? 0 : 1, m.featured ? 1 : 0,
        m.spice || 0, m.veg ? 1 : 0, m.prep_mins || 15, i, t,
      )
      ;(m.opts || []).forEach((g, gi) => {
        const r = insGroup.run(m.id, g.group, g.required ? 1 : 0, g.multi ? 1 : 0, gi)
        const gid = Number(r.lastInsertRowid)
        g.choices.forEach((c, ci) => insChoice.run(gid, c.n, c.p, ci))
      })
    })

    for (const r of RIDERS) {
      db.prepare('INSERT INTO riders(id,name,phone,bike,active,on_shift) VALUES(?,?,?,?,?,?)')
        .run(r.id, r.name, r.phone, r.bike, r.active, r.on_shift)
    }

    for (const p of PROMOS) {
      db.prepare('INSERT INTO promos(id,code,type,value,min,active,uses,cap,created_at) VALUES(?,?,?,?,?,?,0,?,?)')
        .run('pr_' + p.code.toLowerCase(), p.code, p.type, p.value, p.min, p.active, p.cap, t)
    }

    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(db, k, v)

    db.prepare("INSERT INTO counters(k,v) VALUES('order',1040)").run()

    // Owner account — credentials come from env on first boot.
    const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@foodeez.pk'
    const ownerPass  = process.env.SEED_OWNER_PASS  || 'ChangeMe!foodeez1'
    db.prepare('INSERT INTO users(id,name,email,pass_hash,role,active,created_at) VALUES(?,?,?,?,?,1,?)')
      .run('u_owner', 'Owner', ownerEmail, hashSeed(ownerPass), 'owner', t)

    seedReviews(db)
    if (historyDays > 0) seedHistory(db, historyDays)

    // Give every dish a gallery row for its cover photo so the admin editor
    // starts from a consistent state instead of an empty list.
    backfillItemImages(db)

    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { seeded: true }
}

function hashSeed(pass) {
  return bcrypt.hashSync(pass, 10)
}

function seedHistory(db, days) {
  const r = rnd(42)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const items = db.prepare('SELECT id,name,img,price FROM menu_items').all()
  const now = Date.now()
  let n = 1040

  const insOrder = db.prepare(`INSERT INTO orders
    (id,customer_id,rider_id,type,status,subtotal,delivery_fee,discount,total,promo_code,
     pay_method,pay_status,note,cancel_reason,rating,channel,created_at)
    VALUES(?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insOC = db.prepare('INSERT INTO order_customers(order_id,name,phone,address) VALUES(?,?,?,?)')
  const insOI = db.prepare('INSERT INTO order_items(order_id,item_id,name,img,price,qty,opts,note) VALUES(?,?,?,?,?,?,?,?)')
  const insEv = db.prepare('INSERT INTO order_events(order_id,status,at,actor) VALUES(?,?,?,?)')

  const writeOrder = (o) => {
    insOrder.run(o.id, o.rider, o.type, o.status, o.subtotal, o.fee, 0, o.subtotal + o.fee,
      null, o.pay, o.status === 'delivered' ? 'paid' : 'unpaid', o.note || '', null,
      o.rating ?? null, 'web', o.created_at)
    insOC.run(o.id, o.name, o.phone, o.address || '')
    let sub = 0
    for (const li of o.items) {
      insOI.run(o.id, li.id, li.name, li.img, li.price, li.qty, li.opts || '', '')
      sub += li.price * li.qty
    }
    // correct subtotal after the fact (prices come from the DB, not the generator)
    db.prepare('UPDATE orders SET subtotal=?, total=? WHERE id=?').run(sub, sub + o.fee, o.id)
    for (const e of o.events) insEv.run(o.id, e[0], e[1], e[2] || 'system')
  }

  const NAME_POOL = ['Walk-in', 'Counter order', 'Phone order']

  for (let d = days; d >= 0; d--) {
    const cnt = 8 + Math.floor(r() * 8)
    for (let i = 0; i < cnt; i++) {
      const created = now - d * 86400000 - Math.floor(r() * 10 * 3600000) - 1800000
      if (created > now - 5 * 60000) continue
      const type = r() > 0.28 ? 'delivery' : 'pickup'
      const k = 1 + Math.floor(r() * 3)
      const chosen = []
      for (let j = 0; j < k; j++) {
        const m = pick(items)
        chosen.push({ id: m.id, name: m.name, img: m.img, price: m.price, qty: 1 + Math.floor(r() * 2), opts: '' })
      }
      const fee = type === 'delivery' ? 100 : 0
      const sub = chosen.reduce((s, x) => s + x.price * x.qty, 0)
      n++
      const id = `FZ-${n}`
      const status = r() > 0.05 ? 'delivered' : 'cancelled'
      const events = [['new', created, 'web']]
      if (status === 'delivered') {
        events.push(['preparing', created + 4 * 60000], ['ready', created + 16 * 60000])
        if (type === 'delivery') events.push(['out', created + 22 * 60000])
        events.push(['delivered', created + (type === 'delivery' ? 44 : 28) * 60000])
      } else {
        events.push(['cancelled', created + 6 * 60000])
      }
      writeOrder({
        id, type, status, items: chosen, fee, subtotal: sub,
        name: pick(NAME_POOL), phone: '03' + (10 + Math.floor(r() * 40)) + ' ' + (1000000 + Math.floor(r() * 8999999)),
        address: type === 'delivery' ? `House ${10 + Math.floor(r() * 300)}, ${pick(AREAS)}` : '',
        pay: r() > 0.25 ? 'cod' : pick(['jazzcash', 'easypaisa']),
        rider: type === 'delivery' ? pick(RIDERS).id : null,
        rating: status === 'delivered' && r() > 0.5 ? 4 + Math.round(r()) : null,
        note: '', created_at: created, events,
      })
    }
  }

  /* a handful of orders currently in flight, so the kitchen board is alive */
  const live = [['new', 3], ['new', 1], ['preparing', 9], ['preparing', 14], ['ready', 19], ['out', 26]]
  live.forEach(([st, mins], idx) => {
    const created = now - mins * 60000
    const type = st === 'ready' ? 'pickup' : 'delivery'
    const chosen = [
      { id: 'b1', name: 'Classic Zinger', img: 'assets/food/burger.jpg', price: 520, qty: 2, opts: 'Extra cheese slice' },
      { id: 's1', name: 'Masala Fries', img: 'assets/food/fries.jpg', price: 290, qty: 1, opts: '' },
    ]
    if (idx % 2) chosen.push({ id: 'k1', name: 'Chicken Karahi', img: 'assets/food/karahi.jpg', price: 1350, qty: 1, opts: 'Half' })
    const fee = type === 'delivery' ? 100 : 0
    const sub = chosen.reduce((s, x) => s + x.price * x.qty, 0)
    n++
    const events = [['new', created, 'web']]
    const order = ['new', 'preparing', 'ready', 'out', 'delivered']
    const upto = order.indexOf(st)
    for (let i = 1; i <= upto; i++) events.push([order[i], created + i * 5 * 60000])
    writeOrder({
      id: `FZ-${n}`, type, status: st, items: chosen, fee, subtotal: sub,
      name: 'Phone order', phone: '0333 ' + (1000000 + Math.floor(r() * 8999999)),
      address: type === 'delivery' ? `House ${10 + Math.floor(r() * 300)}, ${pick(AREAS)}` : '',
      pay: 'cod', rider: st === 'out' ? 'R1' : null, rating: null,
      note: st === 'new' ? 'Less spicy please' : '', created_at: created, events,
    })
  })

  db.prepare("UPDATE counters SET v = ? WHERE k = 'order'").run(n + 1)
}

/**
 * A small set of published reviews so the site's reviews section is not empty
 * on first run. The owner can hide or delete any of them from the admin.
 */
function seedReviews(db) {
  const rows = [
    { name: 'Hamza K.', rating: 5, body: 'The karahi is the real thing — finished on the high flame, exactly like home but better. Took 30 minutes to arrive and still steaming.' },
    { name: 'Ayesha N.', rating: 5, body: 'Ordered the family feast for my in-laws. Six naan were still warm. This is the only place in Taunsa I trust for a full table.' },
    { name: 'Bilal A.', rating: 4, body: 'Zinger is genuinely crispy, not that soggy crumb stuff. Only note: the loaded fries could use more cheese sauce.' },
    { name: 'Sana B.', rating: 5, body: 'Booked the family hall for a birthday. Staff set the table early and the BBQ platter was more than enough for eight people.' },
    { name: 'Usman Q.', rating: 4, body: 'Fast delivery to Model Town, food was hot. Reshmi kabab are the softest I have had here.' },
  ]
  const t = Date.now()
  rows.forEach((r, i) => {
    db.prepare('INSERT INTO reviews(id,customer_id,order_id,name,rating,body,approved,created_at) VALUES(?,NULL,NULL,?,?,?,1,?)')
      .run('rv_seed_' + i, r.name, r.rating, r.body, t - (i + 1) * 86400000 * 3)
  })
}

/* ---------------- clearing demo data ---------------- */

export function clearOrders(db) {
  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM order_events')
    db.exec('DELETE FROM order_items')
    db.exec('DELETE FROM order_customers')
    db.exec('DELETE FROM orders')
    // Drop every generated review too. The demo seeds a handful of "published"
    // reviews (id LIKE 'rv_seed_%') and a live order that someone rated leaves
    // its row behind, so clearing the orders without the reviews keeps fake
    // feedback on the site's Reviews section after going live. Also clear any
    // review that pointed at an order that no longer exists.
    db.exec(`DELETE FROM reviews
      WHERE id LIKE 'rv_seed_%'
         OR (order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM orders))`)
    // Reset riders back to the roster's default shift state. Demo deliveries
    // would otherwise leave every demo rider flagged as on shift even though
    // their orders are gone.
    db.exec('UPDATE riders SET on_shift = 1')
    db.prepare("UPDATE counters SET v = 1040 WHERE k = 'order'").run()
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  return true
}

export function isDemoSeed(db) {
  // Only the generator writes 'Phone order' / 'Walk-in' snapshots.
  const row = db.prepare("SELECT COUNT(*) AS n FROM order_customers WHERE name IN ('Walk-in','Counter order','Phone order')").get()
  return row.n > 0
}

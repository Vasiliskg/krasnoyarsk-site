const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Сессии хранятся в PostgreSQL
app.use(session({
  store: new pgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'krasnoyarsk-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 дней
}));

async function initDB() {
  // Таблица мест
  await pool.query(`
    CREATE TABLE IF NOT EXISTS places (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(255) NOT NULL,
      cat       VARCHAR(100) NOT NULL,
      addr      TEXT,
      desc_text TEXT,
      rating    NUMERIC(3,1) DEFAULT 4.5,
      img       TEXT,
      lat       NUMERIC(10,7),
      lng       NUMERIC(10,7),
      hidden    BOOLEAN DEFAULT false
    )
  `);

  // Таблица пользователей
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar        TEXT DEFAULT '',
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);

  // Таблица избранного
  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
      place_id INTEGER REFERENCES places(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, place_id)
    )
  `);

  // Таблица отзывов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      place_id   INTEGER REFERENCES places(id) ON DELETE CASCADE,
      rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
      text       TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM places');
  if (parseInt(rows[0].count) === 0) {
    const defaultPlaces = [
      { name: 'Заповедник «Столбы»', cat: 'Природа', rating: 4.9, addr: 'ул. Карьерная, 26а, Красноярск', lat: 55.9673, lng: 92.7400, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Stolby_reserve.jpg/800px-Stolby_reserve.jpg', desc_text: 'Национальный парк с уникальными скальными образованиями высотой до 100 м.' },
      { name: 'Фанпарк «Бобровый лог»', cat: 'Природа', rating: 4.8, addr: 'ул. Сибирская, 92, Красноярск', lat: 55.9646, lng: 92.7926, img: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80', desc_text: 'Всесезонный парк у границы заповедника «Столбы».' },
      { name: 'Остров Татышев', cat: 'Природа', rating: 4.6, addr: 'остров Татышев, Красноярск', lat: 56.0271, lng: 92.9434, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Крупнейший речной остров в черте города.' },
      { name: 'Торгашинская лестница', cat: 'Природа', rating: 4.8, addr: 'ул. Базайская, 347/1, Красноярск', lat: 55.9615, lng: 92.7980, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Самая длинная лестница в России — 1683 ступени.' },
      { name: 'Часовня Параскевы Пятницы', cat: 'Храмы', rating: 4.7, addr: 'Покровская гора, Красноярск', lat: 56.0186, lng: 92.8660, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Chasovnya_Paraskevi_Pyatnitsy.jpg/800px-Chasovnya_Paraskevi_Pyatnitsy.jpg', desc_text: 'Символ Красноярска на 10-рублёвой банкноте.' },
      { name: 'Красноярский краеведческий музей', cat: 'Музеи', rating: 4.5, addr: 'ул. Дубровинского, 84, Красноярск', lat: 56.0102, lng: 92.8542, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Krasnoyarsk_Regional_Museum.jpg/800px-Krasnoyarsk_Regional_Museum.jpg', desc_text: 'Один из крупнейших музеев Сибири.' },
      { name: 'Органный зал филармонии', cat: 'Музеи', rating: 4.8, addr: 'ул. Декабристов, 20, Красноярск', lat: 56.0181, lng: 92.8529, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Krasnoyarsk_Organ_Hall.jpg/800px-Krasnoyarsk_Organ_Hall.jpg', desc_text: 'Бывший католический костёл 1911 года. Орган Rieger-Kloss.' },
      { name: 'Театр оперы и балета', cat: 'Развлечения', rating: 4.7, addr: 'пр. Мира, 46, Красноярск', lat: 56.0140, lng: 92.8625, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Krasnoyarsk_Opera_Theatre.jpg/800px-Krasnoyarsk_Opera_Theatre.jpg', desc_text: 'Ведущий театр Сибири.' },
      { name: 'Виноградовский мост', cat: 'Развлечения', rating: 4.8, addr: 'пл. Мира — остров Татышев, Красноярск', lat: 56.0153, lng: 92.8946, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Vinogradovsky_Bridge_Krasnoyarsk.jpg/800px-Vinogradovsky_Bridge_Krasnoyarsk.jpg', desc_text: 'Вантовый пешеходный мост через Енисей.' },
      { name: 'Отель Marriott Krasnoyarsk', cat: 'Отели', rating: 4.8, addr: 'ул. Дубровинского, 104, Красноярск', lat: 56.0059, lng: 92.8358, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', desc_text: 'Пятизвёздочный отель бизнес-класса.' },
      { name: 'Ресторан «Русская охота»', cat: 'Рестораны', rating: 4.8, addr: 'ул. Дубровинского, 104, Красноярск', lat: 56.0059, lng: 92.8358, img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', desc_text: 'Элитный ресторан охотничьей кухни.' },
      { name: 'Музей-усадьба В.И. Сурикова', cat: 'Музеи', rating: 4.7, addr: 'ул. Ленина, 98, Красноярск', lat: 56.0217, lng: 92.8497, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Surikov_museum_Krasnoyarsk.jpg/800px-Surikov_museum_Krasnoyarsk.jpg', desc_text: 'Дом-музей великого живописца Василия Сурикова.' },
      { name: 'Красноярская ГЭС', cat: 'Развлечения', rating: 4.3, addr: 'плотина ГЭС, Дивногорск', lat: 55.9678, lng: 92.3784, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Krasnoyarsk_dam.jpg/800px-Krasnoyarsk_dam.jpg', desc_text: 'Одна из крупнейших ГЭС мира.' },
      { name: 'Покровский кафедральный собор', cat: 'Храмы', rating: 4.6, addr: 'ул. Сурикова, 26, Красноярск', lat: 56.0175, lng: 92.8485, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Pokrovsky_Cathedral_Krasnoyarsk.jpg/800px-Pokrovsky_Cathedral_Krasnoyarsk.jpg', desc_text: 'Старейший каменный храм Красноярска, построен в 1795 году.' },
      { name: 'Парк «Роев ручей»', cat: 'Природа', rating: 4.6, addr: 'ул. Свердловская, 293, Красноярск', lat: 55.9615, lng: 92.7960, img: 'https://images.unsplash.com/photo-1502780402662-acc01917949a?w=600&q=80', desc_text: 'Крупнейший зоопарк Красноярского края.' },
    ];
    for (const p of defaultPlaces) {
      await pool.query(
        `INSERT INTO places (name,cat,addr,desc_text,rating,img,lat,lng,hidden) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
        [p.name, p.cat, p.addr, p.desc_text, p.rating, p.img, p.lat, p.lng]
      );
    }
    console.log('Начальные данные загружены');
  }
  console.log('База данных готова');
}

// ─── MIDDLEWARE авторизации ───────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  next();
}

// ─── API: АВТОРИЗАЦИЯ ─────────────────────────────────────────

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Email уже используется' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,avatar,created_at',
      [name, email.toLowerCase(), hash]
    );
    req.session.userId = rows[0].id;
    res.json({ user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (rows.length === 0) return res.status(400).json({ error: 'Неверный email или пароль' });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Неверный email или пароль' });

    req.session.userId = rows[0].id;
    const { password_hash, ...user } = rows[0];
    res.json({ user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Выход
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Текущий пользователь
app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  try {
    const { rows } = await pool.query(
      'SELECT id,name,email,avatar,created_at FROM users WHERE id=$1', [req.session.userId]
    );
    res.json({ user: rows[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Обновить профиль
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const { rows } = await pool.query(
      'UPDATE users SET name=$1, avatar=$2 WHERE id=$3 RETURNING id,name,email,avatar,created_at',
      [name, avatar || '', req.session.userId]
    );
    res.json({ user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: ИЗБРАННОЕ ───────────────────────────────────────────

// Получить избранное пользователя
app.get('/api/favorites', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.* FROM places p
       JOIN favorites f ON f.place_id = p.id
       WHERE f.user_id = $1 ORDER BY p.rating DESC`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавить в избранное
app.post('/api/favorites/:placeId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO favorites (user_id,place_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.session.userId, req.params.placeId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить из избранного
app.delete('/api/favorites/:placeId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM favorites WHERE user_id=$1 AND place_id=$2',
      [req.session.userId, req.params.placeId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: ОТЗЫВЫ ─────────────────────────────────────────────

// Получить отзывы места
app.get('/api/reviews/:placeId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name as user_name, u.avatar as user_avatar
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.place_id=$1 ORDER BY r.created_at DESC`,
      [req.params.placeId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавить отзыв
app.post('/api/reviews/:placeId', requireAuth, async (req, res) => {
  try {
    const { rating, text } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO reviews (user_id,place_id,rating,text)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.session.userId, req.params.placeId, rating, text]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: МЕСТА ───────────────────────────────────────────────
app.get('/api/places', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM places ORDER BY rating DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/places', async (req, res) => {
  try {
    const { name, cat, addr, desc_text, rating, img, lat, lng } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO places (name,cat,addr,desc_text,rating,img,lat,lng,hidden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING *`,
      [name, cat, addr, desc_text, rating || 4.5, img || '', lat, lng]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/places/:id', async (req, res) => {
  try {
    const { name, cat, addr, desc_text, rating, img, lat, lng, hidden } = req.body;
    const { rows } = await pool.query(
      `UPDATE places SET name=$1,cat=$2,addr=$3,desc_text=$4,
       rating=$5,img=$6,lat=$7,lng=$8,hidden=$9 WHERE id=$10 RETURNING *`,
      [name, cat, addr, desc_text, rating, img, lat, lng, hidden, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/places/:id/toggle', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE places SET hidden = NOT hidden WHERE id=$1 RETURNING *', [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/places/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM places WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'krasnoyarsk.html'));
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log('Сервер: http://localhost:' + PORT));
}).catch(err => { console.error('Ошибка БД:', err); process.exit(1); });

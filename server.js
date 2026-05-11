const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к PostgreSQL (Render автоматически задаёт DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Создаём таблицу если её нет
async function initDB() {
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

  // Если таблица пустая — заполняем начальными данными
  const { rows } = await pool.query('SELECT COUNT(*) FROM places');
  if (parseInt(rows[0].count) === 0) {
    const defaultPlaces = [
      { name: 'Заповедник «Столбы»',                    cat: 'Природа',      addr: 'ул. Карьерная, 26а, Красноярск',             rating: 4.9, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Главная гордость Красноярска — национальный парк с уникальными скальными образованиями высотой до 100 метров.', lat: 55.9673, lng: 92.7400 },
      { name: 'Часовня Параскевы Пятницы',               cat: 'Храмы',        addr: 'Покровская гора, Красноярск',                 rating: 4.7, img: 'https://images.unsplash.com/photo-1548438294-1ad5d5f4f063?w=600&q=80', desc_text: 'Символ Красноярска, изображённый на 10-рублёвой банкноте.', lat: 56.0186, lng: 92.8660 },
      { name: 'Остров Татышев',                          cat: 'Природа',      addr: 'остров Татышев, Красноярск',                  rating: 4.6, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Крупнейший речной остров в черте города. Велодорожки, спортивные площадки, зоны отдыха.', lat: 56.0271, lng: 92.9434 },
      { name: 'Фанпарк «Бобровый лог»',                  cat: 'Природа',      addr: 'ул. Сибирская, 92, Красноярск',               rating: 4.8, img: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80', desc_text: 'Всесезонный парк спорта и отдыха у границы заповедника «Столбы».', lat: 55.9646, lng: 92.7926 },
      { name: 'Красноярский краеведческий музей',        cat: 'Музеи',        addr: 'ул. Дубровинского, 84, Красноярск',           rating: 4.5, img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80', desc_text: 'Один из крупнейших музеев Сибири.', lat: 56.0102, lng: 92.8542 },
      { name: 'Театральная площадь',                     cat: 'Развлечения',  addr: 'Театральная площадь, Красноярск',             rating: 4.4, img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', desc_text: 'Главная площадь города, место проведения городских праздников.', lat: 56.0123, lng: 92.8643 },
      { name: 'Театр оперы и балета им. Хворостовского', cat: 'Развлечения',  addr: 'пр. Мира, 46, Красноярск',                    rating: 4.7, img: 'https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=600&q=80', desc_text: 'Один из ведущих театров Сибири.', lat: 56.0123, lng: 92.8643 },
      { name: 'Красноярская ГЭС',                        cat: 'Развлечения',  addr: 'плотина ГЭС, Дивногорск',                     rating: 4.3, img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=600&q=80', desc_text: 'Одна из крупнейших ГЭС в России и мире.', lat: 55.9678, lng: 92.3784 },
      { name: 'Отель Marriott Krasnoyarsk',               cat: 'Отели',        addr: 'ул. Дубровинского, 104, Красноярск',          rating: 4.8, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', desc_text: 'Пятизвёздочный отель бизнес-класса.', lat: 56.0059, lng: 92.8358 },
      { name: 'Торгашинская лестница',                   cat: 'Природа',      addr: 'ул. Базайская, 347/1, Красноярск',            rating: 4.8, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Самая длинная лестница в России — 1683 ступени.', lat: 55.9615, lng: 92.7980 },
      { name: 'Органный зал Красноярской филармонии',    cat: 'Музеи',        addr: 'ул. Декабристов, 20, Красноярск',             rating: 4.8, img: 'https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=600&q=80', desc_text: 'Бывший римско-католический костёл 1911 года.', lat: 56.0181, lng: 92.8529 },
      { name: 'Виноградовский мост',                     cat: 'Развлечения',  addr: 'пл. Мира — остров Татышев, Красноярск',       rating: 4.8, img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=600&q=80', desc_text: 'Двухпилонный вантовый пешеходный мост через протоку Енисея.', lat: 56.0153, lng: 92.8946 },
      { name: 'Памятник Андрею Поздееву',                cat: 'Развлечения',  addr: 'пр. Мира, 83, Красноярск',                    rating: 4.8, img: '', desc_text: 'Фигура знаменитого красноярского художника с зонтиком.', lat: 56.0169, lng: 92.8592 },
      { name: 'Храм Преображения Господня',              cat: 'Храмы',        addr: 'ул. Декабристов, 20, Красноярск',             rating: 4.8, img: 'https://images.unsplash.com/photo-1548438294-1ad5d5f4f063?w=600&q=80', desc_text: 'Бывший римско-католический костёл, ныне концертный зал.', lat: 56.0181, lng: 92.8529 },
      { name: 'Музей-усадьба В.И. Сурикова',             cat: 'Музеи',        addr: 'ул. Ленина, 98, Красноярск',                  rating: 4.7, img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80', desc_text: 'Дом-музей великого русского живописца Василия Сурикова.', lat: 56.0217, lng: 92.8497 },
      { name: 'Ресторан «Русская охота»',                cat: 'Рестораны',    addr: 'ул. Дубровинского, 104, Красноярск',          rating: 4.8, img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', desc_text: 'Элитный ресторан охотничьей кухни.', lat: 56.0059, lng: 92.8358 },
      { name: 'Парк 350-летия Красноярска',              cat: 'Природа',      addr: 'пл. Мира, 1, Красноярск',                     rating: 4.5, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Современный городской парк на набережной Енисея.', lat: 56.0087, lng: 92.8703 },
      { name: 'Левобережная набережная Енисея',          cat: 'Природа',      addr: 'ул. Дубровинского, Красноярск',               rating: 4.6, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Протяжённая набережная вдоль левого берега Енисея.', lat: 55.9988, lng: 92.8347 },
      { name: 'Парк флоры и фауны «Роев ручей»',        cat: 'Природа',      addr: 'ул. Свердловская, 293, Красноярск',           rating: 4.6, img: 'https://images.unsplash.com/photo-1502780402662-acc01917949a?w=600&q=80', desc_text: 'Крупнейший зоопарк Красноярского края.', lat: 55.9615, lng: 92.7980 },
      { name: 'Красноярское водохранилище',              cat: 'Природа',      addr: 'г. Дивногорск, Красноярский край',            rating: 4.6, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Одно из крупнейших водохранилищ России.', lat: 55.9500, lng: 92.3000 },
      { name: 'Музейный центр «Площадь Мира»', cat: 'Музеи', addr: 'пл. Мира, 1, Красноярск', rating: 4.7, img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80', desc_text: 'Крупнейший центр современного искусства в Сибири.', lat: 56.0101, lng: 92.8722 },

      { name: 'Красноярская филармония', cat: 'Развлечения', addr: 'пл. Мира, 2Б, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=600&q=80', desc_text: 'Главная концертная площадка города.', lat: 56.0099, lng: 92.8733 },

      { name: 'Парк Горького', cat: 'Природа', addr: 'ул. Карла Маркса, 151, Красноярск', rating: 4.6, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Центральный городской парк.', lat: 56.0165, lng: 92.8468 },

      { name: 'Эко-парк «Гремячая грива»', cat: 'Природа', addr: 'ул. Биатлонная, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Экологический парк с лесными маршрутами.', lat: 56.0271, lng: 92.7889 },

      { name: 'Николаевская сопка', cat: 'Природа', addr: 'Николаевская сопка, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Одна из лучших смотровых площадок города.', lat: 56.0246, lng: 92.7992 },

      { name: 'Смотровая площадка «Царь-рыба»', cat: 'Природа', addr: 'Слизнево, трасса Р257', rating: 4.9, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Панорамный вид на Енисей.', lat: 55.9384, lng: 92.5968 },

      { name: 'Покровский кафедральный собор', cat: 'Храмы', addr: 'ул. Сурикова, 26, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1548438294-1ad5d5f4f063?w=600&q=80', desc_text: 'Главный православный храм города.', lat: 56.0188, lng: 92.8608 },

      { name: 'Свято-Успенский монастырь', cat: 'Храмы', addr: 'ул. Лесная, 55А, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1548438294-1ad5d5f4f063?w=600&q=80', desc_text: 'Монастырский комплекс на берегу Енисея.', lat: 55.9991, lng: 92.7602 },

      { name: 'ТРЦ «Планета»', cat: 'Развлечения', addr: 'ул. 9 Мая, 77, Красноярск', rating: 4.7, img: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=600&q=80', desc_text: 'Крупнейший торговый центр города.', lat: 56.0511, lng: 92.9113 },

      { name: 'Отель Hilton Garden Inn', cat: 'Отели', addr: 'ул. Молокова, 37, Красноярск', rating: 4.7, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', desc_text: 'Современный бизнес-отель.', lat: 56.0432, lng: 92.9051 },

      { name: 'Площадь Революции', cat: 'Развлечения', addr: 'пл. Революции, Красноярск', rating: 4.4, img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', desc_text: 'Историческая площадь в центре города.', lat: 56.0179, lng: 92.8478 },

      { name: 'Фонтан «Реки Сибири»', cat: 'Развлечения', addr: 'Театральная площадь, Красноярск', rating: 4.7, img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80', desc_text: 'Один из самых красивых фонтанов города.', lat: 56.0121, lng: 92.8641 },

      { name: 'Коммунальный мост', cat: 'Развлечения', addr: 'Коммунальный мост, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=600&q=80', desc_text: 'Легендарный мост через Енисей.', lat: 56.0008, lng: 92.8737 },

      { name: 'Литературный музей им. Астафьева', cat: 'Музеи', addr: 'ул. Ленина, 66, Красноярск', rating: 4.6, img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80', desc_text: 'Литературная история Красноярского края.', lat: 56.0193, lng: 92.8559 },

      { name: 'Художественный музей им. Сурикова', cat: 'Музеи', addr: 'ул. Парижской Коммуны, 20, Красноярск', rating: 4.7, img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80', desc_text: 'Коллекция русского искусства.', lat: 56.0148, lng: 92.8599 },

      { name: 'Остров Отдыха', cat: 'Природа', addr: 'остров Отдыха, Красноярск', rating: 4.6, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc_text: 'Спортивно-парковая территория.', lat: 55.9948, lng: 92.8895 },

      { name: 'Набережная Качи', cat: 'Природа', addr: 'река Кача, Красноярск', rating: 4.3, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Прогулочная зона вдоль реки Кача.', lat: 56.0214, lng: 92.8459 },

      { name: 'Ресторан «Чешуя»', cat: 'Рестораны', addr: 'ул. Ленина, 118А, Красноярск', rating: 4.7, img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', desc_text: 'Современный ресторан с акцентом на рыбу.', lat: 56.0224, lng: 92.8479 },

      { name: 'Ресторан «0.75 Please»', cat: 'Рестораны', addr: 'пр. Мира, 86, Красноярск', rating: 4.8, img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', desc_text: 'Известный гастрономический ресторан.', lat: 56.0171, lng: 92.8541 },

      { name: 'Манская петля', cat: 'Природа', addr: 'пос. Усть-Мана, Красноярский край', rating: 4.9, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', desc_text: 'Знаменитый маршрут с видом на реку Мана.', lat: 55.9314, lng: 92.5039 },
    ];

    for (const p of defaultPlaces) {
      await pool.query(
        `INSERT INTO places (name, cat, addr, desc_text, rating, img, lat, lng, hidden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
        [p.name, p.cat, p.addr, p.desc_text, p.rating, p.img, p.lat, p.lng]
      );
    }
    console.log('База данных заполнена начальными данными');
  }
  console.log('База данных готова');
}

// ─── API маршруты ────────────────────────────────────────────

// Получить все места
app.get('/api/places', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM places ORDER BY rating DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Добавить место
app.post('/api/places', async (req, res) => {
  try {
    const { name, cat, addr, desc_text, rating, img, lat, lng } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO places (name, cat, addr, desc_text, rating, img, lat, lng, hidden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING *`,
      [name, cat, addr, desc_text, rating || 4.5, img || '', lat, lng]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Обновить место
app.put('/api/places/:id', async (req, res) => {
  try {
    const { name, cat, addr, desc_text, rating, img, lat, lng, hidden } = req.body;
    const { rows } = await pool.query(
      `UPDATE places SET name=$1, cat=$2, addr=$3, desc_text=$4,
       rating=$5, img=$6, lat=$7, lng=$8, hidden=$9
       WHERE id=$10 RETURNING *`,
      [name, cat, addr, desc_text, rating, img, lat, lng, hidden, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Скрыть/показать место
app.patch('/api/places/:id/toggle', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE places SET hidden = NOT hidden WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Удалить место
app.delete('/api/places/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM places WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Отдаём HTML сайт
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'krasnoyarsk.html'));
});

// ─── Запуск ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Ошибка подключения к БД:', err);
  process.exit(1);
});

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// =====================================================
// ИНИЦИАЛИЗАЦИЯ
// =====================================================

const app = express();

// ✅ КРИТИЧНО: Trust proxy для работы за nginx
app.set('trust proxy', 1);

// Prisma Client
const prisma = new PrismaClient();

const PASSWORD_SCRYPT_N = 16384;
const PASSWORD_SCRYPT_R = 8;
const PASSWORD_SCRYPT_P = 1;
const PASSWORD_SCRYPT_KEYLEN = 64;
const LOGIN_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;
const AVATAR_MAX_LENGTH = 16;
const PASSWORD_MIN_LENGTH = 6;

// Настройки cookie
const COOKIE_NAME = 'session_token';
const COOKIE_DOMAIN = '.approvegame.ru';
const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '30', 10);

// Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ CORS с whitelist (БЕЗ *)
app.use(cors({
  origin: [
    'https://approvegame.ru',
    'https://www.approvegame.ru'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// =====================================================
// ИМПОРТ ДАННЫХ ИЗ ФАЙЛА
// =====================================================

// База профессий с полными данными
const PROFESSION_DATA = [
  {
    id: "actor",
    name: "Актер",
    preferredAge: 30,
    preferredSkills: [
      "навыки сценической речи",
      "умение вживаться в роль",
      "владение своим телом, мимикой и артикуляцией"
    ],
    preferredQualities: ["креативность", "коммуникабельность", "уверенность"],
    description: "Актер — это профессиональный исполнитель разнообразных ролей в спектаклях, кино, рекламных роликах, видеоклипах и т.д.",
    questions: [
      "Хотите ли вы работать в кино, живом театре или и там, и там?",
      "Какой ваш любимый фильм или театральная постановка?",
      "В каких спектаклях вы играли раньше?"
    ],
    image: "prof-act.png"
  },
  {
    id: "architect",
    name: "Архитектор",
    preferredAge: 50,
    preferredSkills: [
      "проведение расчетов для строительства",
      "визуализация эскизов и чертежей",
      "подготовка проектной документации"
    ],
    preferredQualities: ["внимательность", "креативность"],
    description: "Архитектор — это специалист, который занимается проектированием зданий, промышленных сооружений, социально-культурных объектов.",
    questions: [
      "Какой ваш опыт работы в области архитектуры?",
      "Каков ваш подход к дизайну?",
      "Какие тренды в архитектуре вас вдохновляют?"
    ],
    image: "prof-arh.png"
  },
  {
    id: "doctor",
    name: "Врач",
    preferredAge: 60,
    preferredSkills: [
      "оказание первой медицинской помощи",
      "лечение различных заболеваний"
    ],
    preferredQualities: ["внимательность", "эмпатия"],
    description: "Врач — это специалист с высшим медицинским образованием, который использует свои навыки и опыт для профилактики и лечения заболеваний.",
    questions: [
      "Если бы вам нужно было описать себя тремя словами, какими бы они были?",
      "Что вы знаете о нашей организации и пациентах?",
      "Что вы знаете о клятве Гиппократа?"
    ],
    image: "prof-vrach.png"
  },
  {
    id: "designer",
    name: "Дизайнер",
    preferredAge: 35,
    preferredSkills: [
      "знание графических редакторов",
      "подбор цветовой схемы",
      "визуальное оформление"
    ],
    preferredQualities: ["креативность", "усидчивость", "коммуникабельность"],
    description: "Дизайнер — это специалист, который создает визуальный облик различных объектов.",
    questions: [
      "Какими навыками должен обладать дизайнер?",
      "Какой будет основной тренд в дизайне?",
      "Какие ваши источники вдохновения?"
    ],
    image: "prof-design.png"
  },
  {
    id: "journalist",
    name: "Журналист",
    preferredAge: 40,
    preferredSkills: [
      "сбор информации для СМИ",
      "написание статей"
    ],
    preferredQualities: ["коммуникабельность", "любознательность", "наблюдательность"],
    description: "Журналист — специалист, который собирает информацию и распространяет ее в СМИ.",
    questions: [
      "О каких темах вы бы предпочли писать?",
      "Есть ли журналисты, которые вас вдохновляют?",
      "Взялись бы вы за статью, которая может испортить репутацию?"
    ],
    image: "prof-zhur.png"
  },
  {
    id: "marketer",
    name: "Маркетолог",
    preferredAge: 35,
    preferredSkills: [
      "воронка продаж",
      "стратегия продвижения",
      "анализ конкурентов"
    ],
    preferredQualities: ["креативность", "коммуникабельность", "стрессоустойчивость"],
    description: "Маркетолог — специалист, который создает стратегию продвижения продуктов или услуг.",
    questions: [
      "Что будете делать при негативном комментарии?",
      "За какими брендами следите?",
      "Как будете работать при отключении электричества?"
    ],
    image: "prof-mark.png"
  },
  {
    id: "teacher",
    name: "Педагог",
    preferredAge: 70,
    preferredSkills: [
      "знание основ педагогики и психологии",
      "разработка индивидуального плана обучения"
    ],
    preferredQualities: ["терпеливость", "ответственность", "сдержанность"],
    description: "Педагог занимается обучением и развитием детей и взрослых.",
    questions: [
      "Как работаете с прогульщиками?",
      "Как реагируете на плохую дисциплину?",
      "Какую тему сложнее всего преподавать?"
    ],
    image: "prof-ped.png"
  },
  {
    id: "translator",
    name: "Переводчик",
    preferredAge: 40,
    preferredSkills: [
      "знание иностранного языка",
      "культурологические познания различных стран"
    ],
    preferredQualities: ["усидчивость", "организованность"],
    description: "Переводчик переводит письменную и устную речь.",
    questions: [
      "Какими языками владеете?",
      "Как справляетесь со сложным переводом?",
      "Как обрабатываете нестандартные запросы?"
    ],
    image: "prof-trans.png"
  },
  {
    id: "police",
    name: "Полицейский",
    preferredAge: 45,
    preferredSkills: [
      "предотвращение нарушения закона",
      "знание законов РФ"
    ],
    preferredQualities: ["честность", "справедливость"],
    description: "Полицейский — сотрудник правоохранительных органов.",
    questions: [
      "Что ответите жителям района?",
      "Бывали ли в опасных ситуациях?",
      "Почему хотите работать у нас?"
    ],
    image: "prof-pol.png"
  },
  {
    id: "entrepreneur",
    name: "Предприниматель",
    preferredAge: null,
    preferredSkills: [
      "способность адаптироваться к любой ситуации",
      "финансовая грамотность"
    ],
    preferredQualities: ["трудолюбие", "целеустремленность", "рисковость"],
    description: "Предприниматель занимается бизнесом ради прибыли.",
    questions: [
      "Каким бизнесом владеете?",
      "Есть ли сотрудники?",
      "Кто ваша аудитория?"
    ],
    image: "prof-ip.png"
  }
];

// Используем те же данные, что и в клиенте
const PROFESSIONS = PROFESSION_DATA.map(p => p.name);

const ADDITION_IMAGES = [
  "dop-course.png",
  "dop-dad.png",
  "dop-excel.png",
  "dop-fish.png",
  "dop-foodcourse.png",
  "dop-grandmother.png",
  "dop-joke.png",
  "dop-kiosk.png",
  "dop-lastwork.png",
  "dop-mgu.png",
  "dop-million.png",
  "dop-noski.png",
  "dop-pirozhki.png",
  "dop-sber.png",
  "dop-tank.png"
];

const AGE_IMAGES = [
  "age18.png",
  "age20.png",
  "age22.png",
  "age24.png",
  "age26.png",
  "age28.png",
  "age30.png",
  "age32.png",
  "age34.png",
  "age36.png",
  "age38.png",
  "age40.png",
  "age42.png",
  "age44.png",
  "age46.png",
  "age48.png",
  "age50.png",
  "age52.png",
  "age54.png",
  "age56.png",
  "age58.png",
  "age60.png",
  "age70.png",
  "age80.png"
];

const SKILL_IMAGES = [
  "nav-analiz.png",
  "nav-code.png",
  "nav-cvet.png",
  "nav-doc.png",
  "nav-dogovor.png",
  "nav-eskiz.png",
  "nav-finanaliz.png",
  "nav-fingram.png",
  "nav-graf.png",
  "nav-help.png",
  "nav-him.png",
  "nav-isk.png",
  "nav-konsul.png",
  "nav-lab.png",
  "nav-lang.png",
  "nav-med.png",
  "nav-mimika.png",
  "nav-ocen.png",
  "nav-ped.png",
  "nav-po.png",
  "nav-podstroy.png",
  "nav-presech.png",
  "nav-prodvi.png",
  "nav-rech.png",
  "nav-rescom.png",
  "nav-role.png",
  "nav-smi.png",
  "nav-state.png",
  "nav-stroy.png",
  "nav-tb.png",
  "nav-voronka.png",
  "nav-web.png",
  "nav-zabol.png",
  "nav-zakon.png"
];

const QUALITY_IMAGES = [
  "kach-cder.png",
  "kach-ches.png",
  "kach-crea1.png",
  "kach-crea2.png",
  "kach-em1.png",
  "kach-em2.png",
  "kach-nad1.png",
  "kach-nad2.png",
  "kach-nad3.png",
  "kach-ob1.png",
  "kach-ob2.png",
  "kach-ob3.png",
  "kach-sprav.png",
  "kach-stress.png",
  "kach-terpel.png",
  "kach-toch.png",
  "kach-usid.png",
  "kach-vnimat1.png",
  "kach-vnimat2.png"
];

const BAD_CARD_IMAGES = [
  "pod-1.png",
  "pod-2.png",
  "pod-3.png",
  "pod-4.png",
  "pod-5.png",
  "pod-6.png",
  "pod-7.png",
  "pod-8.png",
  "pod-9.png",
  "pod-10.png",
  "pod-11.png",
  "pod-12.png",
  "pod-13.png",
  "pod-14.png",
  "pod-15.png",
  "pod-16.png",
  "pod-17.png",
  "pod-18.png",
  "pod.png"
];

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

// Перемешать массив
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Найти игрока по socketId
function findPlayerBySocketId(room, socketId) {
  return room.players.find(p => p.socketId === socketId);
}

// Найти игрока по playerId (стабильный UUID)
function findPlayerByPlayerId(room, playerId) {
  return room.players.find(p => p.id === playerId);
}

// Создать комнату
function createRoom(code, hostPlayerId, hostSocketId, hostName, gameMode) {
  const room = {
    code: code,
    hostId: hostPlayerId,
    gameMode: gameMode,
    phase: 'lobby',
    players: [{
      id: hostPlayerId,
      socketId: hostSocketId,
      name: hostName,
      isHR: true,
      connected: true,
      lastSeen: Date.now(),
      cards: [],
      badCards: [],
      score: 0,
      isReady: false
    }],
    deck: generateCardDeck(),
    sabotageDeck: generateSabotageDeck(),
    currentPlayerIndex: 0,
    currentProfession: null
  };
  
  rooms.set(code, room);
  return room;
}

// =====================================================
// ГЕНЕРАЦИЯ КОЛОДЫ
// =====================================================

// Определить группу качества по URL изображения
function getQualityGroup(imageUrl) {
  const fileName = imageUrl.split('/').pop();
  const baseName = fileName.replace('.png', '');
  const group = baseName.replace(/\d+$/, '');
  return group;
}

// Генерировать колоду карт из массивов данных
function generateCardDeck() {
  const deck = [];
  
  PROFESSION_DATA.forEach((professionData, index) => {
    deck.push({
      id: `prof_${index + 1}`,
      type: 'profession',
      title: professionData.name,
      professionData: professionData
    });
  });
  
  AGE_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `age_${index + 1}`,
      type: 'age',
      title: '',
      imageUrl: imageUrl
    });
  });
  
  SKILL_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `skill_${index + 1}`,
      type: 'skill',
      title: '',
      imageUrl: imageUrl
    });
  });
  
  QUALITY_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `quality_${index + 1}`,
      type: 'quality',
      title: '',
      imageUrl: imageUrl
    });
  });
  
  ADDITION_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `addition_${index + 1}`,
      type: 'addition',
      title: '',
      imageUrl: imageUrl
    });
  });
  
  return deck;
}

// Генерировать колоду подлянок
function generateSabotageDeck() {
  return BAD_CARD_IMAGES.map((imageUrl, index) => ({
    id: `trick_${index + 1}`,
    type: 'trick',
    title: '',
    imageUrl: imageUrl
  }));
}

// Раздать карты игрокам по правилам
function dealCards(room) {
  const candidates = room.players.filter(p => !p.isHR);
  
  const professions = shuffle(room.deck.filter(c => c.type === 'profession'));
  const currentProfession = professions.length > 0 
    ? { ...professions[0], revealed: true } 
    : null;
  
  room.currentProfession = currentProfession;
  
  const ages = shuffle(room.deck.filter(c => c.type === 'age'));
  const skills = shuffle(room.deck.filter(c => c.type === 'skill'));
  const qualities = shuffle(room.deck.filter(c => c.type === 'quality'));
  const additions = shuffle(room.deck.filter(c => c.type === 'addition'));
  
  let ageIndex = 0;
  let skillIndex = 0;
  let qualityIndex = 0;
  let additionIndex = 0;
  
  candidates.forEach(player => {
    player.cards = [];
    
    if (currentProfession) {
      player.cards.push({ ...currentProfession, revealed: true });
    }
    
    if (ageIndex < ages.length) {
      const card = { ...ages[ageIndex], revealed: false };
      player.cards.push(card);
      ageIndex++;
    }
    
    if (skillIndex < skills.length) {
      const card = { ...skills[skillIndex], revealed: false };
      player.cards.push(card);
      skillIndex++;
    }
    
    if (qualities.length >= 2) {
      const firstQuality = { ...qualities[qualityIndex], revealed: false };
      player.cards.push(firstQuality);
      const firstGroup = getQualityGroup(firstQuality.imageUrl);
      qualityIndex++;
      
      let secondQuality = null;
      let searchIndex = qualityIndex;
      
      while (searchIndex < qualities.length && !secondQuality) {
        const candidate = qualities[searchIndex];
        const candidateGroup = getQualityGroup(candidate.imageUrl);
        
        if (candidateGroup !== firstGroup) {
          secondQuality = { ...candidate, revealed: false };
          qualities.splice(searchIndex, 1);
          qualities.splice(qualityIndex, 0, candidate);
          break;
        }
        searchIndex++;
      }
      
      if (secondQuality) {
        player.cards.push(secondQuality);
        qualityIndex++;
      } else {
        console.warn(`⚠️ Не удалось найти качество из другой группы для игрока ${player.name}`);
        if (qualityIndex < qualities.length) {
          const card = { ...qualities[qualityIndex], revealed: false };
          player.cards.push(card);
          qualityIndex++;
        }
      }
    }
    
    if (additionIndex < additions.length) {
      const card = { ...additions[additionIndex], revealed: false };
      player.cards.push(card);
      additionIndex++;
    }
    
    console.log(`✅ Player ${player.name} received ${player.cards.length} cards:`, 
      player.cards.map(c => `${c.type}: ${c.title}`).join(', '));
  });
  
  const shuffledSabotages = shuffle([...room.sabotageDeck]);
  candidates.forEach((player, index) => {
    if (index < shuffledSabotages.length) {
      const trickCard = { ...shuffledSabotages[index], revealed: true };
      player.cards.push(trickCard);
      console.log(`✅ Player ${player.name} received trick card in hand (revealed)`);
    }
  });
}

// =====================================================
// СЕРВЕР
// =====================================================

// Хранилище комнат
const rooms = new Map();

// Grace period для переподключения (2 минуты)
const GRACE_PERIOD_MS = 120000;
const CLEANUP_INTERVAL_MS = 30000;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    message: '🎮 Сервер игры работает!',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    socketIOVersion: require('socket.io/package.json').version
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    rooms: rooms.size
  })
});

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(
      password,
      salt,
      PASSWORD_SCRYPT_KEYLEN,
      { N: PASSWORD_SCRYPT_N, r: PASSWORD_SCRYPT_R, p: PASSWORD_SCRYPT_P },
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      }
    );
  });
}

function verifyPassword(password, encodedHash) {
  return new Promise((resolve, reject) => {
    const parts = (encodedHash || '').split(':');
    if (parts.length !== 2) {
      resolve(false);
      return;
    }

    const [salt, expectedHash] = parts;
    crypto.scrypt(
      password,
      salt,
      PASSWORD_SCRYPT_KEYLEN,
      { N: PASSWORD_SCRYPT_N, r: PASSWORD_SCRYPT_R, p: PASSWORD_SCRYPT_P },
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }

        const expected = Buffer.from(expectedHash, 'hex');
        if (expected.length !== derivedKey.length) {
          resolve(false);
          return;
        }

        resolve(crypto.timingSafeEqual(expected, derivedKey));
      }
    );
  });
}

function toPublicUser(user) {
  return {
    id: user.id,
    login: user.login ?? null,
    email: user.email ?? null,
    name: user.name,
    avatar: user.avatar ?? null
  };
}

async function createSession(userId) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  return prisma.session.create({
    data: {
      userId,
      expiresAt
    }
  });
}

function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  });
}

// =====================================================
// AUTHENTICATION ENDPOINTS
// =====================================================

// ✅ DEBUG ENDPOINT
app.get('/auth/debug', (req, res) => {
  res.json({
    cookies: req.cookies,
    origin: req.headers.origin,
    secure: req.secure,
    protocol: req.protocol,
    xfproto: req.headers['x-forwarded-proto']
  });
});

// POST /auth/register - Регистрация по логину и паролю
app.post('/auth/register', async (req, res) => {
  try {
    const rawLogin = typeof req.body?.login === 'string' ? req.body.login.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawAvatar = typeof req.body?.avatar === 'string' ? req.body.avatar.trim() : null;

    if (!LOGIN_REGEX.test(rawLogin)) {
      return res.status(400).json({ error: 'Логин: 3-32 символа, только латиница/цифры/._-' });
    }

    if (rawPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Пароль должен быть минимум ${PASSWORD_MIN_LENGTH} символов` });
    }

    if (rawName.length < 2 || rawName.length > 50) {
      return res.status(400).json({ error: 'Имя должно быть от 2 до 50 символов' });
    }

    if (rawAvatar && rawAvatar.length > AVATAR_MAX_LENGTH) {
      return res.status(400).json({ error: 'Аватар слишком длинный' });
    }

    const existing = await prisma.user.findUnique({
      where: { login: rawLogin }
    });

    if (existing) {
      return res.status(409).json({ error: 'Этот логин уже занят' });
    }

    const passwordHash = await hashPassword(rawPassword);

    const user = await prisma.user.create({
      data: {
        login: rawLogin,
        passwordHash,
        name: rawName,
        avatar: rawAvatar || null
      }
    });

    const session = await createSession(user.id);
    setSessionCookie(res, session.id);

    console.log(`✅ New local user created: @${user.login}`);
    res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login - Вход по логину и паролю
app.post('/auth/login', async (req, res) => {
  try {
    const rawLogin = typeof req.body?.login === 'string' ? req.body.login.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!LOGIN_REGEX.test(rawLogin) || !rawPassword) {
      return res.status(400).json({ error: 'Некорректный логин или пароль' });
    }

    const user = await prisma.user.findUnique({
      where: { login: rawLogin }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const passwordOk = await verifyPassword(rawPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const session = await createSession(user.id);
    setSessionCookie(res, session.id);

    console.log(`✅ Local user logged in: @${user.login}`);
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me - Получить текущего пользователя
app.get('/auth/me', async (req, res) => {
  try {
    console.log('📥 GET /auth/me received');
    console.log('   Cookies:', req.cookies);
    
    const sessionId = req.cookies[COOKIE_NAME];
    
    console.log('   session_token:', sessionId || 'NOT FOUND');
    
    if (!sessionId) {
      return res.status(401).json({ user: null });
    }

    // Найти сессию
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session) {
      console.log('❌ Session not found');
      return res.status(401).json({ user: null });
    }

    // Проверить, что сессия не истекла
    if (session.expiresAt < new Date()) {
      console.log('❌ Session expired');
      // Удалить истекшую сессию
      await prisma.session.delete({
        where: { id: sessionId }
      });
      
      // ✅ ИСПРАВЛЕНО: clearCookie с правильными параметрами
      res.clearCookie(COOKIE_NAME, {
        domain: COOKIE_DOMAIN,
        path: '/'
      });
      
      return res.status(401).json({ user: null });
    }

    console.log('✅ Session valid, returning user:', session.user.login || session.user.email || session.user.id);

    // Вернуть пользователя
    res.json({
      user: toPublicUser(session.user)
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout - Выход из системы
app.post('/auth/logout', async (req, res) => {
  try {
    const sessionId = req.cookies[COOKIE_NAME];
    
    if (sessionId) {
      // Удалить сессию из БД
      await prisma.session.delete({
        where: { id: sessionId }
      }).catch(() => {
        // Игнорируем ошибку если сессия уже удалена
      });
    }

    // ✅ ИСПРАВЛЕНО: clearCookie с правильными параметрами
    res.clearCookie(COOKIE_NAME, {
      domain: COOKIE_DOMAIN,
      path: '/'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /auth/profile - Обновление профиля
app.put('/auth/profile', async (req, res) => {
  try {
    console.log('📥 PUT /auth/profile received');
    
    const sessionId = req.cookies[COOKIE_NAME];
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Найти сессию
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const { name, avatar } = req.body;

    // Валидация имени
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
      }
    }

    if (avatar !== undefined) {
      if (typeof avatar !== 'string' || avatar.trim().length > AVATAR_MAX_LENGTH) {
        return res.status(400).json({ error: 'Avatar must be a short emoji string' });
      }
    }

    // Обновить пользователя
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(avatar !== undefined && { avatar: avatar.trim() || null })
      }
    });

    console.log('✅ Profile updated for user:', updatedUser.login || updatedUser.email || updatedUser.id);

    res.json({
      user: toPublicUser(updatedUser)
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/stats - Статистика игрока
app.get('/auth/stats', async (req, res) => {
  try {
    console.log('📥 GET /auth/stats received');
    
    const sessionId = req.cookies[COOKIE_NAME];
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Найти сессию
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // Получить все игры пользователя
    const performances = await prisma.performance.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' }
    });

    const totalGames = performances.length;
    const wins = performances.filter(p => p.won).length;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    
    // Средний балл (только игры со счетом)
    const gamesWithScore = performances.filter(p => p.score !== null);
    const averageScore = gamesWithScore.length > 0
      ? Math.round((gamesWithScore.reduce((sum, p) => sum + (p.score || 0), 0) / gamesWithScore.length) * 10) / 10
      : 0;

    // Топ профессия (по количеству побед)
    const professionWins = {};
    performances.filter(p => p.won).forEach(p => {
      professionWins[p.profession] = (professionWins[p.profession] || 0) + 1;
    });
    
    let bestProfession = null;
    let maxWins = 0;
    Object.entries(professionWins).forEach(([profession, winsCount]) => {
      if (winsCount > maxWins) {
        maxWins = winsCount;
        bestProfession = profession;
      }
    });

    // История последних 10 игр
    const history = performances.slice(0, 10).map(p => ({
      profession: p.profession,
      score: p.score,
      won: p.won,
      position: p.position,
      createdAt: p.createdAt
    }));

    console.log('✅ Stats retrieved for user:', session.user.login || session.user.email || session.user.id);

    res.json({
      totalGames,
      wins,
      winRate,
      averageScore,
      bestProfession,
      history
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// MIDDLEWARE
// =====================================================

// Middleware для определения пользователя
async function attachUser(req, res, next) {
  try {
    const sessionId = req.cookies[COOKIE_NAME];
    
    if (!sessionId) {
      req.user = null;
      return next();
    }

    // Найти сессию
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      req.user = null;
      return next();
    }

    req.user = session.user;
    next();
  } catch (error) {
    console.error('❌ AttachUser middleware error:', error);
    req.user = null;
    next();
  }
}

// Применить middleware глобально
app.use(attachUser);

const httpServer = createServer(app);

// ✅ ИСПРАВЛЕНО: Socket.io CORS с whitelist (БЕЗ *)
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://approvegame.ru',
      'https://www.approvegame.ru'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// =====================================================
// SOCKET.IO MIDDLEWARE - АВТОРИЗАЦИЯ
// =====================================================

// Middleware для определения пользователя в Socket.io
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    
    if (!cookieHeader) {
      socket.user = null;
      return next();
    }

    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts.shift().trim();
      const value = parts.join('=').trim();
      cookies[key] = value;
    });

    const sessionId = cookies[COOKIE_NAME];

    if (!sessionId) {
      socket.user = null;
      return next();
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      socket.user = null;
      return next();
    }

    socket.user = session.user;
    console.log(`✅ Authenticated socket: ${socket.id} -> user: ${session.user.login || session.user.email || session.user.id}`);
    
    next();
  } catch (error) {
    console.error('❌ Socket.io auth middleware error:', error);
    socket.user = null;
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`);

  // Создать комнату
  socket.on('create_room', ({ name, gameMode = 'group', playerId, avatarId }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Для авторизованных пользователей используем имя из socket.user
    const playerName = socket.user ? socket.user.name : name;
    
    const room = createRoom(roomCode, playerId, socket.id, playerName, gameMode);
    
    socket.join(roomCode);
    socket.emit('room_update', room);
    
    console.log(`✅ Комната создана: ${roomCode} by ${playerName} (режим: ${gameMode}, playerId: ${playerId}${socket.user ? ', authenticated' : ''})`);
  });

  // Присоединиться к комнате
  socket.on('join_room', ({ code, name, playerId, avatarId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    // Для авторизованных пользователей используем имя из socket.user
    const playerName = socket.user ? socket.user.name : name;

    const existingPlayer = findPlayerByPlayerId(room, playerId);
    
    if (existingPlayer) {
      console.log(`🔄 Player reconnecting: ${playerName} (playerId: ${playerId}) to room ${code}`);
      
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      existingPlayer.lastSeen = Date.now();
      
      socket.join(code);
      socket.emit('rejoin_ok', { code });
      io.to(code).emit('room_update', room);
      
      console.log(`✅ ${playerName} reconnected successfully`);
    } else {
      if (room.phase !== 'lobby') {
        socket.emit('error', { message: 'Игра уже началась' });
        return;
      }
      
      const now = Date.now();
      const nameIsTaken = room.players.some(p => {
        if (p.name !== name || p.id === playerId) return false;
        
        if (p.connected === true) return true;
        
        if (p.connected === false && (now - p.lastSeen) < GRACE_PERIOD_MS) {
          return true;
        }
        
        return false;
      });
      
      if (nameIsTaken) {
        socket.emit('error', { message: 'Это имя уже занято. Придумайте другое имя.' });
        console.log(`❌ Player tried to join with duplicate name: ${name} in room ${code}`);
        return;
      }
      
      room.players.push({
        id: playerId,
        socketId: socket.id,
        name: playerName,
        avatarId: avatarId,
        isHR: false,
        connected: true,
        lastSeen: Date.now(),
        cards: [],
        badCards: [],
        score: 0,
        isReady: false
      });
      
      socket.join(code);
      io.to(code).emit('room_update', room);
      io.to(code).emit('player_joined', { playerName: playerName });
      
      console.log(`➕ New player ${playerName} joined ${code} (playerId: ${playerId}${socket.user ? ', authenticated' : ''})`);
    }
  });

  // Начать игру
  socket.on('start_game', ({ code }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const hrPlayer = findPlayerBySocketId(room, socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может начать игру' });
      return;
    }

    const candidates = room.players.filter(p => !p.isHR);
    if (candidates.length < 2) {
      socket.emit('error', { message: 'Нужно минимум 2 кандидата' });
      return;
    }

    room.phase = 'cardDistribution';
    dealCards(room);
    
    io.to(code).emit('game_started', room);
    io.to(code).emit('room_update', room);
    
    console.log(`Игра началась в ${code}`);
  });

  // Следующий игрок / следующая фаза
  socket.on('next_player', ({ code }) => {
    console.log(`next_player event received. Code: ${code}, Available rooms:`, Array.from(rooms.keys()));
    const room = rooms.get(code);
    
    if (!room) {
      console.error(`Room not found: ${code}`);
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const candidates = room.players.filter(p => !p.isHR);

    if (room.phase === 'selfPresentation') {
      room.currentPlayerIndex++;
      
      if (room.currentPlayerIndex >= candidates.length) {
        room.phase = 'trickDistribution';
        room.currentPlayerIndex = 0;
      }
    }
    else if (room.phase === 'trickDistribution') {
      room.phase = 'candidateDefense';
      room.currentPlayerIndex = 0;
    }
    else if (room.phase === 'candidateDefense') {
      room.currentPlayerIndex++;
      
      if (room.currentPlayerIndex >= candidates.length) {
        const sorted = [...candidates].sort((a, b) => (b.scoreFromHR || 0) - (a.scoreFromHR || 0));
        room.finalists = sorted.slice(0, 2);
        room.phase = 'finalInterview';
        room.currentQuestionIndex = 0;
        room.currentPlayerIndex = 0;
      }
    }
    else if (room.phase === 'finalInterview') {
      const finalists = room.finalists || [];
      const totalQuestions = 3;
      
      if (typeof room.currentQuestionIndex === 'undefined') {
        room.currentQuestionIndex = 0;
      }
      if (typeof room.currentPlayerIndex === 'undefined') {
        room.currentPlayerIndex = 0;
      }
      
      room.currentPlayerIndex++;
      
      if (room.currentPlayerIndex >= finalists.length) {
        room.currentPlayerIndex = 0;
        room.currentQuestionIndex++;
        
        if (room.currentQuestionIndex >= totalQuestions) {
          room.phase = 'chooseWinner';
          room.currentQuestionIndex = 0;
          room.currentPlayerIndex = 0;
        }
      }
    }

    io.to(code).emit('room_update', room);
  });

  // Подкинуть подлянку
  socket.on('give_sabotage', ({ code, targetId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const targetPlayer = room.players.find(p => p.id === targetId);
    if (targetPlayer) {
      if (!targetPlayer.badCards) {
        targetPlayer.badCards = [];
      }
      const giver = findPlayerBySocketId(room, socket.id);
      if (giver && giver.badCards && giver.badCards.length > 0) {
        const sabotage = giver.badCards.shift();
        targetPlayer.badCards.push(sabotage);
      }
    }

    io.to(code).emit('room_update', room);
  });

  // Передать подлянку другому игроку
  socket.on('distribute_trick', ({ code, targetId, cardId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const giver = findPlayerBySocketId(room, socket.id);

    if (!giver || giver.isHR) {
      socket.emit('error', { message: 'Только игроки могут передавать подлянки' });
      return;
    }

    const trickCardIndex = giver.cards.findIndex(c => c.id === cardId && c.type === 'trick');
    
    if (trickCardIndex === -1) {
      socket.emit('error', { message: 'Подлянка не найдена' });
      return;
    }

    const trickCard = giver.cards.splice(trickCardIndex, 1)[0];

    if (!targetId || targetId === giver.id) {
      trickCard.revealed = true;
      giver.cards.push(trickCard);
      console.log(`✅ ${giver.name} оставил подлянку себе`);
    } else {
      const targetPlayer = room.players.find(p => p.id === targetId);

      if (!targetPlayer || targetPlayer.isHR) {
        socket.emit('error', { message: 'Целевой игрок не найден' });
        return;
      }

      if (!targetPlayer.cards) {
        targetPlayer.cards = [];
      }
      
      trickCard.revealed = true;
      targetPlayer.cards.push(trickCard);

      console.log(`✅ ${giver.name} передал подлянку игроку ${targetPlayer.name}`);
    }
    
    io.to(code).emit('room_update', room);
  });

  // Оценить игрока
  socket.on('rate_player', ({ code, targetId, score }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const target = room.players.find(p => p.id === targetId);

    if (target && !target.isHR) {
      if (!target.score) {
        target.score = 0;
      }
      target.score += score;
    }

    io.to(code).emit('room_update', room);
  });

  // Начать финальное интервью
  socket.on('start_final', ({ code }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const hrPlayer = findPlayerBySocketId(room, socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может начать финал' });
      return;
    }

    const candidates = room.players.filter(p => !p.isHR);
    const sorted = [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
    room.finalists = sorted.slice(0, 2);
    room.phase = 'finalInterview';
    room.currentQuestionIndex = 0;
    room.currentPlayerIndex = 0;

    io.to(code).emit('room_update', room);
  });

  // Выбрать победителя
  socket.on('choose_winner', async ({ code, winnerId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const actor = findPlayerBySocketId(room, socket.id);
    if (!actor || !actor.isHR) {
      socket.emit('error', { message: 'Только HR может выбрать победителя' });
      console.log(`❌ Non-HR player tried to choose winner in room ${code}`);
      return;
    }

    const winnerPlayer = room.players.find(p => p.id === winnerId);
    
    if (!winnerPlayer) {
      socket.emit('error', { message: 'Игрок не найден' });
      console.error(`❌ Winner with id ${winnerId} not found in room ${code}`);
      return;
    }
    
    room.winner = {
      id: winnerPlayer.id,
      name: winnerPlayer.name,
      isHR: winnerPlayer.isHR,
      cards: winnerPlayer.cards || [],
      receivedTricks: winnerPlayer.receivedTricks || [],
      score: winnerPlayer.score || 0,
      isReady: winnerPlayer.isReady || false
    };
    
    room.phase = 'winner';

    console.log(`✅ Winner selected in room ${code}:`, room.winner.name, 'with', room.winner.cards?.length || 0, 'cards');
    
    // ✅ РАСШИРЕННАЯ АНАЛИТИКА: сохранение с won и position
    const candidates = room.players.filter(p => !p.isHR);
    
    // Сортируем кандидатов по баллам для определения позиций
    const sortedCandidates = [...candidates].sort((a, b) => (b.scoreFromHR || b.score || 0) - (a.scoreFromHR || a.score || 0));
    
    for (let position = 0; position < sortedCandidates.length; position++) {
      const player = sortedCandidates[position];
      const playerSocket = io.sockets.sockets.get(player.socketId);
      
      if (playerSocket && playerSocket.user) {
        try {
          const won = player.id === winnerId;
          
          await prisma.performance.create({
            data: {
              userId: playerSocket.user.id,
              roomCode: code,
              profession: room.currentProfession?.title || 'Неизвестно',
              score: player.scoreFromHR || player.score || null,
              won: won,
              position: position + 1 // 1-based position
            }
          });
          
          console.log(`📊 Performance saved for user ${playerSocket.user.login || playerSocket.user.email || playerSocket.user.id}: ${room.currentProfession?.title}, score: ${player.scoreFromHR || player.score}, won: ${won}, position: ${position + 1}`);
        } catch (error) {
          console.error(`❌ Failed to save performance for player ${player.name}:`, error);
        }
      }
    }
    
    io.to(code).emit('room_update', room);
  });

  // Переход к следующей фазе
  socket.on('next_phase', ({ code }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const hrPlayer = findPlayerBySocketId(room, socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может переключать фазы' });
      return;
    }

    if (room.phase === 'cardDistribution') {
      room.phase = 'selfPresentation';
      room.currentPlayerIndex = 0;
    } else if (room.phase === 'trickDistribution') {
      room.phase = 'candidateDefense';
      room.currentPlayerIndex = 0;
    }

    io.to(code).emit('room_update', room);
  });

  // Раскрыть карту
  socket.on('reveal_card', ({ code, cardId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const player = findPlayerBySocketId(room, socket.id);
    
    if (!player || player.isHR) {
      socket.emit('error', { message: 'Только игроки могут раскрывать карты' });
      return;
    }

    const card = player.cards?.find(c => c.id === cardId);
    
    if (!card) {
      socket.emit('error', { message: 'Карта не найдена' });
      return;
    }

    card.revealed = true;
    
    console.log(`✅ Player ${player.name} revealed card ${cardId} (${card.type})`);
    
    io.to(code).emit('room_update', room);
  });

  // Оценить игрока во время презентации
  socket.on('rate_during_presentation', ({ code, targetId, score }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const hrPlayer = findPlayerBySocketId(room, socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может оценивать' });
      return;
    }

    const targetPlayer = room.players.find(p => p.id === targetId);
    
    if (!targetPlayer || targetPlayer.isHR) {
      socket.emit('error', { message: 'Игрок не найден' });
      return;
    }

    targetPlayer.scoreFromHR = score;
    
    console.log(`✅ HR rated ${targetPlayer.name}: ${score}/10`);
    
    io.to(code).emit('room_update', room);
  });

  // Heartbeat
  socket.on('heartbeat', ({ code, playerId }) => {
    const room = rooms.get(code);
    if (!room) return;
    
    const player = findPlayerByPlayerId(room, playerId);
    if (player) {
      player.lastSeen = Date.now();
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`⚠️ Пользователь отключился: ${socket.id}`);
    
    rooms.forEach((room, roomCode) => {
      const player = findPlayerBySocketId(room, socket.id);
      
      if (player) {
        player.connected = false;
        player.lastSeen = Date.now();
        
        console.log(`🔌 Player ${player.name} (${player.id}) marked as offline in room ${roomCode}`);
        
        io.to(roomCode).emit('room_update', room);
      }
    });
  });
});

// =====================================================
// GRACE PERIOD CLEANUP
// =====================================================

setInterval(() => {
  const now = Date.now();
  
  rooms.forEach((room, roomCode) => {
    let roomChanged = false;
    const playersToRemove = [];
    
    room.players.forEach((player, index) => {
      if (player.connected === false && (now - player.lastSeen) > GRACE_PERIOD_MS) {
        console.log(`🧹 Removing player ${player.name} (${player.id}) from room ${roomCode} (offline for ${Math.round((now - player.lastSeen) / 1000)}s)`);
        playersToRemove.push(index);
        roomChanged = true;
      }
    });
    
    playersToRemove.reverse().forEach(index => {
      const player = room.players[index];
      room.players.splice(index, 1);
      
      if (player.isHR) {
        if (room.phase === 'lobby') {
          console.log(`🗑️  Removing room ${roomCode} (HR offline too long in lobby)`);
          rooms.delete(roomCode);
          io.to(roomCode).emit('error', { message: 'HR покинул комнату' });
          return;
        } else {
          console.log(`⚠️  HR offline too long in room ${roomCode} during game`);
        }
      }
    });
    
    if (rooms.has(roomCode) && roomChanged) {
      const activePlayers = room.players.filter(p => p.connected === true);
      
      if (activePlayers.length === 0) {
        console.log(`🗑️  Removing empty room ${roomCode} (no active players)`);
        rooms.delete(roomCode);
      } else {
        io.to(roomCode).emit('room_update', room);
      }
    }
  });
  
  console.log(`🧹 Cleanup complete. Active rooms: ${rooms.size}`);
}, CLEANUP_INTERVAL_MS);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🎮 Сервер игры запущен на http://localhost:${PORT}`);
  console.log(`♻️  Grace period cleanup: ${GRACE_PERIOD_MS / 1000}s, interval: ${CLEANUP_INTERVAL_MS / 1000}s`);
});

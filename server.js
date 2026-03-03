// server.js
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

const app = express();

// важно для secure cookies за nginx
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// CORS для cookie (НЕ "*")
app.use(cors({
  origin: 'https://approvegame.ru',
  credentials: true
}));

// =====================================================
// Хранилище комнат (ВАЖНО: ДО health endpoints)
// =====================================================
const rooms = new Map();

// Grace period для переподключения (2 минуты)
const GRACE_PERIOD_MS = 120000; // 120 секунд
const CLEANUP_INTERVAL_MS = 30000; // Проверять каждые 30 секунд

// =====================================================
// ИМПОРТ ДАННЫХ ИЗ ФАЙЛА (ТВОЙ КОД)
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

const PROFESSIONS = PROFESSION_DATA.map(p => p.name);

const ADDITION_IMAGES = [
  "dop-course.png","dop-dad.png","dop-excel.png","dop-fish.png","dop-foodcourse.png",
  "dop-grandmother.png","dop-joke.png","dop-kiosk.png","dop-lastwork.png","dop-mgu.png",
  "dop-million.png","dop-noski.png","dop-pirozhki.png","dop-sber.png","dop-tank.png"
];

const AGE_IMAGES = [
  "age18.png","age20.png","age22.png","age24.png","age26.png","age28.png","age30.png",
  "age32.png","age34.png","age36.png","age38.png","age40.png","age42.png","age44.png",
  "age46.png","age48.png","age50.png","age52.png","age54.png","age56.png","age58.png",
  "age60.png","age70.png","age80.png"
];

const SKILL_IMAGES = [
  "nav-analiz.png","nav-code.png","nav-cvet.png","nav-doc.png","nav-dogovor.png","nav-eskiz.png",
  "nav-finanaliz.png","nav-fingram.png","nav-graf.png","nav-help.png","nav-him.png","nav-isk.png",
  "nav-konsul.png","nav-lab.png","nav-lang.png","nav-med.png","nav-mimika.png","nav-ocen.png",
  "nav-ped.png","nav-po.png","nav-podstroy.png","nav-presech.png","nav-prodvi.png","nav-rech.png",
  "nav-rescom.png","nav-role.png","nav-smi.png","nav-state.png","nav-stroy.png","nav-tb.png",
  "nav-voronka.png","nav-web.png","nav-zabol.png","nav-zakon.png"
];

const QUALITY_IMAGES = [
  "kach-cder.png","kach-ches.png","kach-crea1.png","kach-crea2.png","kach-em1.png","kach-em2.png",
  "kach-nad1.png","kach-nad2.png","kach-nad3.png","kach-ob1.png","kach-ob2.png","kach-ob3.png",
  "kach-sprav.png","kach-stress.png","kach-terpel.png","kach-toch.png","kach-usid.png",
  "kach-vnimat1.png","kach-vnimat2.png"
];

const BAD_CARD_IMAGES = [
  "pod-1.png","pod-2.png","pod-3.png","pod-4.png","pod-5.png","pod-6.png","pod-7.png","pod-8.png",
  "pod-9.png","pod-10.png","pod-11.png","pod-12.png","pod-13.png","pod-14.png","pod-15.png",
  "pod-16.png","pod-17.png","pod-18.png","pod.png"
];

const AGES = ["14 лет","15 лет","16 лет","17 лет","18 лет","19 лет","20 лет"];

const SKILLS = [
  "воронка продаж","стратегия продвижения","анализ конкурентов","подбор цветовой схемы",
  "знание графических редакторов","оказание первой медицинской помощи","лечение различных заболеваний",
  "разработка ПО, сайтов","знание языков программирования","написание различных кодов",
  "знание основ педагогики и психологии","разработка индивидуального плана обучения",
  "предотвращение нарушения закона","знание законов РФ",
  "знание основ строительного дела и техники безопасности","выполнение строительно-монтажных работ",
  "знание иностранного языка","глубокие культурологические познания различных стран",
  "проведение расчетов для строительства","визуализация эскизов и чертежей","подготовка проектной документации",
  "составление договоров","составление исков","консультирование людей по их правам",
  "проведение психологических консультаций","помощь людям в сложных ситуациях","анализ финансовых показателей",
  "сбор информации для СМИ","навыки сценической речи","умение вживаться в роль",
  "владение своим телом, мимикой и артикуляцией","написание статей",
  "анализ химических реакций","проведение лабораторный исследований","консультирование людей по их правам",
  "оценка состояния конструкции","способность адаптироваться к любой ситуации","финансовая грамотность"
];

const QUALITIES = [
  "кретивность","кретивность","коммуникабельность","коммуникабельность","коммуникабельность",
  "стрессоустойчивость","усидчивость","внимательность","внимательность","эмпатия","эмпатия",
  "ответственность","ответственность","ответственность","исполнительность","терпеливость",
  "сжержанность","честность","справедливость"
];

const ADDITIONS = [
  "отец - директор компании","прошел курсы у инфоцыгана","окончил МГУ","прошел стажировку в Сбере",
  "отличные рекомендации с прошлого места работы","3 шаурмечных на районе","продает наставничество",
  "играет в танки с руководителем","регулярно проводит бабушек через дорогу","симпатизирует дочке руководитлч",
  "слушает только классическую музыку, никаких непристойностей!","знает всевозможные формулы Excel",
  "знает много анекдотов из одноклассников","каждые выходные будет звать на рыбалку",
  "не носит носки с сандалями","миллион подписчиков в соцсетях","каждый день всем приноси пирожки на работу!"
];

const SABOTAGES = [
  "постоянно опаздывает на работу более, чем на час",
  "каждый день засыпает на рабочем месте",
  "обманывает про свое прошлое место работы",
  "ни разу не пользовался интернетом",
  "забирает домой вещи с места работы",
  "избегает людей",
  "окончил только 9 классов школы",
  "игровая зависимость",
  "плохие отношения с руководителем",
  "очень конфликтный",
  "не любит работу в команде, необщительный",
  "неряшливый и неаккуратный сотрудник, вечно делает ошибки",
  "забирает домой вещи с места работы",
  "медленный, как ленивец из Зверополиса",
  "социофоб, впадает в панику от общения с клиентами",
  "гиперактивный, не в состоянии выполнять монотонную работу",
  "прокрастинатор, всегда находит отговорки и отсрочки выполнения задач",
  "не выполняет задачи в срок, срывает дедлайны"
];

// =====================================================
// ГЕНЕРАЦИЯ КОЛОДЫ
// =====================================================

function getQualityGroup(imageUrl) {
  const fileName = imageUrl.split('/').pop();
  const baseName = fileName.replace('.png', '');
  const group = baseName.replace(/\d+$/, '');
  return group;
}

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
      imageUrl
    });
  });

  SKILL_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `skill_${index + 1}`,
      type: 'skill',
      title: '',
      imageUrl
    });
  });

  QUALITY_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `quality_${index + 1}`,
      type: 'quality',
      title: '',
      imageUrl
    });
  });

  ADDITION_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `addition_${index + 1}`,
      type: 'addition',
      title: '',
      imageUrl
    });
  });

  return deck;
}

function generateSabotageDeck() {
  return BAD_CARD_IMAGES.map((imageUrl, index) => ({
    id: `trick_${index + 1}`,
    type: 'trick',
    title: '',
    imageUrl
  }));
}

// =====================================================
// ПРАВИЛА РАЗДАЧИ КАРТ
// =====================================================

function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

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
      player.cards.push({ ...ages[ageIndex], revealed: false });
      ageIndex++;
    }

    if (skillIndex < skills.length) {
      player.cards.push({ ...skills[skillIndex], revealed: false });
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
          player.cards.push({ ...qualities[qualityIndex], revealed: false });
          qualityIndex++;
        }
      }
    }

    if (additionIndex < additions.length) {
      player.cards.push({ ...additions[additionIndex], revealed: false });
      additionIndex++;
    }

    console.log(`✅ Player ${player.name} received ${player.cards.length} cards`);
  });

  const shuffledSabotages = shuffle([...room.sabotageDeck]);
  candidates.forEach((player, index) => {
    if (index < shuffledSabotages.length) {
      const trickCard = { ...shuffledSabotages[index], revealed: true };
      player.cards.push(trickCard);
      console.log(`✅ Player ${player.name} received trick card (revealed)`);
    }
  });
}

// =====================================================
// AUTH HELPERS
// =====================================================

async function getUserFromSessionId(sessionId) {
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user || null;
}

// =====================================================
// HEALTH ENDPOINTS
// =====================================================

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
  });
});

// =====================================================
// AUTH ENDPOINTS (GOOGLE + COOKIE)
// =====================================================

app.post('/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: 'Invalid token' });

    const googleId = payload.sub;
    const email = payload.email || null;
    const name = payload.name || 'User';
    const avatarUrl = payload.picture || null;

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await prisma.user.create({
        data: { googleId, email, name, avatarUrl },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email, name, avatarUrl },
      });
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: { userId: user.id, expiresAt },
    });

    // ⚠️ cross-domain cookie -> SameSite=None + Secure
    res.cookie('sessionId', session.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    return res.json({ user });
  } catch (e) {
    console.error('POST /auth/google error:', e);
    return res.status(500).json({ message: 'Auth failed' });
  }
});

app.get('/me', async (req, res) => {
  try {
    const sessionId = req.cookies?.sessionId;
    const user = await getUserFromSessionId(sessionId);
    if (!user) return res.status(401).json({ user: null });
    return res.json({ user });
  } catch (e) {
    console.error('GET /me error:', e);
    return res.status(500).json({ message: 'Failed' });
  }
});

app.post('/logout', async (req, res) => {
  try {
    const sessionId = req.cookies?.sessionId;

    if (sessionId) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    }

    res.clearCookie('sessionId', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /logout error:', e);
    return res.status(500).json({ ok: false });
  }
});

// =====================================================
// SOCKET.IO
// =====================================================

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "https://approvegame.ru",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// cookie parsing для socket
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=');
    out[k] = decodeURIComponent(v.join('=') || '');
  });
  return out;
}

// socket auth middleware (гостей НЕ блокируем)
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers?.cookie;
    const cookies = parseCookies(cookieHeader);
    const sessionId = cookies.sessionId;

    const user = await getUserFromSessionId(sessionId);
    socket.user = user || null;

    return next();
  } catch (e) {
    console.error('socket auth middleware error:', e);
    socket.user = null;
    return next();
  }
});

// =====================================================
// HELPER FUNCTIONS (players)
// =====================================================

function findPlayerBySocketId(room, socketId) {
  return room.players.find(p => p.socketId === socketId);
}

function findPlayerByPlayerId(room, playerId) {
  return room.players.find(p => p.id === playerId);
}

// =====================================================
// CREATE ROOM
// =====================================================

function createRoom(roomCode, playerId, socketId, creatorName, gameMode = 'group') {
  const room = {
    code: roomCode,
    hostId: playerId,
    players: [
      {
        id: playerId,
        socketId: socketId,
        userId: null, // привяжем ниже
        name: creatorName,
        isHR: true,
        connected: true,
        lastSeen: Date.now(),
        cards: [],
        badCards: [],
        score: 0,
        isReady: false
      }
    ],
    phase: 'lobby',
    gameMode: gameMode,
    currentPlayerIndex: 0,
    deck: shuffle(generateCardDeck()),
    sabotageDeck: shuffle(generateSabotageDeck()),
    finalists: [],
    winner: null,
    currentProfession: null,
    currentQuestionIndex: 0,
  };

  rooms.set(roomCode, room);
  return room;
}

// =====================================================
// SOCKET EVENTS (ТВОЙ КОД + ДОБАВЛЕН userId)
// =====================================================

io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id} user=${socket.user ? socket.user.id : 'guest'}`);

  // Создать комнату
  socket.on('create_room', ({ name, gameMode = 'group', playerId, avatarId }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomCode, playerId, socket.id, name, gameMode);

    // привязка к google user (если есть)
    room.players[0].userId = socket.user ? socket.user.id : null;
    room.players[0].avatarId = avatarId;

    socket.join(roomCode);
    socket.emit('room_update', room);

    console.log(`✅ Комната создана: ${roomCode} by ${name} (режим: ${gameMode}, playerId: ${playerId})`);
  });

  // Присоединиться к комнате
  socket.on('join_room', ({ code, name, playerId, avatarId }) => {
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const existingPlayer = findPlayerByPlayerId(room, playerId);

    if (existingPlayer) {
      console.log(`🔄 Player reconnecting: ${name} (playerId: ${playerId}) to room ${code}`);

      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      existingPlayer.lastSeen = Date.now();

      // если залогинен — сохраняем userId
      if (socket.user) existingPlayer.userId = socket.user.id;
      if (avatarId) existingPlayer.avatarId = avatarId;

      socket.join(code);
      socket.emit('rejoin_ok', { code });
      io.to(code).emit('room_update', room);

      console.log(`✅ ${name} reconnected successfully`);
      return;
    }

    if (room.phase !== 'lobby') {
      socket.emit('error', { message: 'Игра уже началась' });
      return;
    }

    const now = Date.now();
    const nameIsTaken = room.players.some(p => {
      if (p.name !== name || p.id === playerId) return false;
      if (p.connected === true) return true;
      if (p.connected === false && (now - p.lastSeen) < GRACE_PERIOD_MS) return true;
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
      userId: socket.user ? socket.user.id : null, // <-- ВАЖНО для аналитики
      name: name,
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
    io.to(code).emit('player_joined', { playerName: name });

    console.log(`➕ New player ${name} joined ${code} (playerId: ${playerId})`);
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
    } else if (room.phase === 'trickDistribution') {
      room.phase = 'candidateDefense';
      room.currentPlayerIndex = 0;
    } else if (room.phase === 'candidateDefense') {
      room.currentPlayerIndex++;

      if (room.currentPlayerIndex >= candidates.length) {
        const sorted = [...candidates].sort((a, b) => (b.scoreFromHR || 0) - (a.scoreFromHR || 0));
        room.finalists = sorted.slice(0, 2);
        room.phase = 'finalInterview';
        room.currentQuestionIndex = 0;
        room.currentPlayerIndex = 0;
      }
    } else if (room.phase === 'finalInterview') {
      const finalists = room.finalists || [];
      const totalQuestions = 3;

      if (typeof room.currentQuestionIndex === 'undefined') room.currentQuestionIndex = 0;
      if (typeof room.currentPlayerIndex === 'undefined') room.currentPlayerIndex = 0;

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

  // Подкинуть подлянку (старое)
  socket.on('give_sabotage', ({ code, targetId }) => {
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const targetPlayer = room.players.find(p => p.id === targetId);
    if (targetPlayer) {
      if (!targetPlayer.badCards) targetPlayer.badCards = [];

      const giver = findPlayerBySocketId(room, socket.id);
      if (giver && giver.badCards && giver.badCards.length > 0) {
        const sabotage = giver.badCards.shift();
        targetPlayer.badCards.push(sabotage);
      }
    }

    io.to(code).emit('room_update', room);
  });

  // Передать подлянку (новая механика)
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

      if (!targetPlayer.cards) targetPlayer.cards = [];

      trickCard.revealed = true;
      targetPlayer.cards.push(trickCard);

      console.log(`✅ ${giver.name} передал подлянку игроку ${targetPlayer.name}`);
    }

    io.to(code).emit('room_update', room);
  });

  // Оценка зрителей (totalScore)
  socket.on('rate_player', ({ code, targetId, score }) => {
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const target = room.players.find(p => p.id === targetId);

    if (target && !target.isHR) {
      if (!target.score) target.score = 0;
      target.score += score;
    }

    io.to(code).emit('room_update', room);
  });

  // Начать финал
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

  // Выбрать победителя + сохранить аналитику в Postgres
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
      scoreFromHR: typeof winnerPlayer.scoreFromHR === 'number' ? winnerPlayer.scoreFromHR : null,
      isReady: winnerPlayer.isReady || false
    };

    room.phase = 'winner';

    // ====== SAVE ANALYTICS ======
    try {
      const professionTitle = room.currentProfession?.title || 'Unknown';
      const candidates = room.players.filter(p => !p.isHR);

      await Promise.allSettled(
        candidates
          .filter(p => p.userId) // только залогиненные
          .map(p => prisma.performance.create({
            data: {
              userId: p.userId,
              profession: professionTitle,
              scoreFromHR: typeof p.scoreFromHR === 'number' ? p.scoreFromHR : null,
              totalScore: typeof p.score === 'number' ? p.score : null,
              tricksCount: Array.isArray(p.cards) ? p.cards.filter(c => c.type === 'trick').length : null
            }
          }))
      );

      console.log(`📊 Saved performances for room ${code}`);
    } catch (e) {
      console.error('Failed to save performances:', e);
    }
    // ===========================

    console.log(`✅ Winner selected in room ${code}:`, room.winner.name);
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

  // HR оценивает во время презентации
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
    if (player) player.lastSeen = Date.now();
  });

  // disconnect: пометить offline
  socket.on('disconnect', () => {
    console.log(`⚠️ Пользователь отключился: ${socket.id}`);

    rooms.forEach((room, roomCode) => {
      const player = findPlayerBySocketId(room, socket.id);

      if (player) {
        player.connected = false;
        player.lastSeen = Date.now();

        console.log(`🔌 Player ${player.name} (${player.id}) marked offline in room ${roomCode}`);
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
        console.log(`🧹 Removing player ${player.name} (${player.id}) from room ${roomCode}`);
        playersToRemove.push(index);
        roomChanged = true;
      }
    });

    playersToRemove.reverse().forEach(index => {
      const player = room.players[index];
      room.players.splice(index, 1);

      if (player.isHR) {
        if (room.phase === 'lobby') {
          console.log(`🗑️ Removing room ${roomCode} (HR offline too long in lobby)`);
          rooms.delete(roomCode);
          io.to(roomCode).emit('error', { message: 'HR покинул комнату' });
          return;
        } else {
          console.log(`⚠️ HR offline too long in room ${roomCode} during game`);
        }
      }
    });

    if (rooms.has(roomCode) && roomChanged) {
      const activePlayers = room.players.filter(p => p.connected === true);

      if (activePlayers.length === 0) {
        console.log(`🗑️ Removing empty room ${roomCode}`);
        rooms.delete(roomCode);
      } else {
        io.to(roomCode).emit('room_update', room);
      }
    }
  });

  console.log(`🧹 Cleanup complete. Active rooms: ${rooms.size}`);
}, CLEANUP_INTERVAL_MS);

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🎮 Сервер игры запущен на http://localhost:${PORT}`);
  console.log(`♻️ Grace period cleanup: ${GRACE_PERIOD_MS / 1000}s, interval: ${CLEANUP_INTERVAL_MS / 1000}s`);
});

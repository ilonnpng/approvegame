const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

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

const AGES = [
  "14 лет",
  "15 лет",
  "16 лет",
  "17 лет",
  "18 лет",
  "19 лет",
  "20 лет"
];

const SKILLS = [
  "воронка продаж",
  "стратегия продвижения",
  "анализ конкурентов",
  "подбор цветовой схемы",
  "знание графических редакторов",
  "оказание первой медицинской помощи",
  "лечение различных заболеваний",
  "разработка ПО, сайтов",
  "знание языков программирования",
  "написание различных кодов",
  "знание основ педагогики и психологии",
  "разработка индивидуального плана обучения",
  "предотвращение нарушения закона",
  "знание законов РФ",
  "знание основ строительного дела и техники безопасности",
  "выполнение строительно-монтажных работ",
  "знание иностранного языка",
  "глубокие культурологические познания различных стран",
  "проведение расчетов для строительства",
  "визуализация эскизов и чертежей",
  "подготовка проектной документации",
  "составление договоров",
  "составление исков",
  "консультирование людей по их правам",
  "проведение психологических консультаций",
  "помощь людям в сложных ситуациях",
  "анализ финансовых показателей",
  "сбор информации для СМИ",
  "навыки сценической речи",
  "умение вживаться в роль",
  "владение своим телом, мимикой и артикуляцией",
  "написание статей",
  "анализ химических реакций",
  "проведение лабораторный исследований",
  "консультирование людей по их правам",
  "оценка состояния конструкции",
  "способность адаптироваться к любой ситуации",
  "финансовая грамотность"
];

const QUALITIES = [
  "кретивность",
  "кретивность",
  "коммуникабельность",
  "коммуникабельность",
  "коммуникабельность",
  "стрессоустойчивость",
  "усидчивость",
  "внимательность",
  "внимательность",
  "эмпатия",
  "эмпатия",
  "ответственность",
  "ответственность",
  "ответственность",
  "исполнительность",
  "терпеливость",
  "сжержанность",
  "честность",
  "справедливость"
];

const ADDITIONS = [
  "отец - директор компании",
  "прошел курсы у инфоцыгана",
  "окончил МГУ",
  "прошел стажировку в Сбере",
  "отличные рекомендации с прошлого места работы",
  "3 шаурмечных на районе",
  "продает наставничество",
  "играет в танки с руководителем",
  "регулярно проводит бабушек через дорогу",
  "симпатизирует дочке руководитлч",
  "слушает только классическую музыку, никаких непристойностей!",
  "знает всевозможные формулы Excel",
  "знает много анекдотов из одноклассников",
  "каждые выходные будет звать на рыбалку",
  "не носит носки с сандалями",
  "миллион подписчиков в соцсетях",
  "каждый день всем приносит пирожки на работу!"
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

// Определить группу качества по URL изображения
// Примеры:
// "https://.../kach-nad1.png" -> "kach-nad"
// "https://.../kach-nad2.png" -> "kach-nad"
// "https://.../kach-stress.png" -> "kach-stress"
function getQualityGroup(imageUrl) {
  // Извлечь имя файла из URL
  const fileName = imageUrl.split('/').pop(); // "kach-nad1.png"
  const baseName = fileName.replace('.png', ''); // "kach-nad1"
  
  // Убрать числовой суффикс (если есть)
  const group = baseName.replace(/\d+$/, ''); // "kach-nad"
  
  return group;
}

// Генерировать колоду карт из массивов данных
function generateCardDeck() {
  const deck = [];
  
  // Добавить профессии с полными данными
  PROFESSION_DATA.forEach((professionData, index) => {
    deck.push({
      id: `prof_${index + 1}`,
      type: 'profession',
      title: professionData.name,
      professionData: professionData // Добавляем полные данные профессии
    });
  });
  
  // Добавить возраст
  AGE_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `age_${index + 1}`,
      type: 'age',
      title: '', // Текст больше не используется
      imageUrl: imageUrl // Сохраняем только URL изображения
    });
  });
  
  // Генерировать карточки навыков
  SKILL_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `skill_${index + 1}`,
      type: 'skill',
      title: '', // Текст больше не используется
      imageUrl: imageUrl // Сохраняем только URL изображения
    });
  });
  
  // Генерировать карточки качеств
  QUALITY_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `quality_${index + 1}`,
      type: 'quality',
      title: '', // Текст больше не используется
      imageUrl: imageUrl // Сохраняем только URL изображения
    });
  });
  
  // Генерировать карточки дополнений
  ADDITION_IMAGES.forEach((imageUrl, index) => {
    deck.push({
      id: `addition_${index + 1}`,
      type: 'addition',
      title: '', // Текст больше не используется
      imageUrl: imageUrl // Сохраняем только URL изображения
    });
  });
  
  return deck;
}

// Генерировать колоду подлянок
function generateSabotageDeck() {
  return BAD_CARD_IMAGES.map((imageUrl, index) => ({
    id: `trick_${index + 1}`,
    type: 'trick',
    title: '', // Текст больше не используется
    imageUrl: imageUrl // Сохраняем только URL изображения
  }));
}

// =====================================================
// ПРАВИЛА РАЗДАЧИ КАРТ
// =====================================================
// Каждый игрок получает РОВНО 7 карточек:
// - 1 Профессия
// - 1 Возраст
// - 1 Навык
// - 2 Качества
// - 1 Дополнение
// - 1 Подлянка (раздается позже в фазе trickDistribution)

// Раздать карты игрокам по правилам
function dealCards(room) {
  const candidates = room.players.filter(p => !p.isHR);
  
  // Выбрать ОДНУ профессию для всех игроков
  const professions = shuffle(room.deck.filter(c => c.type === 'profession'));
  const currentProfession = professions.length > 0 
    ? { ...professions[0], revealed: true } 
    : null;
  
  // Сохранить профессию на уровне комнаты
  room.currentProfession = currentProfession;
  
  // Создать отдельные колоды для каждого типа
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
    
    // 1. Одна профессия (одинаковая для ВСЕХ, всегда раскрыта)
    if (currentProfession) {
      player.cards.push({ ...currentProfession, revealed: true });
    }
    
    // 2. Один возраст
    if (ageIndex < ages.length) {
      const card = { ...ages[ageIndex], revealed: false };
      player.cards.push(card);
      ageIndex++;
    }
    
    // 3. Один навык
    if (skillIndex < skills.length) {
      const card = { ...skills[skillIndex], revealed: false };
      player.cards.push(card);
      skillIndex++;
    }
    
    // 4. Два качества (НЕ из одной группы!)
    // Алгоритм:
    // 1. Выбрать первое качество случайно
    // 2. Определить его группу
    // 3. Исключить все качества из этой группы
    // 4. Выбрать второе качество из оставшихся
    
    if (qualities.length >= 2) {
      // Первое качество
      const firstQuality = { ...qualities[qualityIndex], revealed: false };
      player.cards.push(firstQuality);
      const firstGroup = getQualityGroup(firstQuality.imageUrl);
      qualityIndex++;
      
      // Найти второе качество из другой группы
      let secondQuality = null;
      let searchIndex = qualityIndex;
      
      while (searchIndex < qualities.length && !secondQuality) {
        const candidate = qualities[searchIndex];
        const candidateGroup = getQualityGroup(candidate.imageUrl);
        
        // Проверить, что это другая группа
        if (candidateGroup !== firstGroup) {
          secondQuality = { ...candidate, revealed: false };
          // Удалить из колоды и вставить на место qualityIndex
          qualities.splice(searchIndex, 1);
          qualities.splice(qualityIndex, 0, candidate);
          break;
        }
        searchIndex++;
      }
      
      // Если нашли качество из другой группы, добавить его
      if (secondQuality) {
        player.cards.push(secondQuality);
        qualityIndex++;
      } else {
        // Если не нашли (маловероятно), добавить следующее по порядку
        console.warn(`⚠️ Не удалось найти качество из другой группы для игрока ${player.name}`);
        if (qualityIndex < qualities.length) {
          const card = { ...qualities[qualityIndex], revealed: false };
          player.cards.push(card);
          qualityIndex++;
        }
      }
    }
    
    // 5. Одно дополнение
    if (additionIndex < additions.length) {
      const card = { ...additions[additionIndex], revealed: false };
      player.cards.push(card);
      additionIndex++;
    }
    
    console.log(`✅ Player ${player.name} received ${player.cards.length} cards:`, 
      player.cards.map(c => `${c.type}: ${c.title}`).join(', '));
  });
  
  // 6. Раздать подлянки (добавляются в общую колоду cards, сразу раскрыты чтобы игроки видели при передаче)
  const shuffledSabotages = shuffle([...room.sabotageDeck]);
  candidates.forEach((player, index) => {
    if (index < shuffledSabotages.length) {
      const trickCard = { ...shuffledSabotages[index], revealed: true }; // Подлянки сразу раскрыты!
      player.cards.push(trickCard);
      console.log(`✅ Player ${player.name} received trick card in hand (revealed)`);
    }
  });
}

// =====================================================
// СЕРВЕР
// =====================================================

// Health check endpoint для проверки работоспособности сервера
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

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // WebSocket для продакшн (wss://)
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Хранилище комнат
const rooms = new Map();

// Перемешать массив
function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Создать новую комнату
function createRoom(roomCode, creatorId, creatorName, gameMode = 'group') {
  const room = {
    code: roomCode,
    hostId: creatorId,
    players: [
      {
        id: creatorId,
        name: creatorName,
        isHR: true,
        cards: [],
        badCards: [],
        score: 0,
        isReady: false
      }
    ],
    phase: 'lobby',
    gameMode: gameMode, // Режим игры: 'group' или 'audience'
    currentPlayerIndex: 0,
    deck: shuffle(generateCardDeck()),
    sabotageDeck: shuffle(generateSabotageDeck()),
    finalists: [],
    winner: null
  };
  
  rooms.set(roomCode, room);
  return room;
}

io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`);

  // Создать комнату
  socket.on('create_room', ({ name, gameMode = 'group' }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(roomCode, socket.id, name, gameMode);
    
    socket.join(roomCode);
    socket.emit('room_update', room);
    
    console.log(`Комната создана: ${roomCode} by ${name} (режим: ${gameMode})`);
  });

  // Присоединиться к комнате
  socket.on('join_room', ({ code, name }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    // Проверить, не присоединялся ли уже (по имени для переподключения)
    const existingPlayerByName = room.players.find(p => p.name === name);
    const existingPlayerById = room.players.find(p => p.id === socket.id);
    
    if (existingPlayerByName && !existingPlayerById) {
      // Это может быть переподключение ИЛИ попытка войти с занятым ником
      // Проверяем: если игрок с таким именем уже есть и активен - отклоняем
      const existingSocket = io.sockets.sockets.get(existingPlayerByName.id);
      if (existingSocket && existingSocket.connected) {
        // Имя занято активным игроком
        socket.emit('error', { message: 'Это имя уже занято. Придумайте другое имя.' });
        console.log(`❌ Player tried to join with duplicate name: ${name} in room ${code}`);
        return;
      }
      
      // Переподключение - обновить socket.id
      console.log(`🔄 Player ${name} reconnecting to ${code}, updating socket ID from ${existingPlayerByName.id} to ${socket.id}`);
      existingPlayerByName.id = socket.id;
      
      // Если это был HR, обновить hostId
      if (existingPlayerByName.isHR) {
        room.hostId = socket.id;
        console.log(`✅ HR reconnected, updated hostId to ${socket.id}`);
      }
    } else if (!existingPlayerById && !existingPlayerByName) {
      // Новый игрок
      if (room.phase !== 'lobby') {
        socket.emit('error', { message: 'Игра уже началась' });
        return;
      }
      
      room.players.push({
        id: socket.id,
        name: name,
        isHR: false,
        cards: [],
        badCards: [],
        score: 0,
        isReady: false
      });
      console.log(`➕ New player ${name} joined ${code}`);
    } else {
      console.log(`✅ Player ${name} already in room ${code}`);
    }

    socket.join(code);
    io.to(code).emit('room_update', room);
    
    if (!existingPlayerByName && !existingPlayerById) {
      io.to(code).emit('player_joined', { playerName: name });
    }
    
    console.log(`${name} в комнате ${code}`);
  });

  // Начать игру
  socket.on('start_game', ({ code }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const hrPlayer = room.players.find(p => p.id === socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может начать игру' });
      return;
    }

    const candidates = room.players.filter(p => !p.isHR);
    if (candidates.length < 2) {
      socket.emit('error', { message: 'Нужно минимум 2 кандидата' });
      return;
    }

    // Фаза 1: Раздача карт
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

    // Фаза 2: Самопрезентация
    if (room.phase === 'selfPresentation') {
      room.currentPlayerIndex++;
      
      if (room.currentPlayerIndex >= candidates.length) {
        // Все выступили, переходим к раздаче подлянок
        room.phase = 'trickDistribution';
        room.currentPlayerIndex = 0;
      }
    }
    // Фаза 3: Раздача подлянок
    else if (room.phase === 'trickDistribution') {
      // После раздачи подлянок переходим к защите
      room.phase = 'candidateDefense';
      room.currentPlayerIndex = 0;
    }
    // Фаза 4: Защита от подлянок
    else if (room.phase === 'candidateDefense') {
      room.currentPlayerIndex++;
      
      if (room.currentPlayerIndex >= candidates.length) {
        // Все защитились, сразу переход к финальному интервью
        // Выбрать топ-2 по баллам (финалисты)
        const sorted = [...candidates].sort((a, b) => (b.scoreFromHR || 0) - (a.scoreFromHR || 0));
        room.finalists = sorted.slice(0, 2);
        room.phase = 'finalInterview';
        room.currentQuestionIndex = 0;
        room.currentPlayerIndex = 0;
      }
    }
    // Фаза 7: Финальное интервью
    else if (room.phase === 'finalInterview') {
      const finalists = room.finalists || [];
      const totalQuestions = 3; // Всего 3 вопроса
      
      // Инициализация индексов если не существуют
      if (typeof room.currentQuestionIndex === 'undefined') {
        room.currentQuestionIndex = 0;
      }
      if (typeof room.currentPlayerIndex === 'undefined') {
        room.currentPlayerIndex = 0;
      }
      
      // Переход к следующему финалисту
      room.currentPlayerIndex++;
      
      if (room.currentPlayerIndex >= finalists.length) {
        // Все финалисты ответили на текущий вопрос
        room.currentPlayerIndex = 0;
        room.currentQuestionIndex++;
        
        if (room.currentQuestionIndex >= totalQuestions) {
          // Все вопросы заданы, переход к выбору победителя
          room.phase = 'chooseWinner'; // Изменено: теперь переход к выбору победителя
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
      // Добавить подлянку от текущего игрока
      const giver = room.players.find(p => p.id === socket.id);
      if (giver && giver.badCards && giver.badCards.length > 0) {
        const sabotage = giver.badCards.shift(); // Взять первую подлянку
        targetPlayer.badCards.push(sabotage);
      }
    }

    io.to(code).emit('room_update', room);
  });

  // Передать подлянку другому игроку (новая механика)
  socket.on('distribute_trick', ({ code, targetId, cardId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const giver = room.players.find(p => p.id === socket.id);

    if (!giver || giver.isHR) {
      socket.emit('error', { message: 'Только игроки могут передавать подлянки' });
      return;
    }

    // Найти подлянку в картах отправителя
    const trickCardIndex = giver.cards.findIndex(c => c.id === cardId && c.type === 'trick');
    
    if (trickCardIndex === -1) {
      socket.emit('error', { message: 'Подлянка не найдена' });
      return;
    }

    // Взять подлянку из колоды отправителя
    const trickCard = giver.cards.splice(trickCardIndex, 1)[0];

    // Если targetId не указан или это сам игрок - оставить себе (раскрытой)
    if (!targetId || targetId === giver.id) {
      trickCard.revealed = true; // Подлянка остаётся раскрытой
      giver.cards.push(trickCard);
      console.log(`✅ ${giver.name} оставил подлянку себе`);
    } else {
      // Передать другому игроку (РАСКРЫТОЙ - все должны видеть что передаётся!)
      const targetPlayer = room.players.find(p => p.id === targetId);

      if (!targetPlayer || targetPlayer.isHR) {
        socket.emit('error', { message: 'Целевой игрок не найден' });
        return;
      }

      // Добавить подлянку в колоду получателя (РАСКРЫТОЙ - все видят её!)
      if (!targetPlayer.cards) {
        targetPlayer.cards = [];
      }
      
      trickCard.revealed = true; // Подлянки всегда раскрыты после раздачи!
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
      // Сохранить оценку
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

    const hrPlayer = room.players.find(p => p.id === socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может начать финал' });
      return;
    }

    // Выбрать топ-2 по баллам (финалисты)
    const candidates = room.players.filter(p => !p.isHR);
    const sorted = [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
    room.finalists = sorted.slice(0, 2);
    room.phase = 'finalInterview';
    // Инициализация индексов для финального интервью
    room.currentQuestionIndex = 0;
    room.currentPlayerIndex = 0;

    io.to(code).emit('room_update', room);
  });

  // Выбрать победителя
  socket.on('choose_winner', ({ code, winnerId }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    // Найти HR игрока по hostId или по isHR флагу
    const hrPlayer = room.players.find(p => p.isHR);
    const isHRSocket = socket.id === room.hostId || socket.id === hrPlayer?.id;
    
    if (!isHRSocket) {
      socket.emit('error', { message: 'Только HR может выбрать победителя' });
      return;
    }

    // Найти победителя и убедиться, что у него есть все данные
    const winnerPlayer = room.players.find(p => p.id === winnerId);
    
    if (!winnerPlayer) {
      socket.emit('error', { message: 'Игрок не найден' });
      console.error(`❌ Winner with id ${winnerId} not found in room ${code}`);
      return;
    }
    
    // Создать полную копию победителя с всеми данными
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
    io.to(code).emit('room_update', room);
  });

  // Переход к следующей фазе (универсальная команда)
  socket.on('next_phase', ({ code }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    const hrPlayer = room.players.find(p => p.id === socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может переключать фазы' });
      return;
    }

    // Переход между фазами
    if (room.phase === 'cardDistribution') {
      // Раздача карт -> Самопрезен��ация
      room.phase = 'selfPresentation';
      room.currentPlayerIndex = 0;
    } else if (room.phase === 'trickDistribution') {
      // Раздача подлянок -> Защита
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

    // Найти игрока, который раскрывает карту
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player || player.isHR) {
      socket.emit('error', { message: 'Только игроки могут раскрывать карты' });
      return;
    }

    // Найти карту у этого игрока
    const card = player.cards?.find(c => c.id === cardId);
    
    if (!card) {
      socket.emit('error', { message: 'Карта не найдена' });
      return;
    }

    // Раскрыть карту
    card.revealed = true;
    
    console.log(`✅ Player ${player.name} revealed card ${cardId} (${card.type})`);
    
    // Отправить обновление всем участникам
    io.to(code).emit('room_update', room);
  });

  // Оценить игрока во время презентации (HR)
  socket.on('rate_during_presentation', ({ code, targetId, score }) => {
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }

    // Проверить, что это HR
    const hrPlayer = room.players.find(p => p.id === socket.id);
    if (!hrPlayer || !hrPlayer.isHR) {
      socket.emit('error', { message: 'Только HR может оценивать' });
      return;
    }

    // Найти целевого игрока
    const targetPlayer = room.players.find(p => p.id === targetId);
    
    if (!targetPlayer || targetPlayer.isHR) {
      socket.emit('error', { message: 'Игрок не найден' });
      return;
    }

    // Установить оценку от HR (1-10)
    targetPlayer.scoreFromHR = score;
    
    console.log(`✅ HR rated ${targetPlayer.name}: ${score}/10`);
    
    // Отправить обновление всем участникам
    io.to(code).emit('room_update', room);
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`Пользователь отключился: ${socket.id}`);
    
    // Задержка перед удалением игрока (на случай переподключения)
    setTimeout(() => {
      // Найти комнату и удалить игрока
      rooms.forEach((room, roomCode) => {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          
          // Если это HR и игра не началась - удалить комнату
          if (player.isHR && room.phase === 'lobby') {
            rooms.delete(roomCode);
            io.to(roomCode).emit('error', { message: 'HR покинул комнату' });
          } else if (player.isHR && room.phase !== 'lobby') {
            // HR отключился во время игры - не удаляем, но уведомляем
            console.log(`⚠️ HR временно отключился в комнате ${roomCode}, игра на паузе`);
            // Не удаляем игрока, ждем переподключения
          } else {
            // Обычный игрок покинул игру
            room.players.splice(playerIndex, 1);
            io.to(roomCode).emit('room_update', room);
            io.to(roomCode).emit('player_left', { playerName: player.name });
          }
        }
      });
    }, 2000); // Задержка 2 секунды для переподключения
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🎮 Сервер игры запущен на http://localhost:${PORT}`);
});

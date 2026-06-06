-- =====================================================================
--  Зотов.Навигатор — тестовые данные (сидинг)
--
--  Реальная структура Хлебозавода №5 / Центра «Зотов»:
--    Этаж 1   — Форум: вход, касса, кафе, магазин (основной цилиндр, R=20)
--    Этаж 1.5 — Антресоль: гардероб, камеры хранения (пристройка снаружи, R=20–27)
--    Этаж 2   — Выставочные залы A/B/C + Детский клуб (цилиндр, R=20)
--    Этаж 2.5 — Переход: санузел (пристройка, R=20–27)
--    Этаж 3   — Выставочные залы D/E (цилиндр, R=20)
--    Этаж 4   — Зотов.Кино, Лекторий, Магазин (цилиндр, R=20)
--
--  Зоны цилиндрических этажей: radius_inner=6, radius_outer=20
--  Зоны пристроек (антресолей): radius_inner=20, radius_outer=27
--  Лестница и лифт — башня снаружи цилиндра: radius_inner=19.5, radius_outer=23
-- =====================================================================

-- ---------- ЭТАЖИ ----------
INSERT INTO floor (id, number, name, height_meters, radius_meters, color, description) VALUES
 (1, 1.0, 'Первый этаж — Форум',           4.0, 20.0, '#A5A5A5',
  'Свободный вход. Информационная стойка, кассы, кафе, магазин «Зотов.Вещь!», туалеты.'),
 (2, 1.5, 'Антресоль — Гардероб',          2.0, 27.0, '#6B5B95',
  'Пристройка между 1-м и 2-м этажами. Бесплатный гардероб, камеры хранения, туалеты.'),
 (3, 2.0, 'Второй этаж — Выставки',        4.0, 20.0, '#FF0068',
  'Основные выставочные залы A, B, C. Детский клуб.'),
 (4, 2.5, 'Переход 2½ — Технический уровень', 2.0, 27.0, '#9C9C9C',
  'Промежуточная площадка лестничной башни между 2-м и 3-м этажами. Санузел.'),
 (5, 3.0, 'Третий этаж — Выставки',        4.0, 20.0, '#CC0055',
  'Выставочные залы D и E. Продолжение экспозиции.'),
 (6, 4.0, 'Четвёртый этаж — Кино и Лекторий', 4.0, 20.0, '#083297',
  'Кинотеатр «Зотов.Кино», лекторий, магазин «Зотов.Вещь!» (вторая точка).');

-- ---------- ЗОНЫ ----------

-- ===== Этаж 1 (floor_id=1) — Форум =====
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (1,  'Главный вход',            'ENTRANCE',  1, 310, 360,  6, 20, '#111111',
      'Главный вход в Центр «Зотов» со стороны ул. Ходынской. Вход свободный.', 'entrance'),
 (2,  'Форум',                   'PUBLIC',    1,   0,  85,  6, 20, '#8C8C8C',
      'Общественное пространство 1 этажа. Бесплатный вход, временные выставки, зона отдыха.', 'public'),
 (3,  'Кафе «Зотов»',           'CAFE',      1,  85, 195,  6, 20, '#D99A2B',
      'Кафе с авторской кухней. Кофе, завтраки, обеды, десерты. Открыто с 11:00.', 'cafe'),
 (4,  'Магазин «Зотов.Вещь!»',  'SHOP',      1, 195, 310,  6, 20, '#C8C8C8',
      'Концепт-стор: книги по искусству и конструктивизму, сувениры, дизайнерские объекты.', 'shop'),
 (5,  'Туалеты (1 этаж)',        'RESTROOM',  1, 280, 312,  6, 20, '#3A8C8C',
      'Санузлы первого этажа. Доступный туалет — в зоне кафе.', 'restroom'),
 (6,  'Лестница (1 этаж)',       'STAIRS',    1, 208, 222, 19.5, 23, '#9C9C9C',
      'Лестничная башня. Подъём на все этажи и антресоль.', 'stairs'),
 (7,  'Лифт (1 этаж)',           'ELEVATOR',  1, 194, 208, 19.5, 23, '#B0B0B0',
      'Пассажирский лифт для посетителей с ограниченными возможностями.', 'elevator');

-- ===== Этаж 1.5 (floor_id=2) — Антресоль: Гардероб =====
-- Пристройка снаружи цилиндра: radius_inner=20, radius_outer=27
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (8,  'Гардероб',                'WARDROBE',  2, 140, 290, 20, 27, '#6B5B95',
      'Бесплатный гардероб. Камеры хранения. Обязателен при посещении выставок.', 'wardrobe'),
 (9,  'Туалеты (антресоль)',     'RESTROOM',  2, 290, 350, 20, 27, '#3A8C8C',
      'Санузлы антресольного уровня.', 'restroom'),
 (10, 'Лестница (антресоль)',    'STAIRS',    2, 208, 222, 19.5, 23, '#9C9C9C',
      'Промежуточная площадка лестничной башни — выход на гардероб.', 'stairs');

-- ===== Этаж 2 (floor_id=3) — Выставочные залы =====
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (11, 'Выставочный зал A',       'EXHIBITION', 3,   0, 115, 6, 20, '#FF0068',
      'Главный выставочный зал. Основная экспозиция Центра.', 'exhibition'),
 (12, 'Выставочный зал B',       'EXHIBITION', 3, 115, 235, 6, 20, '#FF0068',
      'Второй выставочный зал. Постоянная экспозиция.', 'exhibition'),
 (13, 'Выставочный зал C',       'EXHIBITION', 3, 235, 320, 6, 20, '#FF0068',
      'Зал временных выставок.', 'exhibition'),
 (14, 'Детский клуб',            'PUBLIC',     3, 320, 360, 6, 20, '#F0A050',
      'Детский клуб. Занятия для детей 4–12 лет. Требуется предварительная запись.', 'public'),
 (15, 'Туалеты (2 этаж)',        'RESTROOM',   3, 155, 195, 6, 20, '#3A8C8C',
      'Санузлы второго этажа.', 'restroom'),
 (16, 'Лестница (2 этаж)',       'STAIRS',     3, 208, 222, 19.5, 23, '#9C9C9C',
      'Лестничная башня, второй этаж.', 'stairs'),
 (17, 'Лифт (2 этаж)',           'ELEVATOR',   3, 194, 208, 19.5, 23, '#B0B0B0',
      'Лифт, второй этаж.', 'elevator');

-- ===== Этаж 2.5 (floor_id=4) — Переход: Технический уровень =====
-- Пристройка снаружи цилиндра: radius_inner=20, radius_outer=27
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (18, 'Туалеты (переход 2½)',          'RESTROOM',  4, 280, 350, 20, 27, '#3A8C8C',
      'Санузел на промежуточной площадке между 2-м и 3-м этажами.', 'restroom'),
 (19, 'Лестница (переход 2½)',         'STAIRS',    4, 208, 222, 19.5, 23, '#9C9C9C',
      'Промежуточная площадка лестничной башни.', 'stairs'),
 (36, 'Детская мастерская А',          'WORKSHOP',  4, 140, 205, 20, 27, '#F0A050',
      'Детская мастерская. Занятия для детей по декоративно-прикладному искусству и архитектуре.', 'workshop'),
 (37, 'Детская мастерская Б',          'WORKSHOP',  4, 225, 280, 20, 27, '#F0A050',
      'Детская мастерская. Творческие занятия и игровые программы для детей от 4 лет.', 'workshop');

-- ===== Этаж 3 (floor_id=5) — Выставки =====
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (20, 'Выставочный зал D',       'EXHIBITION', 5,   0, 175, 6, 20, '#CC0055',
      'Выставочный зал D. Масштабные инсталляции и проекты.', 'exhibition'),
 (21, 'Выставочный зал E',       'EXHIBITION', 5, 175, 330, 6, 20, '#CC0055',
      'Выставочный зал E. Арт-резиденции и мастер-классы.', 'exhibition'),
 (22, 'Фойе и зона отдыха',      'PUBLIC',     5, 330, 360, 6, 20, '#8C8C8C',
      'Фойе третьего этажа. Зона ожидания.', 'public'),
 (23, 'Туалеты (3 этаж)',        'RESTROOM',   5, 155, 195, 6, 20, '#3A8C8C',
      'Санузлы третьего этажа.', 'restroom'),
 (24, 'Лестница (3 этаж)',       'STAIRS',     5, 208, 222, 19.5, 23, '#9C9C9C',
      'Лестничная башня, третий этаж.', 'stairs'),
 (25, 'Лифт (3 этаж)',           'ELEVATOR',   5, 194, 208, 19.5, 23, '#B0B0B0',
      'Лифт, третий этаж.', 'elevator');

-- ===== Этаж 4 (floor_id=6) — Кино и Лекторий =====
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (26, 'Зотов.Кино',              'CINEMA',     6,   0, 125, 6, 20, '#4B2E5E',
      'Кинотеатр «Зотов.Кино». Авторская программа, классика, архивные показы. Места для кресел-колясок.', 'cinema'),
 (27, 'Лекторий',                'LECTURE',    6, 125, 245, 6, 20, '#083297',
      'Лекторий на 120 мест. Лекции, дискуссии, концерты, спектакли.', 'lecture'),
 (28, 'Магазин «Зотов.Вещь!»',  'SHOP',       6, 245, 330, 6, 20, '#C8C8C8',
      'Вторая точка магазина. Расширенный ассортимент изданий и дизайн-объектов.', 'shop'),
 (29, 'Туалеты (4 этаж)',        'RESTROOM',   6, 330, 360, 6, 20, '#3A8C8C',
      'Санузлы четвёртого этажа. Отдельный гардероб для посетителей кино.', 'restroom'),
 (30, 'Лестница (4 этаж)',       'STAIRS',     6, 208, 222, 19.5, 23, '#9C9C9C',
      'Лестничная башня, четвёртый этаж.', 'stairs'),
 (31, 'Лифт (4 этаж)',           'ELEVATOR',   6, 194, 208, 19.5, 23, '#B0B0B0',
      'Лифт, четвёртый этаж.', 'elevator');

-- ===== Вторая лестничная башня (напротив главной: ~215°+180°=35°, NE-сектор) =====
-- На планах здания видна на всех четырёх основных этажах; антресольных уровней нет.
INSERT INTO zone (id, name, type, floor_id, angle_start, angle_end, radius_inner, radius_outer, color, description, icon_key) VALUES
 (32, 'Лестница 2 (1 этаж)', 'STAIRS', 1, 28, 42, 19.5, 23, '#9C9C9C',
      'Вторая лестничная башня. Запасной выход и подъём на 2–4 этажи.', 'stairs'),
 (33, 'Лестница 2 (2 этаж)', 'STAIRS', 3, 28, 42, 19.5, 23, '#9C9C9C',
      'Вторая лестничная башня, второй этаж.', 'stairs'),
 (34, 'Лестница 2 (3 этаж)', 'STAIRS', 5, 28, 42, 19.5, 23, '#9C9C9C',
      'Вторая лестничная башня, третий этаж.', 'stairs'),
 (35, 'Лестница 2 (4 этаж)', 'STAIRS', 6, 28, 42, 19.5, 23, '#9C9C9C',
      'Вторая лестничная башня, четвёртый этаж.', 'stairs');

-- ---------- СОБЫТИЯ ----------
INSERT INTO event (id, title, description, start_time, end_time, zone_id, type, poster_url) VALUES
 (1, 'Выставка «Логика конструктивизма»',
     'Ключевая экспозиция о русском авангарде и его влиянии на дизайн XX века.',
     '2026-06-06 11:00:00', '2026-06-06 20:00:00', 11, 'EXHIBITION', NULL),
 (2, 'Выставка «Геометрия авангарда»',
     'Графика, плакаты и архитектурные проекты конструктивистов.',
     '2026-06-06 11:00:00', '2026-06-06 20:00:00', 12, 'EXHIBITION', NULL),
 (3, 'Лекция «Хлебозавод №5: архитектура круга»',
     'История здания-памятника и инженера Г. Марсакова.',
     '2026-06-06 19:00:00', '2026-06-06 20:30:00', 27, 'LECTURE', NULL),
 (4, 'Кинопоказ «Человек с киноаппаратом»',
     'Шедевр Дзиги Вертова с живым музыкальным сопровождением.',
     '2026-06-06 20:00:00', '2026-06-06 21:40:00', 26, 'FILM', NULL),
 (5, 'Мастер-класс «Конструктивистский плакат»',
     'Создаём плакат в стилистике 1920-х. Материалы включены.',
     '2026-06-07 14:00:00', '2026-06-07 16:00:00', 21, 'WORKSHOP', NULL),
 (6, 'Детский мастер-класс «Геометрия и цвет»',
     'Творческое занятие для детей 6–10 лет.',
     '2026-06-07 12:00:00', '2026-06-07 13:30:00', 14, 'WORKSHOP', NULL),
 (7, 'Лекция «Родченко и фотомонтаж»',
     'О новаторстве Александра Родченко в фотографии и дизайне.',
     '2026-06-08 19:00:00', '2026-06-08 20:30:00', 27, 'LECTURE', NULL),
 (8, 'Кинопоказ «Броненосец Потёмкин»',
     'Классика Сергея Эйзенштейна на большом экране.',
     '2026-06-09 20:00:00', '2026-06-09 21:30:00', 26, 'FILM', NULL),
 (9, 'Концерт «Авангард-вечер»',
     'Современная академическая музыка в индустриальном пространстве.',
     '2026-06-10 20:00:00', '2026-06-10 22:00:00', 2,  'CONCERT', NULL);

-- ---------- ТОВАРЫ МАГАЗИНА (рекомендации) ----------
INSERT INTO product (id, name, price, shop_url, tags) VALUES
 (1,  'Живые и мёртвое. История советского кино',          2270, 'https://shop.centrezotov.ru/new', 'cinema'),
 (2,  'Кино эпохи НЭПА',                                   5180, 'https://shop.centrezotov.ru/new', 'cinema'),
 (3,  'Немое кино: Магия кинематографа',                    1240, 'https://shop.centrezotov.ru/new', 'cinema'),
 (4,  'Очень страшное кино: история фильмов ужасов',        1750, 'https://shop.centrezotov.ru/new', 'cinema'),
 (5,  'Сеанс №93',                                          2000, 'https://shop.centrezotov.ru/new', 'cinema'),
 (6,  'Александр Родченко: художник-конструктор будущего',  1300, 'https://shop.centrezotov.ru/new', 'exhibition'),
 (7,  'Владимир Татлин',                                    1310, 'https://shop.centrezotov.ru/new', 'exhibition'),
 (8,  'Bauhaus (World of Art)',                             2940, 'https://shop.centrezotov.ru/new', 'exhibition'),
 (9,  'Le Corbusier (World of Art)',                        3740, 'https://shop.centrezotov.ru/new', 'exhibition'),
 (10, 'Худи «Хлеб»',                                       7500, 'https://shop.centrezotov.ru/new', 'exhibition,shop'),
 (11, 'История СССР. Лекции Льва Лурье',                    1490, 'https://shop.centrezotov.ru/new', 'lecture'),
 (12, 'Юрий Любимов: путь к «Мастеру»',                    1410, 'https://shop.centrezotov.ru/new', 'lecture'),
 (13, 'Женский вопрос в СССР',                              1820, 'https://shop.centrezotov.ru/new', 'lecture'),
 (14, 'Ностальгическая Москва',                             1000, 'https://shop.centrezotov.ru/new', 'lecture'),
 (15, 'Нисенитница, или 500 лет русского абсурда',          1560, 'https://shop.centrezotov.ru/new', 'workshop'),
 (16, 'Мир ботаника Вавилова',                              1100, 'https://shop.centrezotov.ru/new', 'workshop'),
 (17, 'Свеча фигурная «Милый день» белая',                  4200, 'https://shop.centrezotov.ru/new', 'cafe'),
 (18, 'Аромат для дома «Дом 21»',                           2500, 'https://shop.centrezotov.ru/new', 'cafe'),
 (19, 'Стакан «Лось»',                                      2500, 'https://shop.centrezotov.ru/new', 'cafe'),
 (20, 'Сумка ЗОТОВ × ZOTEME',                               5900, 'https://shop.centrezotov.ru/new', 'shop'),
 (21, 'Домино «Зверята. Май Митурич»',                      1360, 'https://shop.centrezotov.ru/new', 'shop');

-- Книги (дополнение)
INSERT INTO product (id, name, price, shop_url, tags) VALUES
 (22, 'История постановки фильма «Броненосец Потемкин»',     1730, 'https://shop.centrezotov.ru/catalog/kinematograf',       'cinema'),
 (23, 'Эль Лисицкий. Слоненок. Репринтные издания',          4330, 'https://shop.centrezotov.ru/catalog/iskusstvo',           'exhibition'),
 (24, 'Сделано в СССР: материализация нового мира',           1200, 'https://shop.centrezotov.ru/catalog/iskusstvo',           'exhibition'),
 (25, 'Картография неведения: мистицизм, психиатрия',         1540, 'https://shop.centrezotov.ru/catalog/gumanitarnyi-non-fiksn', 'lecture'),
 (26, 'Рассказы о пустыне и дорогах. Автопробег Москва–Каракумы', 1950, 'https://shop.centrezotov.ru/catalog/istoriia',      'lecture'),
 (27, 'Артгид. Бразилия',                                    4500, 'https://shop.centrezotov.ru/catalog/iskusstvo',           'lecture'),
 (28, 'Как появился наш съедобный мир',                       1010, 'https://shop.centrezotov.ru/catalog/gumanitarnyi-non-fiksn', 'workshop'),
 (29, 'Искусство исследовать усадьбы. Дело №1-17',            1530, 'https://shop.centrezotov.ru/catalog/arxitektura-i-urbanistika', 'workshop'),
 (30, 'Адреса Михаила Булгакова',                              970, 'https://shop.centrezotov.ru/catalog/xudozestvennaia-literatura', 'lecture');

-- Одежда и аксессуары
INSERT INTO product (id, name, price, shop_url, tags) VALUES
 (31, 'Футболка «Киноощущение мира»',                         4550, 'https://shop.centrezotov.ru/catalog/odezda',              'cinema'),
 (32, 'Сумка «Киноощущение мира»',                            3200, 'https://shop.centrezotov.ru/catalog/aksessuary',          'cinema'),
 (33, 'Брелок Киноглаз',                                       950, 'https://shop.centrezotov.ru/catalog/aksessuary',          'cinema'),
 (34, 'Палантин Popova',                                     10900, 'https://shop.centrezotov.ru/catalog/aksessuary',          'exhibition'),
 (35, 'Брошь Ballet Bauhaus №3',                               5900, 'https://shop.centrezotov.ru/catalog/ukraseniia',          'exhibition'),
 (36, 'Фартук Хлеб',                                          3000, 'https://shop.centrezotov.ru/catalog/odezda',              'cafe,shop'),
 (37, 'Шоппер «Зотов» бежевый',                               3500, 'https://shop.centrezotov.ru/catalog/aksessuary',          'shop'),
 (38, 'Очечник Батон',                                        1800, 'https://shop.centrezotov.ru/catalog/aksessuary',          'shop'),
 (39, 'Кардхолдер «Жизнь врасплох»',                          1300, 'https://shop.centrezotov.ru/catalog/aksessuary',          'shop');

-- Сувениры
INSERT INTO product (id, name, price, shop_url, tags) VALUES
 (40, 'Плакат Киноглаз',                                      3000, 'https://shop.centrezotov.ru/catalog/suveniry',            'cinema,exhibition'),
 (41, 'Стикер «Вертов»',                                       200, 'https://shop.centrezotov.ru/catalog/stikery',             'cinema'),
 (42, 'Открытка Киноглаз. Дзига Вертов',                       150, 'https://shop.centrezotov.ru/catalog/otkrytki',            'cinema'),
 (43, 'Скетчбук «Как надо работать» А5',                        800, 'https://shop.centrezotov.ru/catalog/kanceliariia',        'workshop'),
 (44, 'Блокнот А5 Хлебозавод №5',                              500, 'https://shop.centrezotov.ru/catalog/kanceliariia',        'workshop,shop'),
 (45, 'Стикерпак «Конструкция всем»',                           660, 'https://shop.centrezotov.ru/catalog/stikery',             'exhibition,shop'),
 (46, 'Линейка Хлебозавод',                                    400, 'https://shop.centrezotov.ru/catalog/kanceliariia',        'shop'),
 (47, 'Значок «Зотов»',                                        650, 'https://shop.centrezotov.ru/catalog/znacki',              'shop');

-- Декор (дополнение)
INSERT INTO product (id, name, price, shop_url, tags) VALUES
 (48, 'Стакан «Медведь»',                                     2500, 'https://shop.centrezotov.ru/catalog/posuda',              'cafe'),
 (49, 'Чайная пара «Косичка»',                                3800, 'https://shop.centrezotov.ru/catalog/posuda',              'cafe'),
 (50, 'Кружка «Красно солнышко»',                             2300, 'https://shop.centrezotov.ru/catalog/posuda',              'cafe'),
 (51, 'Стакан «Волк»',                                        2500, 'https://shop.centrezotov.ru/catalog/posuda',              'cafe'),
 (52, 'Конструктор «Храм чернорабочих»',                      8400, 'https://shop.centrezotov.ru/catalog/igry',                'exhibition,workshop'),
 (53, 'Гирлянда «Мысли конструктивно»',                       1500, 'https://shop.centrezotov.ru/catalog/interernye-obieekty', 'exhibition,shop'),
 (54, 'Плед Экстер (большие балерины)',                       18000, 'https://shop.centrezotov.ru/catalog/interernye-obieekty', 'exhibition'),
 (55, 'Набор игральных кубиков «Бросок костей»',              15000, 'https://shop.centrezotov.ru/catalog/igry',                'workshop,shop'),
 (56, 'Свеча фигурная «Милый день» красная',                   4200, 'https://shop.centrezotov.ru/catalog/sveci-i-podsvecniki', 'cafe');

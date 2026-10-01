// Демонстрационные данные из ТЗ: 8 пользователей, 3 проекта, 30 задач.
// Даты считаются от дня первого запуска, чтобы всегда были и ближайшие, и просроченные сроки.
const DEMO_PASSWORD = 'nordflow';

function seed(hashPassword) {
  const day = (offset) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const at = (offsetDays, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, (offsetDays * 7 + 13) % 60, 0, 0);
    const latest = Date.now() - 20 * 60000;
    return new Date(Math.min(d.getTime(), latest - Math.abs(offsetDays * 37 + hour) * 60000)).toISOString();
  };

  const people = [
    ['u1', 'anna@nordflow.io', 'Анна', 'Волкова', 'Операционный директор', 'admin'],
    ['u2', 'maxim@nordflow.io', 'Максим', 'Орлов', 'Руководитель проекта', 'manager'],
    ['u3', 'elena@nordflow.io', 'Елена', 'Соколова', 'Дизайнер', 'employee'],
    ['u4', 'ilya@nordflow.io', 'Илья', 'Морозов', 'Frontend-разработчик', 'employee'],
    ['u5', 'victor@nordflow.io', 'Виктор', 'Лебедев', 'Backend-разработчик', 'employee'],
    ['u6', 'olga@nordflow.io', 'Ольга', 'Крылова', 'Маркетолог', 'manager'],
    ['u7', 'dmitry@nordflow.io', 'Дмитрий', 'Фролов', 'Тестировщик', 'employee'],
    ['u8', 'maria@nordflow.io', 'Мария', 'Белова', 'Аналитик', 'employee'],
  ];
  const users = people.map(([id, email, firstName, lastName, position, role]) => ({
    id, email, firstName, lastName, position, role,
    avatar: null, theme: 'light', active: true, createdAt: at(-40),
    ...hashPassword(DEMO_PASSWORD),
  }));

  const projects = [
    {
      id: 'p1', name: 'Сайт для клиента «GreenStone»',
      description: 'Корпоративный сайт производителя натурального камня: каталог, калькулятор, заявки в CRM.',
      managerId: 'u2', members: ['u3', 'u4', 'u5', 'u7'], startDate: day(-30), endDate: day(25),
      status: 'active', allowMemberTasks: true, createdAt: at(-30),
    },
    {
      id: 'p2', name: 'Запуск рекламной кампании NordFlow',
      description: 'Осенняя кампания: лендинг, креативы, Яндекс Директ и VK Реклама, отчёт по лидам.',
      managerId: 'u6', members: ['u1', 'u3', 'u8', 'u4'], startDate: day(-14), endDate: day(16),
      status: 'active', allowMemberTasks: false, createdAt: at(-14),
    },
    {
      id: 'p3', name: 'Внутренняя автоматизация отдела продаж',
      description: 'Интеграция amoCRM и 1С, автоматические отчёты, бот для менеджеров.',
      managerId: 'u2', members: ['u1', 'u5', 'u8', 'u7'], startDate: day(-3), endDate: day(60),
      status: 'planned', allowMemberTasks: true, createdAt: at(-5),
    },
  ];

  // [проект, название, статус, приоритет, исполнитель, постановщик, срок(смещение дней|null), теги, описание]
  const raw = [
    ['p1', 'Собрать требования и карту сайта', 'done', 'high', 'u8', 'u2', -20, ['аналитика'], 'Интервью с клиентом, список разделов, карта сайта в Miro.'],
    ['p1', 'Дизайн главной страницы', 'done', 'high', 'u3', 'u2', -12, ['дизайн'], 'Два варианта первого экрана, согласование с клиентом.'],
    ['p1', 'Дизайн каталога и карточки товара', 'review', 'medium', 'u3', 'u2', 1, ['дизайн'], 'Фильтры по породе камня, цвету и толщине.'],
    ['p1', 'Вёрстка главной страницы', 'progress', 'high', 'u4', 'u2', 2, ['frontend'], 'Адаптив 360–1920, анимации появления блоков.'],
    ['p1', 'Каталог: фильтры и пагинация', 'planned', 'medium', 'u4', 'u2', 9, ['frontend'], ''],
    ['p1', 'API заявок и отправка в CRM', 'progress', 'critical', 'u5', 'u2', -2, ['backend', 'crm'], 'Заявки с сайта уходят в amoCRM с UTM-метками.'],
    ['p1', 'Калькулятор стоимости столешницы', 'backlog', 'medium', 'u5', 'u2', 14, ['backend'], ''],
    ['p1', 'Тест-план и чек-лист приёмки', 'planned', 'medium', 'u7', 'u2', 5, ['qa'], ''],
    ['p1', 'Проверить формы на мобильных', 'backlog', 'low', 'u7', 'u2', 12, ['qa'], ''],
    ['p1', 'Перенос контента со старого сайта', 'progress', 'medium', 'u8', 'u2', -1, ['контент'], '120 товаров и 14 статей блога.'],
    ['p1', 'Настроить хостинг и SSL', 'done', 'high', 'u5', 'u2', -8, ['devops'], ''],
    ['p2', 'Бриф и цели кампании', 'done', 'high', 'u6', 'u6', -10, ['маркетинг'], 'KPI: 120 заявок за месяц, CPL до 900 ₽.'],
    ['p2', 'Креативы для VK Рекламы', 'progress', 'high', 'u3', 'u6', 0, ['дизайн'], '6 баннеров в трёх форматах.'],
    ['p2', 'Лендинг кампании', 'review', 'critical', 'u4', 'u6', -3, ['frontend'], ''],
    ['p2', 'Настроить Яндекс Директ', 'planned', 'high', 'u6', 'u6', 3, ['реклама'], ''],
    ['p2', 'Сквозная аналитика и цели Метрики', 'progress', 'medium', 'u8', 'u6', 4, ['аналитика'], ''],
    ['p2', 'Тексты объявлений: 3 гипотезы', 'backlog', 'medium', 'u6', 'u6', 6, ['реклама'], ''],
    ['p2', 'Отчёт по первой неделе', 'backlog', 'low', 'u8', 'u6', 11, ['аналитика'], ''],
    ['p2', 'Видео-обложка для Reels', 'backlog', 'low', 'u3', 'u6', 15, ['дизайн'], ''],
    ['p3', 'Аудит текущих процессов продаж', 'progress', 'high', 'u8', 'u2', 2, ['аналитика'], 'Как менеджеры ведут сделки сейчас, где теряются заявки.'],
    ['p3', 'Схема интеграции amoCRM и 1С', 'planned', 'high', 'u5', 'u2', 7, ['backend', 'crm'], ''],
    ['p3', 'Прототип бота для менеджеров', 'backlog', 'medium', 'u5', 'u2', 20, ['backend', 'бот'], ''],
    ['p3', 'Автоотчёт по воронке в Telegram', 'backlog', 'medium', 'u8', 'u2', 25, ['аналитика'], ''],
    ['p3', 'Сценарии тестирования интеграции', 'backlog', 'low', 'u7', 'u2', 18, ['qa'], ''],
    ['p3', 'Согласовать доступы к 1С', 'review', 'critical', 'u2', 'u2', -4, ['организация'], 'Нужен доступ к тестовой базе.'],
    ['p3', 'Справочник статусов сделок', 'planned', 'medium', 'u8', 'u2', 1, ['аналитика'], ''],
    ['p1', 'Иконки преимуществ', 'done', 'low', 'u3', 'u2', -6, ['дизайн'], ''],
    ['p2', 'Согласовать бюджет кампании', 'progress', 'high', 'u1', 'u6', -1, ['финансы'], 'Бюджет 300 000 ₽ на месяц, разбивка по каналам.'],
    ['p3', 'Утвердить ТЗ на интеграцию', 'review', 'high', 'u1', 'u2', 2, ['организация'], ''],
    ['p2', 'Выбрать подрядчика на видеосъёмку', 'planned', 'medium', 'u1', 'u6', 5, ['организация'], ''],
  ];

  let counter = 101;
  const tasks = raw.map(([projectId, title, status, priority, assigneeId, reporterId, dl, tags, description], i) => {
    const created = at(-18 + (i % 12), 9 + (i % 8));
    const history = [{ at: created, userId: reporterId, text: 'создал(а) задачу' }];
    if (status !== 'backlog') history.push({ at: at(-10 + (i % 6), 11), userId: assigneeId, text: 'статус: Бэклог → Запланировано' });
    if (['progress', 'review', 'done'].includes(status)) history.push({ at: at(-6 + (i % 4), 14), userId: assigneeId, text: 'статус: Запланировано → В работе' });
    if (['review', 'done'].includes(status)) history.push({ at: at(-3 + (i % 2), 16), userId: assigneeId, text: 'статус: В работе → На проверке' });
    if (status === 'done') history.push({ at: at(-2, 17), userId: reporterId, text: 'статус: На проверке → Выполнено' });
    return {
      id: 't' + (i + 1), key: `NDF-${counter++}`, projectId, title, description, status, priority,
      assigneeId, reporterId, deadline: dl === null ? '' : day(dl), tags,
      attachments: i === 1 ? [{ id: 'l1', type: 'link', name: 'Макет в Figma', url: 'https://www.figma.com/', at: created, userId: 'u3' }] : [],
      history, createdAt: created, updatedAt: history[history.length - 1].at, flags: {},
    };
  });

  const comments = [
    ['t3', 'u2', 'Елена, клиент просит добавить фильтр по толщине плиты.', -2],
    ['t3', 'u3', 'Добавила, перевела на проверку.', -1],
    ['t4', 'u4', 'Главная свёрстана на 80%, осталась анимация.', -1],
    ['t6', 'u2', 'Виктор, это блокер для запуска, что с доступами к CRM?', -1],
    ['t6', 'u5', 'Ключ получил вчера вечером, доделываю сегодня.', 0],
    ['t10', 'u8', 'Перенесла 90 товаров из 120.', 0],
    ['t13', 'u6', 'Нужен акцент на сроках MVP — 6 недель.', -1],
    ['t14', 'u4', 'Лендинг готов, жду проверки.', -2],
    ['t14', 'u6', 'Посмотрю сегодня до 18:00.', -1],
    ['t20', 'u8', 'Провела 4 интервью с менеджерами.', 0],
    ['t25', 'u2', 'Написал в ИТ клиента, жду ответ.', -2],
  ].map(([taskId, userId, text, d], i) => ({ id: 'c' + (i + 1), taskId, userId, text, at: at(d, 12 + (i % 5)), editedAt: null }));

  const notifications = [
    { id: 'n1', userId: 'u4', type: 'assigned', taskId: 't5', text: 'Вам назначена задача NDF-105 «Каталог: фильтры и пагинация»', at: at(-1, 9), read: false },
    { id: 'n2', userId: 'u5', type: 'comment', taskId: 't6', text: 'Новый комментарий в NDF-106: Виктор, это блокер для запуска…', at: at(-1, 15), read: false },
    { id: 'n3', userId: 'u2', type: 'status', taskId: 't3', text: 'NDF-103 «Дизайн каталога и карточки товара»: статус — На проверке', at: at(-1, 17), read: false },
    { id: 'n4', userId: 'u6', type: 'status', taskId: 't14', text: 'NDF-114 «Лендинг кампании»: статус — На проверке', at: at(-2, 11), read: true },
  ];

  return { counter, users, projects, tasks, comments, notifications, sessions: {} };
}

module.exports = { seed, DEMO_PASSWORD };

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Anchor,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Flag,
  Layers,
  Menu,
  RotateCcw,
  Search,
  Ship,
  Shuffle,
  Sparkles,
  Sun,
  Waves,
  X,
} from "lucide-react";
import sourceCards from "./cards.json";
import { assetUrl } from "./assets";
import {
  emptyProgress,
  getCounts,
  loadProgress,
  localDate,
  makeQueue,
  recordAnswer,
  STORAGE_KEY,
  type Answer,
  type Card,
  type Progress,
} from "./progress";

const cards: Card[] = sourceCards;
const topics = [
  {
    id: "power",
    name: "Механические суда",
    short: "Механические суда",
    rule: "23",
  },
  {
    id: "towing",
    name: "Буксировка и толкание",
    short: "Буксировка",
    rule: "24",
  },
  { id: "sailing", name: "Парусные суда", short: "Парусные суда", rule: "25" },
  {
    id: "fishing",
    name: "Рыболовные суда",
    short: "Рыболовные суда",
    rule: "26",
  },
  {
    id: "restricted",
    name: "Особые состояния",
    short: "Особые состояния",
    rule: "27",
  },
  {
    id: "draft",
    name: "Стеснённые осадкой",
    short: "Стеснённые осадкой",
    rule: "28",
  },
  {
    id: "pilot",
    name: "Лоцманские суда",
    short: "Лоцманские суда",
    rule: "29",
  },
  {
    id: "anchor",
    name: "Якорь, мель и швартовка",
    short: "Якорь и мель",
    rule: "30",
  },
  {
    id: "distress",
    name: "Сигналы бедствия",
    short: "Сигналы бедствия",
    rule: "37",
  },
];
const cardMap = new Map(cards.map((card) => [card.id, card]));
const topicName = (id: string) =>
  topics.find((t) => t.id === id)?.name ?? "Все темы";
const plural = (n: number) =>
  n % 10 === 1 && n % 100 !== 11
    ? "карточка"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "карточки"
      : "карточек";
const initialProgress = () => {
  try {
    return loadProgress(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyProgress();
  }
};

export default function App() {
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [view, setView] = useState<"study" | "library" | "progress">("study");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [mode, setMode] = useState("all");
  const [queue, setQueue] = useState(() => makeQueue(cards, initialProgress()));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState<
    { index: number; progress: Progress }[]
  >([]);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<Answer | null>(null);
  const [modal, setModal] = useState<"help" | "reset" | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState("");
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const search = useRef<HTMLInputElement>(null);
  const counts = getCounts(cards, progress);
  const today = progress.days[localDate()] ?? 0;
  const card = cardMap.get(queue[index]);
  const finished = index >= queue.length && queue.length > 0;
  const sessionPercent = queue.length
    ? Math.round((index / queue.length) * 100)
    : 0;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [progress]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!modal && !mobileMenu) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [modal, mobileMenu]);

  function restart(
    nextCategory = category,
    nextMode = mode,
    nextKind = kind,
    shuffled = false,
    first?: string,
  ) {
    clearTimeout(timer.current);
    let next = makeQueue(
      cards,
      progress,
      nextCategory,
      nextMode,
      nextKind,
      shuffled,
    );
    if (first) next = [first, ...next.filter((id) => id !== first)];
    setCategory(nextCategory);
    setMode(nextMode);
    setKind(nextKind);
    setQueue(next);
    setIndex(0);
    setFlipped(false);
    setHistory([]);
    setDrag(0);
    setLeaving(null);
  }

  function rate(answer: Answer) {
    if (!card || leaving) return;
    setLeaving(answer);
    const id = card.id;
    timer.current = setTimeout(() => {
      setHistory((previous) => [...previous, { index, progress }]);
      setProgress((previous) => recordAnswer(previous, id, answer));
      setIndex((previous) => previous + 1);
      setFlipped(false);
      setDrag(0);
      setLeaving(null);
    }, 180);
  }

  function undo() {
    if (leaving || !history.length) return;
    const previous = history[history.length - 1];
    setProgress(previous.progress);
    setIndex(previous.index);
    setHistory(history.slice(0, -1));
    setFlipped(false);
    setDrag(0);
    setNotice("Последнее действие отменено");
  }

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === "Escape") {
        setModal(null);
        setMobileMenu(false);
        return;
      }
      if (
        view !== "study" ||
        modal ||
        mobileMenu ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        rate("known");
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        rate("review");
      }
      if (event.code === "Space" && target.tagName !== "BUTTON") {
        event.preventDefault();
        if (card) setFlipped((value) => !value);
      }
      if (event.key.toLowerCase() === "z") undo();
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  });

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || leaving) return;
    start.current = { x: event.clientX, y: event.clientY };
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!start.current || leaving) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      setDrag(dx);
      dragged.current = true;
    }
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.2)
      rate(dx > 0 ? "known" : "review");
    else setDrag(0);
  }
  function navigate(next: typeof view) {
    setView(next);
    setMobileMenu(false);
  }

  const filteredCards = cards.filter(
    (c) =>
      (category === "all" || c.category === category) &&
      (kind === "all" || c.kind === kind) &&
      (mode !== "review" || progress.cards[c.id]?.status === "review") &&
      c.answer
        .toLocaleLowerCase("ru")
        .replaceAll("ё", "е")
        .includes(query.toLocaleLowerCase("ru").replaceAll("ё", "е")),
  );

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="menu-scrim"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileMenu ? "is-open" : ""}`}
        aria-label="Главное меню"
      >
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate("study");
          }}
          aria-label="Огни — на главную"
        >
          <img src={assetUrl("icon.svg")} alt="" />
          <span>
            огни<span className="brand-caption">МОРСКИЕ КАРТОЧКИ</span>
          </span>
        </a>
        <span className="nav-label">ВАША ПРАКТИКА</span>
        <nav className="main-nav">
          <button
            className={view === "study" ? "active" : ""}
            onClick={() => navigate("study")}
          >
            <Compass size={19} />
            Тренировка
            <ChevronRight className="nav-arrow" size={15} />
          </button>
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => navigate("library")}
          >
            <Layers size={19} />
            Все карточки<span className="nav-count">{cards.length}</span>
          </button>
          <button
            className={view === "progress" ? "active" : ""}
            onClick={() => navigate("progress")}
          >
            <BarChart3 size={19} />
            Мой прогресс
          </button>
        </nav>
        <div className="topics-heading">
          <span className="nav-label">ТЕМЫ</span>
          <span>{topics.length}</span>
        </div>
        <nav className="topic-nav" aria-label="Темы карточек">
          <button
            className={category === "all" ? "selected" : ""}
            onClick={() => {
              restart("all");
              setMobileMenu(false);
            }}
          >
            <span className="topic-dot all-dot" />
            Все темы<span>{cards.length}</span>
          </button>
          {topics.map((topic) => (
            <button
              key={topic.id}
              className={category === topic.id ? "selected" : ""}
              onClick={() => {
                restart(topic.id);
                setMobileMenu(false);
              }}
            >
              <span className={`topic-dot dot-${topic.id}`} />
              {topic.short}
              <span>{cards.filter((c) => c.category === topic.id).length}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-label">
            <BookOpen size={17} />
            <div>
              По материалам МППСС–72<span>Огни, знаки и сигналы судов</span>
            </div>
          </div>
          <button
            className="help-link"
            onClick={() => {
              setModal("help");
              setMobileMenu(false);
            }}
          >
            <CircleHelp size={17} />
            Как это работает
            <ArrowUpRight size={15} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Открыть меню"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>Практика</span>
            <ChevronRight size={13} />
            <strong>
              {view === "study"
                ? "Тренировка"
                : view === "library"
                  ? "Все карточки"
                  : "Мой прогресс"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            Учимся в своём темпе
            <span className="topbar-divider" />
            <span className="rules-badge">МППСС–72</span>
          </div>
        </header>

        {storageError && (
          <div className="storage-warning" role="alert">
            Браузер не разрешает сохранять данные. Тренировка работает, но после
            закрытия страницы прогресс потеряется.
          </div>
        )}

        <div className="content-grid">
          <main className="main-content" id="main-content">
            <div className="page-heading">
              <div className="eyebrow">
                <span /> НАВИГАЦИЯ НАЧИНАЕТСЯ С ВНИМАНИЯ
              </div>
              <h1>
                {view === "study" ? (
                  <>
                    В море важен
                    <br className="desktop-break" /> каждый огонь
                    <span className="heading-dot">.</span>
                  </>
                ) : view === "library" ? (
                  <>
                    Вся коллекция<span className="heading-dot">.</span>
                  </>
                ) : (
                  <>
                    Ваш курс к знаниям<span className="heading-dot">.</span>
                  </>
                )}
              </h1>
              <p>
                {view === "study"
                  ? "Учитесь узнавать суда по огням, знакам и сигналам."
                  : view === "library"
                    ? "144 иллюстрации из вашего PDF. Выберите, что повторить."
                    : "Маленькая практика сегодня — уверенность на воде завтра."}
              </p>
            </div>

            {view !== "progress" && (
              <>
                <div className="deck-toolbar">
                  <div className="segmented" aria-label="Режим тренировки">
                    <button
                      className={mode === "all" ? "selected" : ""}
                      onClick={() => restart(category, "all")}
                    >
                      <Layers size={15} />
                      Все карточки
                    </button>
                    <button
                      className={mode === "review" ? "selected" : ""}
                      onClick={() => restart(category, "review")}
                    >
                      <RotateCcw size={14} />
                      Повторить<span>{counts.review}</span>
                    </button>
                  </div>
                  <button
                    className="shuffle-button"
                    onClick={() => {
                      restart(category, mode, kind, true);
                      setNotice("Карточки перемешаны");
                    }}
                    aria-label="Перемешать карточки"
                  >
                    <Shuffle size={17} />
                    <span>Перемешать</span>
                  </button>
                </div>
                <div className="filters-row">
                  <label className="select-wrap">
                    <select
                      aria-label="Тема карточек"
                      value={category}
                      onChange={(event) => restart(event.target.value)}
                    >
                      <option value="all">Все темы</option>
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                  <label className="select-wrap kind-select">
                    <select
                      aria-label="Тип иллюстрации"
                      value={kind}
                      onChange={(event) =>
                        restart(category, mode, event.target.value)
                      }
                    >
                      <option value="all">Огни и знаки</option>
                      <option value="night">Только огни</option>
                      <option value="day">Дневные знаки</option>
                    </select>
                    <ChevronDown size={14} />
                  </label>
                  <span className="deck-size">
                    {view === "library" ? filteredCards.length : queue.length}{" "}
                    {plural(
                      view === "library" ? filteredCards.length : queue.length,
                    )}
                  </span>
                </div>
              </>
            )}

            {view === "study" && (
              <section
                className="study-area"
                aria-label="Тренировка с карточками"
              >
                {card ? (
                  <>
                    <div className="session-row">
                      <span>
                        КАРТОЧКА{" "}
                        <strong>{String(index + 1).padStart(2, "0")}</strong>
                        <span className="session-total"> / {queue.length}</span>
                      </span>
                      <span>{sessionPercent}% сессии пройдено</span>
                    </div>
                    <div className="session-track">
                      <span style={{ width: `${sessionPercent}%` }} />
                    </div>
                    <div className="card-stage">
                      <div className="stack-card stack-two" />
                      <div className="stack-card stack-one" />
                      <button
                        className={`flashcard ${flipped ? "is-flipped" : ""} ${leaving ? `leave-${leaving}` : ""}`}
                        style={
                          leaving
                            ? undefined
                            : {
                                transform: `translateX(${drag * 0.55}px) rotate(${drag / 45}deg)`,
                              }
                        }
                        onPointerDown={pointerDown}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerUp}
                        onPointerCancel={() => {
                          start.current = null;
                          setDrag(0);
                        }}
                        onClick={() => {
                          if (!dragged.current && !leaving)
                            setFlipped((value) => !value);
                          dragged.current = false;
                        }}
                        aria-label={
                          flipped
                            ? "Скрыть ответ"
                            : "Показать ответ на карточку"
                        }
                        aria-pressed={flipped}
                      >
                        <span className="card-topline">
                          <span>
                            <span className={`small-status ${card.kind}`} />
                            {flipped
                              ? "РАСШИФРОВКА"
                              : card.kind === "night"
                                ? "ОГНИ СУДНА"
                                : "ДНЕВНОЙ СИГНАЛ"}
                          </span>
                          <span>
                            № {card.id}
                            <Compass size={17} />
                          </span>
                        </span>
                        {flipped ? (
                          <span
                            className="answer-content"
                            key={`${card.id}-answer`}
                          >
                            <span className="answer-topic">
                              {topicName(card.category)}
                            </span>
                            <span className="answer-text">{card.answer}</span>
                            <span className="answer-source">
                              <BookOpen size={14} />
                              Источник: PDF, страница {card.page}, карточка{" "}
                              {card.position}
                            </span>
                          </span>
                        ) : (
                          <span className="illustration-wrap" key={card.id}>
                            <img
                              className={`card-illustration ${card.kind}`}
                              src={assetUrl(card.image)}
                              alt="Иллюстрация для распознавания огней или знаков судна"
                              draggable="false"
                              fetchPriority="high"
                            />
                          </span>
                        )}
                        <span className="card-bottomline">
                          <span className="tap-symbol">
                            <RotateCcw size={14} />
                          </span>
                          {flipped
                            ? "Нажмите, чтобы вернуться к картинке"
                            : "Узнаёте судно? Нажмите, чтобы проверить"}
                          <span className="card-side-number">
                            {flipped ? "02" : "01"} / 02
                          </span>
                        </span>
                        {Math.abs(drag) > 35 && (
                          <span
                            className={`swipe-stamp ${drag > 0 ? "known" : "review"}`}
                          >
                            {drag > 0 ? "ЗНАЮ" : "ПОВТОРИТЬ"}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="study-actions">
                      <button
                        className="action-review"
                        onClick={() => rate("review")}
                        disabled={!!leaving}
                      >
                        <RotateCcw size={18} />
                        <span>Повторить</span>
                      </button>
                      <button
                        className="action-reveal"
                        onClick={() => setFlipped((value) => !value)}
                        disabled={!!leaving}
                      >
                        <span>
                          {flipped ? "Скрыть ответ" : "Показать ответ"}
                        </span>
                        <span className="space-key">␣</span>
                      </button>
                      <button
                        className="action-known"
                        onClick={() => rate("known")}
                        disabled={!!leaving}
                      >
                        <span>Знаю</span>
                        <Check size={20} />
                      </button>
                    </div>
                    <div className="keyboard-hints">
                      <span>
                        <kbd>←</kbd> повторить
                      </span>
                      <span>
                        <kbd>пробел</kbd> ответ
                      </span>
                      <span>
                        <kbd>→</kbd> знаю
                      </span>
                    </div>
                    <div className="under-card">
                      <button
                        onClick={undo}
                        disabled={!history.length || !!leaving}
                      >
                        <RotateCcw size={14} />
                        Отменить действие
                      </button>
                      <span>
                        <ArrowLeft size={13} />
                        <ArrowRight size={13} />
                        Можно просто смахнуть карточку
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      {finished ? (
                        <Flag size={32} />
                      ) : mode === "review" ? (
                        <Sparkles size={32} />
                      ) : (
                        <Layers size={32} />
                      )}
                    </div>
                    <span className="eyebrow">
                      {finished ? "ОТЛИЧНАЯ ВАХТА" : "МОЖНО ИДТИ ДАЛЬШЕ"}
                    </span>
                    <h2>
                      {finished
                        ? "Колода пройдена!"
                        : mode === "review"
                          ? "Пока нечего повторять"
                          : "Здесь пока нет карточек"}
                    </h2>
                    <p>
                      {finished
                        ? `Вы разобрали ${queue.length} ${plural(queue.length)}. Возвращайтесь к сложным или начните новую сессию.`
                        : mode === "review"
                          ? "Отмечайте незнакомые карточки кнопкой «Повторить» или свайпом влево. Они появятся здесь."
                          : "Попробуйте другую тему или выберите все типы иллюстраций."}
                    </p>
                    <button
                      className="primary-button"
                      onClick={() =>
                        restart(
                          category,
                          finished && counts.review ? "review" : "all",
                          "all",
                          true,
                        )
                      }
                    >
                      {finished && counts.review
                        ? "Повторить сложное"
                        : "Начать тренировку"}
                      <ArrowRight size={17} />
                    </button>
                    {history.length > 0 && (
                      <button className="text-button" onClick={undo}>
                        Вернуть последнюю карточку
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {view === "library" && (
              <section className="library" aria-label="Коллекция карточек">
                <label className="search-field">
                  <Search size={18} />
                  <input
                    ref={search}
                    type="search"
                    placeholder="Найти судно, сигнал или правило…"
                    aria-label="Поиск карточек"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div className="library-grid">
                  {filteredCards.map((item) => (
                    <button
                      className="library-card"
                      key={item.id}
                      onClick={() => {
                        restart(category, mode, kind, false, item.id);
                        navigate("study");
                      }}
                    >
                      <span className="library-picture">
                        <img
                          src={assetUrl(item.image)}
                          alt={`Карточка ${item.id}`}
                          loading="lazy"
                        />
                        <span className="library-number">{item.id}</span>
                        {progress.cards[item.id] && (
                          <span
                            className={`card-status ${progress.cards[item.id].status}`}
                          >
                            {progress.cards[item.id].status === "known" ? (
                              <Check size={13} />
                            ) : (
                              <RotateCcw size={13} />
                            )}
                          </span>
                        )}
                      </span>
                      <span className="library-topic">
                        {topicName(item.category)}
                      </span>
                      <span className="library-answer">{item.answer}</span>
                      <span className="library-link">
                        Тренировать
                        <ArrowUpRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
                {!filteredCards.length && (
                  <div className="empty-state compact">
                    <Search size={28} />
                    <h2>Карточки не найдены</h2>
                    <p>Измените запрос или фильтры.</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        restart("all", "all", "all");
                      }}
                    >
                      Сбросить поиск и фильтры
                    </button>
                  </div>
                )}
              </section>
            )}

            {view === "progress" && (
              <section
                className="progress-page"
                aria-label="Статистика тренировок"
              >
                <div className="stats-cards">
                  <div>
                    <span>Изучено</span>
                    <strong>
                      {counts.studied}
                      <small> / {cards.length}</small>
                    </strong>
                  </div>
                  <div>
                    <span>Уже знаете</span>
                    <strong className="text-green">{counts.known}</strong>
                  </div>
                  <div>
                    <span>На повторение</span>
                    <strong className="text-coral">{counts.review}</strong>
                  </div>
                </div>
                <div className="topic-progress">
                  <h2>Знания по темам</h2>
                  {topics.map((topic) => {
                    const deck = cards.filter((c) => c.category === topic.id);
                    const known = getCounts(deck, progress).known;
                    return (
                      <button
                        key={topic.id}
                        onClick={() => {
                          restart(topic.id);
                          navigate("study");
                        }}
                      >
                        <span className="topic-progress-title">
                          {topic.name}
                          <span>
                            {known} / {deck.length}
                          </span>
                        </span>
                        <span className="topic-track">
                          <span
                            style={{ width: `${(known / deck.length) * 100}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="progress-note">
                  <Anchor size={20} />
                  <p>
                    Прогресс хранится только в этом браузере. Для занятий не
                    нужен аккаунт.
                  </p>
                </div>
                <button
                  className="reset-link"
                  onClick={() => setModal("reset")}
                >
                  <RotateCcw size={14} />
                  Сбросить прогресс
                </button>
              </section>
            )}

            <footer className="main-footer">
              <span>
                <Waves size={17} />
                Понемногу каждый день — уверенно в море.
              </span>
              <span>ОГНИ © {new Date().getFullYear()}</span>
            </footer>
          </main>

          <aside className="right-panel" aria-label="Прогресс и подсказки">
            <div className="watch-card">
              <div className="panel-title">
                <span>ВАША ВАХТА</span>
                <Sun size={17} />
              </div>
              <div
                className="daily-ring"
                style={
                  {
                    "--ring": `${Math.min(today / 20, 1) * 360}deg`,
                  } as React.CSSProperties
                }
              >
                <div>
                  <strong>
                    {today}
                    <small> / 20</small>
                  </strong>
                  <span>карточек сегодня</span>
                </div>
              </div>
              <div className="daily-copy">
                {today >= 20
                  ? "Хорошая практика!"
                  : today > 0
                    ? "Вы на верном курсе"
                    : "Возьмите верный курс"}
                <p>
                  {today >= 20
                    ? "Дневная цель достигнута. Продолжайте в своём темпе."
                    : "20 карточек в день — хороший ориентир для практики."}
                </p>
              </div>
              <div className="watch-stats">
                <div>
                  <span className="stat-dot green" />
                  Знаю<strong>{counts.known}</strong>
                </div>
                <div>
                  <span className="stat-dot coral" />
                  Повторить<strong>{counts.review}</strong>
                </div>
                <div>
                  <span className="stat-dot muted" />
                  Ещё не изучено<strong>{cards.length - counts.studied}</strong>
                </div>
              </div>
              <button
                className="panel-progress-link"
                onClick={() => navigate("progress")}
              >
                Весь прогресс
                <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="how-to">
              <span className="panel-eyebrow">ПРОСТОЙ РИТМ ОБУЧЕНИЯ</span>
              <h2>
                Смотрите.
                <br />
                Вспоминайте.
                <br />
                <span>Запоминайте.</span>
              </h2>
              <div className="how-step">
                <span>01</span>
                <p>
                  Посмотрите на огни
                  <br />
                  <small>Попробуйте узнать судно.</small>
                </p>
              </div>
              <div className="how-step">
                <span>02</span>
                <p>
                  Нажмите на карточку
                  <br />
                  <small>Проверьте своё предположение.</small>
                </p>
              </div>
              <div className="how-step">
                <span>03</span>
                <p>
                  Смахните и продолжайте
                  <br />
                  <small>Вправо — знаю, влево — повторить.</small>
                </p>
              </div>
            </div>
            <div className="source-note">
              <Ship size={20} />
              <p>
                Иллюстрации и ответы
                <br />
                из вашего PDF «Огни МППСС72».
              </p>
              <span>24 страницы · 144 карточки</span>
            </div>
          </aside>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {modal && (
        <Dialog
          title={
            modal === "help"
              ? "Ваша маленькая морская практика"
              : "Начать с чистого листа?"
          }
          onClose={() => setModal(null)}
        >
          {modal === "help" ? (
            <>
              <p>
                Каждая из 144 карточек — оригинальная иллюстрация из вашего PDF.
                Подпись открывается по нажатию.
              </p>
              <div className="help-directions">
                <div>
                  <ArrowDownLeft size={22} />
                  <strong>Влево — повторить</strong>
                  <span>Вернитесь к карточке в разделе «Повторить».</span>
                </div>
                <div>
                  <ArrowUpRight size={22} />
                  <strong>Вправо — знаю</strong>
                  <span>Карточка отметится в вашем прогрессе.</span>
                </div>
              </div>
              <p>
                На компьютере: <kbd>←</kbd> и <kbd>→</kbd> для оценки,{" "}
                <kbd>пробел</kbd> для ответа, <kbd>Z</kbd> для отмены. Можно
                пользоваться кнопками.
              </p>
              <p className="muted-copy">
                Карточки помогают учиться. Для применения правил на воде
                обращайтесь к актуальному тексту МППСС.
              </p>
              <button className="primary-button" onClick={() => setModal(null)}>
                Понятно, к карточкам
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <p>
                Будут удалены все отметки «Знаю», список повторения и статистика
                занятий в этом браузере. Отменить сброс не получится.
              </p>
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Сохранить прогресс
                </button>
                <button
                  className="danger-button"
                  onClick={() => {
                    setProgress(emptyProgress());
                    setQueue(
                      makeQueue(cards, emptyProgress(), category, "all", kind),
                    );
                    setMode("all");
                    setIndex(0);
                    setHistory([]);
                    setFlipped(false);
                    setModal(null);
                    setNotice("Прогресс сброшен");
                  }}
                >
                  Сбросить
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="dialog-close icon-button"
        aria-label="Закрыть окно"
        onClick={onClose}
      >
        <X size={21} />
      </button>
      <div className="dialog-mark">
        <Compass size={26} />
      </div>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}

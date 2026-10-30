import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  LayoutGrid,
  Link2,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  configured,
  CreateConflict,
  createRequest,
  getRequest,
  listRequests,
  pageSize,
  supabase,
  updateRequest,
} from "./data";
import {
  categories,
  emptyDraft,
  humanError,
  matchesDraft,
  statuses,
  validateDraft,
} from "./domain";
import type { Category, Draft, RequestRow, Status } from "./domain";

const icons = {
  bot: Bot,
  integration: Link2,
  report: FileText,
  other: Sparkles,
};
const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

function Brand() {
  return (
    <Link to="/requests" className="brand" aria-label="LD LATTE, главная">
      <span className="brand-mark">
        ld<span>↗</span>
      </span>
      <span>
        LD LATTE<small>АВТОМАТИЗАЦИЯ</small>
      </span>
    </Link>
  );
}
function Spinner({ label = "Загружаем…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
function Notice({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statuses[status]}
    </span>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(true);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!supabase) {
      setPending(false);
      return;
    }
    let alive = true,
      observedEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      observedEvent = true;
      if (alive) {
        setSession(next);
        setPending(false);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive || observedEvent) return;
        setSession(data.session);
        setPending(false);
        if (error) setAuthError(humanError(error));
      })
      .catch((error) => {
        if (alive) {
          setAuthError(humanError(error));
          setPending(false);
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  if (!configured)
    return (
      <main className="setup">
        <Brand />
        <h1>Сервис ещё настраивается</h1>
        <p>Параметры подключения пока не добавлены. Попробуйте позже.</p>
      </main>
    );
  if (pending)
    return (
      <div className="initial">
        <Brand />
        <Spinner label="Восстанавливаем сессию" />
      </div>
    );
  return (
    <Routes>
      <Route
        path="/login"
        element={
          session ? (
            <Navigate to="/requests" replace />
          ) : (
            <Auth mode="login" initialError={authError} />
          )
        }
      />
      <Route
        path="/register"
        element={
          session ? (
            <Navigate to="/requests" replace />
          ) : (
            <Auth key="register" mode="register" />
          )
        }
      />
      <Route
        path="/auth/callback"
        element={
          session ? (
            <Navigate to="/requests" replace />
          ) : (
            <Auth
              mode="login"
              initialError="Если вы подтвердили почту, войдите в аккаунт. Если ссылка устарела, запросите новое письмо на странице регистрации."
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          session ? (
            <Workspace key={session.user.id} session={session} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function Auth({
  mode,
  initialError = "",
}: {
  mode: "login" | "register";
  initialError?: string;
}) {
  const register = mode === "register";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (register) {
        const { data, error } = await supabase!.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Проверьте почту: если адрес доступен для регистрации, на него придёт ссылка подтверждения. Затем вернитесь и войдите.",
          );
      } else {
        const { error } = await supabase!.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError(humanError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow light">
            МЕНЬШЕ РУТИНЫ. БОЛЬШЕ ВОЗМОЖНОСТЕЙ.
          </span>
          <h1>
            Хорошие идеи
            <br />
            начинаются
            <br />с одной заявки<span>.</span>
          </h1>
          <p>
            Расскажите, что можно упростить.
            <br />А мы поможем процессам работать лучше.
          </p>
          <div className="story-cards">
            <span>
              <Bot size={19} /> Боты
            </span>
            <span>
              <Link2 size={19} /> Интеграции
            </span>
            <span>
              <FileText size={19} /> Отчёты
            </span>
          </div>
        </div>
        <small className="auth-footer">
          Внутренний сервис автоматизации <ArrowDownLeft size={18} />
        </small>
      </aside>
      <main className="auth-main">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-box">
          <span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>
          <h2>{register ? "Давайте знакомиться" : "С возвращением"}</h2>
          <p className="muted">
            {register
              ? "Создайте аккаунт, чтобы отправить первую заявку."
              : "Войдите, чтобы продолжить работу с заявками."}
          </p>
          {error && <Notice>{error}</Notice>}
          {message && <Notice kind="success">{message}</Notice>}
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label htmlFor="email">Электронная почта</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={
                  register ? "Не менее 8 символов" : "Введите пароль"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={register ? 8 : 1}
                maxLength={128}
              />
              {register && (
                <p className="field-hint">
                  Не менее 8 символов. Используйте уникальный пароль.
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={18} /> : null}
                {busy ? "Подождите…" : register ? "Создать аккаунт" : "Войти"}
                {!busy && <ArrowRight size={18} />}
              </button>
            </fieldset>
          </form>
          <p className="auth-switch">
            {register ? "Уже есть аккаунт?" : "Впервые здесь?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Войти" : "Создать аккаунт"}
            </Link>
          </p>
          <div className="privacy-note">
            <CheckCircle2 size={17} /> Ваши заявки видны только вам
          </div>
        </div>
        <p className="auth-bottom">
          LD LATTE <span>·</span> Пространство для полезных изменений
        </p>
      </main>
    </div>
  );
}

function Workspace({ session }: { session: Session }) {
  const [signingOut, setSigningOut] = useState(false),
    [error, setError] = useState("");
  const location = useLocation();
  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
    } catch (e) {
      setError(humanError(e));
      setSigningOut(false);
    }
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <Link className="nav-item active" to="/requests">
          <LayoutGrid size={19} />
          Мои заявки
          <span className="nav-dot" />
        </Link>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Sparkles size={20} />
          </span>
          <strong>Есть идея?</strong>
          <p>
            Начните с небольшой задачи.
            <br />
            Большие изменения — впереди.
          </p>
          <Link to="/requests/new">
            Создать заявку <ArrowRight size={16} />
          </Link>
        </div>
        <div className="user-panel">
          <span className="avatar">
            {session.user.email?.[0]?.toUpperCase() ?? "U"}
          </span>
          <div>
            <strong>Мой аккаунт</strong>
            <small title={session.user.email}>{session.user.email}</small>
          </div>
          <button
            className="icon-button"
            onClick={logout}
            disabled={signingOut}
            aria-label="Выйти из аккаунта"
            title="Выйти"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <span>
            Автоматизация <ChevronRight size={14} /> <strong>Мои заявки</strong>
          </span>
          <span className="topbar-note">
            <span className="online-dot" /> Всё начинается с идеи
          </span>
        </header>
        {error && (
          <div className="page-alert">
            <Notice>{error}</Notice>
          </div>
        )}
        <Routes>
          <Route path="/requests" element={<RequestList />} />
          <Route
            path="/requests/new"
            element={<RequestEditor key={location.pathname} />}
          />
          <Route
            path="/requests/:id"
            element={<RequestEditor key={location.pathname} />}
          />
          <Route path="*" element={<Navigate to="/requests" replace />} />
        </Routes>
        <footer className="workspace-footer">
          <span>LD LATTE / Внутренние инструменты</span>
          <span>
            <CircleHelp size={14} /> Упрощаем работу вместе
          </span>
        </footer>
      </div>
    </div>
  );
}

function RequestList() {
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<Status | "">(""),
    [page, setPage] = useState(0),
    [reload, setReload] = useState(0);
  const [rows, setRows] = useState<RequestRow[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const location = useLocation();
  const [success, setSuccess] = useState<string>(
    () => (location.state as { saved?: string } | null)?.saved ?? "",
  );
  useEffect(() => {
    if (location.state)
      window.history.replaceState({ ...window.history.state, usr: null }, "");
  }, [location.state]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    listRequests(debounced, status, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setRows(result.rows);
          setCount(result.count);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(humanError(e));
          setRows([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced, status, page, reload]);
  const filtered = Boolean(search.trim() || status);
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ОТ ИДЕИ К РЕЗУЛЬТАТУ</span>
          <h1>
            Мои заявки<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Всё, что вы хотите сделать проще, — в одном месте.
          </p>
        </div>
        <Link className="button primary" to="/requests/new">
          <Plus size={19} /> Новая заявка
        </Link>
      </div>
      {success && (
        <div className="success-line" role="status">
          <CheckCircle2 size={18} />
          {success}
          <button
            className="icon-button"
            onClick={() => setSuccess("")}
            aria-label="Закрыть уведомление"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="intro-strip">
        <span className="intro-icon">
          <Sparkles size={21} />
        </span>
        <div>
          <strong>Освободите время для важного</strong>
          <p>
            Бот, интеграция или отчёт — расскажите, какую задачу хотите
            автоматизировать.
          </p>
        </div>
        <span className="strip-arrow">↗</span>
      </div>
      <section className="requests-panel" aria-label="Список заявок">
        <div className="panel-toolbar">
          <div className="tabs" aria-label="Фильтр по статусу">
            {(
              [["", "Все заявки"], ...Object.entries(statuses)] as [
                Status | "",
                string,
              ][]
            ).map(([key, label]) => (
              <button
                key={key}
                className={status === key ? "tab selected" : "tab"}
                aria-pressed={status === key}
                onClick={() => {
                  setStatus(key);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Поиск по названию"
              placeholder="Поиск по названию"
              maxLength={160}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => setSearch("")}
                aria-label="Очистить поиск"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="list-meta">
          <span>
            {filtered ? "Результаты поиска и фильтра" : "Ваши заявки"}{" "}
            {!loading && !error && <b>{count}</b>}
          </span>
          <span>Сначала новые</span>
        </div>
        {loading ? (
          <Spinner label="Загружаем заявки" />
        ) : error ? (
          <div className="empty">
            <Notice>{error}</Notice>
            <button
              className="button secondary"
              onClick={() => setReload((x) => x + 1)}
            >
              Попробовать ещё раз
            </button>
          </div>
        ) : !rows.length ? (
          <div className="empty">
            <span className="empty-icon">
              {filtered ? <Search size={28} /> : <FileText size={28} />}
            </span>
            <h2>
              {filtered
                ? "Пока ничего не нашли"
                : "Здесь начнётся что-то полезное"}
            </h2>
            <p>
              {filtered
                ? "Попробуйте другое название или измените статус."
                : "Создайте первую заявку — опишите задачу, которую хочется упростить."}
            </p>
            {filtered ? (
              <button
                className="button secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(0);
                }}
              >
                Сбросить фильтры
              </button>
            ) : (
              <Link className="button primary" to="/requests/new">
                <Plus size={18} />
                Создать заявку
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="table-heading">
              <span>ЗАЯВКА</span>
              <span>КАТЕГОРИЯ</span>
              <span>СОЗДАНА</span>
              <span>СТАТУС</span>
              <span />
            </div>
            <div className="request-rows">
              {rows.map((row) => {
                const Icon = icons[row.category] ?? Sparkles;
                return (
                  <Link
                    className="request-row"
                    key={row.id}
                    to={`/requests/${row.id}`}
                  >
                    <span className={`request-title category-${row.category}`}>
                      <span className="category-icon">
                        <Icon size={20} />
                      </span>
                      <span>
                        <strong>{row.title}</strong>
                        <small>{row.description}</small>
                      </span>
                    </span>
                    <span className="row-category">
                      {categories[row.category]}
                    </span>
                    <time dateTime={row.created_at}>
                      {date(row.created_at)}
                    </time>
                    <Badge status={row.status} />
                    <ChevronRight size={18} className="row-arrow" />
                  </Link>
                );
              })}
            </div>
          </>
        )}
        {!loading && !error && count > pageSize && (
          <div className="pagination">
            <span>
              Страница {page + 1} из {Math.ceil(count / pageSize)}
            </span>
            <div>
              <button
                className="icon-button"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Предыдущая страница"
              >
                <ChevronLeft size={19} />
              </button>
              <button
                className="icon-button"
                disabled={(page + 1) * pageSize >= count}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Следующая страница"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="list-footnote">
        <CheckCircle2 size={14} /> Только вы можете просматривать и изменять
        свои заявки.
      </p>
    </main>
  );
}

function RequestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<RequestRow | null>(null),
    [loading, setLoading] = useState(Boolean(id)),
    [loadError, setLoadError] = useState(""),
    [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft }),
    [status, setStatus] = useState<Status>("new");
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [existingId, setExistingId] = useState("");
  const [attemptId] = useState(() => crypto.randomUUID()),
    [reload, setReload] = useState(0);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    let current = true;
    setLoading(true);
    setLoadError("");
    setNotFound(false);
    getRequest(id)
      .then((data) => {
        if (!current) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setRow(data);
        setDraft({
          title: data.title,
          description: data.description,
          category: data.category,
        });
        setStatus(data.status);
        setConflict(false);
        setError("");
      })
      .catch((e) => {
        if (current) setLoadError(humanError(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [id, reload]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || conflict || existingId) return;
    const validation = validateDraft(draft);
    setErrors(validation);
    if (Object.keys(validation).length) {
      document.getElementById(Object.keys(validation)[0])?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (id && row) {
        const updated = await updateRequest(row, draft, status);
        if (!updated) {
          const current = await getRequest(id);
          if (!alive.current) return;
          if (
            !current ||
            !matchesDraft(current, draft) ||
            current.status !== status
          ) {
            setConflict(true);
            setError(
              "Заявка изменилась в другой вкладке или стала недоступна. Обновите её перед сохранением. Ваш текст пока остаётся в форме.",
            );
            return;
          }
        }
      } else await createRequest(attemptId, draft);
      if (alive.current)
        navigate("/requests", {
          state: {
            saved: id
              ? "Изменения сохранены"
              : "Заявка создана. Её можно открыть и изменить в любое время.",
          },
        });
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof CreateConflict) {
        setExistingId(e.row.id);
        setError(
          "Предыдущая попытка уже создала заявку с другими данными. Откройте её для редактирования. Текущий текст остаётся здесь.",
        );
      } else setError(humanError(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="page">
        <Spinner label="Открываем заявку" />
      </main>
    );
  if (loadError || notFound)
    return (
      <main className="page">
        <Link className="back-link" to="/requests">
          <ArrowLeft size={17} />К заявкам
        </Link>
        <div className="form-card">
          <h1>
            {notFound
              ? "Заявка не найдена или недоступна"
              : "Не удалось открыть заявку"}
          </h1>
          {loadError && (
            <>
              <Notice>{loadError}</Notice>
              <button
                className="button secondary"
                onClick={() => setReload((r) => r + 1)}
              >
                Повторить
              </button>
            </>
          )}
        </div>
      </main>
    );
  return (
    <main className="page editor-page">
      <Link className="back-link" to="/requests">
        <ArrowLeft size={17} />
        Все заявки
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {id ? "ДЕТАЛИ И СОСТОЯНИЕ" : "ПЕРВЫЙ ШАГ К ИЗМЕНЕНИЯМ"}
          </span>
          <h1>
            {id ? "Ваша заявка" : "Новая заявка"}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {id
              ? "Уточните детали или обновите статус задачи."
              : "Расскажите, что вы хотите автоматизировать."}
          </p>
        </div>
        {row && <Badge status={row.status} />}
      </div>
      <div className="editor-grid">
        <section className="form-card">
          <form onSubmit={submit} noValidate>
            {error && <Notice>{error}</Notice>}
            {conflict && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setReload((x) => x + 1)}
              >
                Загрузить актуальную версию вместо текста формы
              </button>
            )}
            {existingId && (
              <Link className="button secondary" to={`/requests/${existingId}`}>
                Открыть созданную заявку
              </Link>
            )}
            <fieldset disabled={busy || conflict || Boolean(existingId)}>
              <label htmlFor="title">
                Название заявки <span>*</span>
              </label>
              <input
                id="title"
                autoFocus
                value={draft.title}
                maxLength={160}
                placeholder="Например, бот для записи на обучение"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "title-error" : "title-hint"}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              {errors.title ? (
                <p className="field-error" id="title-error">
                  {errors.title}
                </p>
              ) : (
                <p className="field-hint" id="title-hint">
                  Коротко и по делу. До 160 символов.
                </p>
              )}
              <label htmlFor="description">
                Описание задачи <span>*</span>
              </label>
              <textarea
                id="description"
                rows={7}
                maxLength={10000}
                value={draft.description}
                placeholder="Как задача решается сейчас? Что хочется изменить и какой результат получить?"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? "description-error" : "description-hint"
                }
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
              {errors.description ? (
                <p className="field-error" id="description-error">
                  {errors.description}
                </p>
              ) : (
                <p className="field-hint" id="description-hint">
                  Добавьте контекст — так идею будет проще понять.
                </p>
              )}
              <div className="form-columns">
                <div>
                  <label htmlFor="category">
                    Категория <span>*</span>
                  </label>
                  <select
                    id="category"
                    value={draft.category}
                    aria-invalid={Boolean(errors.category)}
                    aria-describedby={
                      errors.category ? "category-error" : undefined
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        category: e.target.value as Category,
                      })
                    }
                  >
                    <option value="">Выберите категорию</option>
                    {Object.entries(categories).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="field-error" id="category-error">
                      {errors.category}
                    </p>
                  )}
                </div>
                {id && (
                  <div>
                    <label htmlFor="status">Статус</label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Status)}
                    >
                      {Object.entries(statuses).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="form-actions">
                <button
                  className="button primary"
                  disabled={busy || conflict || Boolean(existingId)}
                >
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Check size={18} />
                  )}{" "}
                  {busy
                    ? "Сохраняем…"
                    : id
                      ? "Сохранить изменения"
                      : "Создать заявку"}
                </button>
                <Link className="button text" to="/requests">
                  {busy ? "Вернуться к списку" : "Отмена"}
                </Link>
              </div>
            </fieldset>
          </form>
        </section>
        <aside className="editor-note">
          <span className="tip-icon">
            <Sparkles size={22} />
          </span>
          <h3>
            {id ? "Всё под вашим контролем" : "Что можно автоматизировать?"}
          </h3>
          <p>
            {id
              ? "В тестовом сервисе вы сами управляете статусом своей заявки."
              : "Повторяющиеся действия, сбор данных, уведомления и отчёты. Даже маленькая идея может сэкономить много времени."}
          </p>
          {row ? (
            <dl>
              <dt>Создана</dt>
              <dd>{date(row.created_at)}</dd>
              <dt>Обновлена</dt>
              <dd>{date(row.updated_at)}</dd>
            </dl>
          ) : (
            <div className="note-status">
              <Badge status="new" />
              <p>Этот статус заявка получит автоматически.</p>
            </div>
          )}
          <div className="note-divider" />
          <p className="note-private">
            <CheckCircle2 size={16} /> Видна только вам
          </p>
        </aside>
      </div>
    </main>
  );
}

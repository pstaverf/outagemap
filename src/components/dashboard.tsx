"use client";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, signIn } from "next-auth/react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Droplets,
  Flame,
  Layers,
  ListFilter,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
  Wifi,
  X,
  Zap,
  Lightbulb,
  Construction,
} from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import {
  categories,
  statuses,
  listSchema,
  type IssueView,
} from "@/lib/schemas";
import type { MapLayer } from "@/lib/map-style";
import type { Bounds } from "./map";
import { Modal } from "./dialog";
import { CreateForm } from "./create-form";
import { IssueDetail } from "./issue-detail";
import { Reviews } from "./reviews";
import {
  geocodeResultSchema,
  issueDetailSchema,
  locationSchema,
  type Location,
} from "@/lib/schemas";
const Map = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Activity size={25} />
      <span>Загружаем карту…</span>
    </div>
  ),
});
const icons = {
  POWER: Zap,
  WATER: Droplets,
  HEATING: Flame,
  INTERNET: Wifi,
  ROAD: Construction,
  LIGHTING: Lightbulb,
  WASTE: Trash2,
  OTHER: TriangleAlert,
};
const geocodeSchema = z.array(geocodeResultSchema);
export function Dashboard({ initialLocation }: { initialLocation: Location }) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const { data: session } = useSession();
  const client = useQueryClient();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [bounds, setBounds] = useState<Bounds>({
    west: 76.8,
    east: 77.1,
    south: 43.15,
    north: 43.35,
  });
  const [center, setCenter] = useState<[number, number]>(
    initialLocation.center,
  );
  const [city, setCity] = useState(initialLocation.city);
  const [layer, setLayer] = useState<MapLayer>("scheme");
  const [selected, setSelected] = useState<IssueView | null>(null);
  const [remember, setRemember] = useState(false);
  const [login, setLogin] = useState(false);
  const [cityDialog, setCityDialog] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<z.infer<typeof geocodeSchema>>(
    [],
  );
  const [picking, setPicking] = useState(false);
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState("");
  const [cookie, setCookie] = useState(false);
  const [tab, setTab] = useState<"issues" | "about" | "reviews">("issues");
  const [sort, setSort] = useState("date");
  const [period, setPeriod] = useState("all");
  const [region, setRegion] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] =
    useState<z.infer<typeof geocodeResultSchema>["geojson"]>();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    void api("/api/location", locationSchema).catch(() => undefined);
    if (sessionStorage.getItem("outagemap:tab") === "reviews")
      setTab("reviews");
    setCookie(!document.cookie.includes("outagemap-consent="));
    const savedLayer = document.cookie.match(
      /outagemap-layer=(scheme|satellite|hybrid)/,
    )?.[1];
    if (savedLayer) setLayer(savedLayer as MapLayer);
  }, []);
  const params = useMemo(() => {
    const p = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(bounds).map(([k, v]) => [k, String(v)]),
      ),
      q: query,
      sort,
      period,
      region,
    });
    if (category) p.set("category", category);
    if (status) p.set("status", status);
    return p;
  }, [bounds, query, category, status, sort, period, region]);
  const issues = useInfiniteQuery({
    queryKey: ["issues", params.toString()],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api(
        `/api/issues?${params}${pageParam ? `&cursor=${pageParam}` : ""}`,
        listSchema,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = useMemo(
    () => issues.data?.pages.flatMap((page) => page.items) ?? [],
    [issues.data],
  );
  const select = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item) setSelected(item);
      else
        void api(`/api/issues/${encodeURIComponent(id)}`, issueDetailSchema)
          .then((issue) => setSelected(issue))
          .catch((error) =>
            setMessage(
              error instanceof Error ? error.message : "Проблема не найдена",
            ),
          );
      window.history.replaceState(null, "", `/?issue=${id}`);
    },
    [items],
  );
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("issue");
    if (!id) return;
    void api(`/api/issues/${encodeURIComponent(id)}`, issueDetailSchema)
      .then((issue) => {
        setSelected(issue);
        setCenter([issue.lng, issue.lat]);
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Проблема недоступна",
        ),
      );
  }, []);
  const notify = useCallback((text: string) => setMessage(text), []);
  const pick = useCallback((lat: number, lng: number) => {
    setPoint([lat, lng]);
    setPicking(false);
  }, []);
  function create() {
    if (!session) {
      sessionStorage.setItem("outagemap:action", "create");
      setLogin(true);
      return;
    }
    setPicking(true);
    setSelected(null);
    if (process.env.NEXT_PUBLIC_SATELLITE_URL) changeLayer("satellite");
  }
  useEffect(() => {
    if (session && sessionStorage.getItem("outagemap:action") === "create") {
      sessionStorage.removeItem("outagemap:action");
      setPicking(true);
    }
  }, [session]);
  function locate() {
    if (!navigator.geolocation) {
      notify("Геолокация не поддерживается");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter([longitude, latitude]);
        if (picking) {
          setPoint([latitude, longitude]);
          setPicking(false);
        }
        void api(
          `/api/geocode?lat=${latitude}&lng=${longitude}`,
          geocodeResultSchema,
        )
          .then((result) => {
            setCity(
              result.display_name.split(",").slice(-3, -2)[0]?.trim() || city,
            );
            setHighlight(result.geojson);
            notify(result.display_name);
          })
          .catch((error) =>
            notify(
              error instanceof Error ? error.message : "Адрес не определён",
            ),
          );
      },
      () =>
        notify("Не удалось определить местоположение. Выберите город вручную."),
      { timeout: 10000 },
    );
  }
  async function chooseCity(value: { city: string; center: [number, number] }) {
    try {
      await api("/api/location", locationSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...value,
          region: "",
          zoom: 13,
          source: "choice",
        }),
      });
      setCity(value.city);
      setCenter(value.center);
      setCityDialog(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось сохранить город",
      );
    }
  }
  function changeLayer(value: MapLayer) {
    if (value !== "scheme" && !process.env.NEXT_PUBLIC_SATELLITE_URL) {
      notify("Спутниковый слой не подключён оператором сервиса");
      return;
    }
    setLayer(value);
    document.cookie = `outagemap-layer=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  async function findCity() {
    try {
      setCityResults(
        await api(
          `/api/geocode?q=${encodeURIComponent(citySearch)}`,
          geocodeSchema,
        ),
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Поиск недоступен");
    }
  }
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Activity size={22} strokeWidth={2.5} />
          </span>
          OutageMap<span className="brand-tag">Карта городских проблем</span>
        </Link>
        <nav className="main-nav">
          <span className="nav-current">{t("map")}</span>
          <button onClick={() => setTab("about")}>
            О проекте <ArrowRight size={14} />
          </button>
        </nav>
        <div className="header-actions">
          <label className="language">
            <span className="sr-only">Язык</span>
            <select
              aria-label="Язык"
              value={locale}
              onChange={(e) => {
                document.cookie = `outagemap-locale=${e.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`;
                window.location.reload();
              }}
            >
              <option value="ru">RU</option>
              <option value="kk">ҚАЗ</option>
            </select>
          </label>
          <button
            className="login-button"
            onClick={() =>
              session ? window.location.assign("/profile") : setLogin(true)
            }
          >
            <UserRound size={17} />
            {session ? t("profile") : t("login")}
          </button>
        </div>
      </header>
      <div
        className="app-body"
        style={
          { "--sheet-height": expanded ? "82%" : "54%" } as React.CSSProperties
        }
      >
        <aside className={`sidebar ${selected ? "has-selection" : ""}`}>
          <button
            className="sheet-handle"
            aria-label={expanded ? "Свернуть список" : "Развернуть список"}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            onTouchStart={(e) => {
              const y = e.touches[0]?.clientY;
              if (y !== undefined) e.currentTarget.dataset.startY = String(y);
            }}
            onTouchEnd={(e) => {
              const y = e.changedTouches[0]?.clientY;
              const start = Number(e.currentTarget.dataset.startY);
              if (y !== undefined && Math.abs(y - start) > 20)
                setExpanded(y < start);
            }}
          />
          <div className="sidebar-intro">
            <div className="eyebrow">
              <span className="live-dot" /> СИТУАЦИЯ В ГОРОДЕ
            </div>
            <div className="title-row">
              <h1>{city}</h1>
              <button
                className="city-switch"
                onClick={() => setCityDialog(true)}
              >
                Изменить <ChevronDown size={13} />
              </button>
            </div>
            <p>{t("intro")}</p>
            <button className="primary add-button" onClick={create}>
              <Plus size={19} />
              {t("create")}
            </button>
          </div>
          <div className="sidebar-tabs">
            <button
              className={tab === "issues" ? "active" : ""}
              onClick={() => setTab("issues")}
            >
              Проблемы рядом <span>{items.length}</span>
            </button>
            <button
              className={tab === "about" ? "active" : ""}
              onClick={() => setTab("about")}
            >
              {t("aboutMap")}
            </button>
            <button
              className={tab === "reviews" ? "active" : ""}
              onClick={() => setTab("reviews")}
            >
              {t("reviews")}
            </button>
          </div>
          {tab === "reviews" ? (
            <Reviews key={city} city={city} onLogin={() => setLogin(true)} />
          ) : tab === "about" ? (
            <section className="about-panel">
              <ShieldCheck size={28} />
              <h2>Карта, которую создают жители</h2>
              <p>
                Отметьте проблему на карте. Соседи смогут подтвердить её или
                сообщить, что всё уже работает.
              </p>
              <h3>Три подтверждения</h3>
              <p>
                После трёх отметок «У меня тоже» проблема получает статус
                «Подтверждена».
              </p>
              <h3>Только актуальная информация</h3>
              <p>
                Если проблема решена, автор может закрыть её. Неточные сведения
                можно отправить модератору.
              </p>
              <Link href="/privacy">
                Как мы обрабатываем данные <ArrowRight size={14} />
              </Link>
            </section>
          ) : (
            <>
              <div className="filters">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Поиск проблем"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("search")}
                  />
                </div>
                <div className="filter-row">
                  <select
                    aria-label="Категория"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">{t("allCategories")}</option>
                    {Object.keys(categories).map((key) => (
                      <option key={key} value={key}>
                        {t(`categories.${key}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Статус"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">{t("allStatuses")}</option>
                    {Object.keys(statuses)
                      .filter((key) => key !== "REJECTED")
                      .map((key) => (
                        <option key={key} value={key}>
                          {t(`statuses.${key}`)}
                        </option>
                      ))}
                  </select>
                  <button
                    className="icon-button filter-reset"
                    aria-label="Сбросить фильтры"
                    onClick={() => {
                      setCategory("");
                      setStatus("");
                      setSearch("");
                      setSort("date");
                      setPeriod("all");
                      setRegion("");
                    }}
                  >
                    <ListFilter size={17} />
                  </button>
                </div>
                <div className="filter-extra">
                  <select
                    aria-label="Период"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="all">{t("periodAll")}</option>
                    <option value="day">{t("periodDay")}</option>
                    <option value="week">{t("periodWeek")}</option>
                    <option value="month">{t("periodMonth")}</option>
                  </select>
                  <select
                    aria-label="Сортировка"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="date">{t("sortDate")}</option>
                    <option value="affected">{t("sortAffected")}</option>
                  </select>
                  <input
                    aria-label="Регион"
                    placeholder={t("region")}
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                </div>
              </div>
              <div className="list-heading">
                <span>
                  {query || category || status ? t("results") : t("inView")}{" "}
                  <b>{items.length}</b>
                </span>
                <span>
                  {sort === "date" ? t("newest") : t("sortAffected")}{" "}
                  <ArrowDown size={12} />
                </span>
              </div>
              <div className="issue-list">
                {issues.isLoading ? (
                  [1, 2, 3].map((n) => <div key={n} className="skeleton" />)
                ) : issues.isError ? (
                  <div className="empty-state">
                    <TriangleAlert size={27} />
                    <h3>{t("loadError")}</h3>
                    <p>
                      Проверьте подключение. Мы не показываем вымышленные
                      сообщения.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => issues.refetch()}
                    >
                      {t("retry")}
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="empty-state">
                    <MapPin size={30} />
                    <h3>{t("emptyTitle")}</h3>
                    <p>{t("emptyText")}</p>
                    <button onClick={create} className="text-button">
                      Добавить проблему <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  items.map((issue) => {
                    const Icon = icons[issue.category];
                    return (
                      <button
                        className={`issue-item ${selected?.id === issue.id ? "selected" : ""}`}
                        key={issue.id}
                        onClick={() => select(issue.id)}
                      >
                        <div className="issue-item-top">
                          <span
                            className={`category-icon ${issue.status.toLowerCase()}`}
                          >
                            <Icon size={18} />
                          </span>
                          <span className="issue-category">
                            {t(`categories.${issue.category}`)}
                          </span>
                          <span className="issue-time">
                            {new Intl.DateTimeFormat("ru", {
                              day: "numeric",
                              month: "short",
                            }).format(new Date(issue.createdAt))}
                          </span>
                        </div>
                        <h3>{issue.title}</h3>
                        <p className="issue-address">
                          <MapPin size={12} />
                          {issue.address || issue.city}
                        </p>
                        <div className="issue-item-bottom">
                          <span
                            className={`status-badge ${issue.status.toLowerCase()}`}
                          >
                            <span />
                            {t(`statuses.${issue.status}`)}
                          </span>
                          <span>
                            <UserRound size={13} />
                            {issue.affected} подтверждений
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
                {issues.hasNextPage && (
                  <button
                    className="load-more"
                    disabled={issues.isFetchingNextPage}
                    onClick={() => issues.fetchNextPage()}
                  >
                    {t("loadMore")}
                  </button>
                )}
              </div>
            </>
          )}
          <footer className="sidebar-footer">
            <span>
              <span className="live-dot" /> Обновляется по сообщениям жителей
            </span>
            <div>
              <Link href="/privacy">{t("privacy")}</Link>
              <Link href="/terms">{t("rules")}</Link>
              <Link href="/cookies">Cookie</Link>
            </div>
          </footer>
        </aside>
        <section className="map-section">
          <Map
            initialZoom={initialLocation.zoom}
            draftPoint={point}
            highlight={highlight}
            issues={items}
            layer={layer}
            center={center}
            picking={picking}
            onBounds={setBounds}
            onSelect={select}
            onPick={pick}
            onError={notify}
          />
          <div className="location-notice">
            <MapPin size={16} />
            <span title="IP даёт только приблизительную местность, не адрес устройства">
              Показываем район: <b>{city}</b>
              {initialLocation.source === "ip" ? " · приблизительно" : ""}
            </span>
            <span className="notice-divider" />
            <button onClick={() => setCityDialog(true)}>{t("change")}</button>
            <button
              className="icon-button"
              aria-label="Моё местоположение"
              onClick={locate}
            >
              <Crosshair size={16} />
            </button>
          </div>
          <div className="map-key">
            <span>
              <i className="key-open" />
              Открыта
            </span>
            <span>
              <i className="key-confirmed" />
              Подтверждена
            </span>
            <span>
              <i className="key-resolved" />
              Решена
            </span>
          </div>
          <div className="map-layer-control">
            <Layers size={17} />
            {(["scheme", "satellite", "hybrid"] as const).map(
              (value, index) => (
                <button
                  key={value}
                  className={layer === value ? "active" : ""}
                  onClick={() => changeLayer(value)}
                >
                  {[t("scheme"), t("satellite"), t("hybrid")][index]}
                </button>
              ),
            )}
          </div>
          <button
            className="map-help"
            onClick={() => setTab("about")}
            aria-label="Помощь"
          >
            <CircleHelp size={19} />
          </button>
          {picking && (
            <div className="pick-banner">
              <MapPin size={19} />
              <div>
                <b>Где произошла проблема?</b>
                <p>
                  Нажмите на дом или{" "}
                  <button
                    className="text-button"
                    onClick={() => setCityDialog(true)}
                  >
                    найдите адрес
                  </button>
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Отменить"
                onClick={() => setPicking(false)}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {selected && (
            <IssueDetail
              id={selected.id}
              notify={notify}
              onLogin={() => setLogin(true)}
              onClose={() => {
                setSelected(null);
                window.history.replaceState(null, "", "/");
              }}
            />
          )}
          <div className="map-caption">
            <ShieldCheck size={14} />
            {t("disclaimer")}
          </div>
        </section>
      </div>
      {cookie && (
        <div className="cookie-banner">
          <div>
            <b>Только необходимые cookie</b>
            <p>
              Храним сессию и настройки карты. IP может использоваться для
              приблизительного определения города, но не сохраняется.{" "}
              <Link href="/cookies">Подробнее</Link>
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => {
              document.cookie =
                "outagemap-consent=necessary; Path=/; Max-Age=31536000; SameSite=Lax";
              setCookie(false);
            }}
          >
            Понятно
          </button>
        </div>
      )}
      {message && (
        <div role="status" className="toast">
          <TriangleAlert size={18} />
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Modal
        title="Войти в OutageMap"
        open={login}
        onClose={() => setLogin(false)}
      >
        <div className="auth-content">
          <div className="auth-icon">
            <UserRound size={26} />
          </div>
          <p>
            Сообщайте о проблемах и помогайте соседям, подтверждая актуальную
            информацию.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await api(
                  "/api/preferences",
                  z.object({ saved: z.boolean() }),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ remember }),
                  },
                );
                await signIn("google", { callbackUrl: window.location.href });
              } catch (error) {
                notify(
                  error instanceof Error ? error.message : "Вход недоступен",
                );
              }
            }}
          >
            Продолжить с Google
          </button>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Запомнить меня на 30 дней
          </label>
          <div className="or-divider">или по электронной почте</div>
          <form
            action={async (form) => {
              try {
                await api(
                  "/api/preferences",
                  z.object({ saved: z.boolean() }),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ remember }),
                  },
                );
                await signIn("nodemailer", {
                  email: String(form.get("email")),
                  callbackUrl: window.location.href,
                });
              } catch (error) {
                notify(
                  error instanceof Error ? error.message : "Вход недоступен",
                );
              }
            }}
          >
            <label className="sr-only" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
            />
            <button className="primary">Получить ссылку для входа</button>
          </form>
          <p className="fine-print">
            Продолжая, вы принимаете <Link href="/terms">правила сервиса</Link>{" "}
            и <Link href="/privacy">политику конфиденциальности</Link>.
          </p>
        </div>
      </Modal>
      <Modal
        title={t("chooseCity")}
        open={cityDialog}
        onClose={() => setCityDialog(false)}
      >
        <form
          className="city-search"
          onSubmit={(e) => {
            e.preventDefault();
            void findCity();
          }}
        >
          <input
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Город или адрес"
            minLength={3}
            required
          />
          <button className="primary">
            <Search size={17} />
            {t("find")}
          </button>
        </form>
        <div className="city-options">
          {[
            { city: "Алматы", center: [76.945, 43.244] },
            { city: "Астана", center: [71.43, 51.13] },
            { city: "Москва", center: [37.617, 55.755] },
            { city: "Казань", center: [49.122, 55.788] },
          ].map((place) => (
            <button
              key={place.city}
              onClick={() => {
                void chooseCity({
                  city: place.city,
                  center: place.center as [number, number],
                });
              }}
            >
              <MapPin size={17} />
              {place.city}
              <ArrowRight size={15} />
            </button>
          ))}
          {cityResults.map((result) => (
            <button
              key={result.display_name}
              onClick={() => {
                setHighlight(result.geojson);
                if (picking) {
                  setCenter([result.lon, result.lat]);
                  setPoint([result.lat, result.lon]);
                  setPicking(false);
                  setCityDialog(false);
                } else
                  void chooseCity({
                    city: result.display_name.split(",")[0],
                    center: [result.lon, result.lat],
                  });
              }}
            >
              {result.display_name}
            </button>
          ))}
        </div>
        <p className="fine-print">
          Выбранный город не определяет точное местоположение устройства.
        </p>
      </Modal>
      <Modal
        title={t("create")}
        open={Boolean(point)}
        onClose={() => setPoint(null)}
      >
        {point && (
          <CreateForm
            city={city}
            point={point}
            onDone={() => {
              setPoint(null);
              void client.invalidateQueries({ queryKey: ["issues"] });
              notify("Проблема опубликована. Спасибо за сообщение.");
            }}
          />
        )}
      </Modal>
    </main>
  );
}

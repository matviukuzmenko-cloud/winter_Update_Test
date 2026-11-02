(() => {
  const progressKey = "flora-expedition-progress";
  const grid = document.querySelector("#expedition-grid");
  const status = document.querySelector("#expedition-status");
  if (!grid) throw new Error("Не удалось инициализировать ботанические экспедиции.");
  const winterFindKeys = new Set(
    [...document.querySelectorAll("[data-winter-easter]")].map((button) => button.dataset.winterEaster)
  );

  const routes = [
    {
      id: "discover",
      title: "Знакомство с растениями",
      subtitle: "Откройте карточки пяти разных растений.",
      goal: 5,
      reward: 50,
      icon: "book",
      action: "catalog",
      actionLabel: "Открыть атлас",
      metric: "visitedIds",
    },
    {
      id: "herbarium",
      title: "Личная коллекция",
      subtitle: "Сохраните три растения, которые вам понравились.",
      goal: 3,
      reward: 60,
      icon: "flower",
      action: "catalog",
      actionLabel: "Выбрать растения",
      metric: "collectedIds",
    },
    {
      id: "garden",
      title: "Забота о саде",
      subtitle: "Трижды отметьте уход за растениями. Сначала проверьте почву.",
      goal: 3,
      reward: 70,
      icon: "water",
      action: "garden",
      actionLabel: "Открыть мой сад",
      metric: "careActions",
    },
    {
      id: "seasons",
      title: "Наблюдатель природы",
      subtitle: "Запишите два наблюдения за цветением.",
      goal: 2,
      reward: 60,
      icon: "calendar",
      action: "season",
      actionLabel: "Добавить наблюдение",
      metric: "seasonKeys",
    },
    {
      id: "botanist",
      title: "Растительный знаток",
      subtitle: "Правильно ответьте на пять вопросов викторины.",
      goal: 5,
      reward: 80,
      icon: "spark",
      action: "botanist",
      actionLabel: "Начать викторину",
      metric: "quizCorrect",
    },
    {
      id: "winter-finds",
      title: "Зимние сюрпризы",
      subtitle: "Найдите все семь зимних сюрпризов в разных разделах сайта.",
      goal: 7,
      reward: 100,
      icon: "spark",
      action: "botanist",
      actionLabel: "Искать сюрпризы",
      metric: "winterFinds",
    },
  ];

  const emptyProgress = () => ({
    visitedIds: [],
    collectedIds: [],
    careActions: 0,
    seasonKeys: [],
    quizCorrect: 0,
    winterFinds: [],
    completed: [],
  });
  const validIds = (value) => Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === "string" && id.length <= 160))].slice(-1500)
    : [];
  const loadProgress = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) || "{}");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        throw new TypeError("Ожидался объект прогресса экспедиций.");
      }
      return {
        visitedIds: validIds(saved.visitedIds),
        collectedIds: validIds(saved.collectedIds),
        careActions: Number.isSafeInteger(saved.careActions) && saved.careActions >= 0 ? saved.careActions : 0,
        seasonKeys: validIds(saved.seasonKeys),
        quizCorrect: Number.isSafeInteger(saved.quizCorrect) && saved.quizCorrect >= 0 ? saved.quizCorrect : 0,
        winterFinds: validIds(saved.winterFinds),
        completed: validIds(saved.completed).filter((id) => routes.some((route) => route.id === id)),
      };
    } catch (error) {
      console.error("Не удалось прочитать прогресс ботанических экспедиций.", error);
      return emptyProgress();
    }
  };
  let progress = loadProgress();

  const parseArray = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(value)) return value;
      if (!value || typeof value !== "object") throw new TypeError(`Ожидался список в хранилище «${key}».`);
      const deleted = new Set(Object.keys(value)
        .filter((id) => id.startsWith("__deleted:") && value[id] === true)
        .map((id) => id.slice("__deleted:".length)));
      return Object.entries(value)
        .filter(([id, entry]) => !id.startsWith("__deleted:") && !deleted.has(id) && entry && typeof entry === "object")
        .map(([, entry]) => entry);
    } catch (error) {
      console.error(`Не удалось прочитать список «${key}».`, error);
      return [];
    }
  };
  const parseObject = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`Ожидался объект в хранилище «${key}».`);
      }
      return value;
    } catch (error) {
      console.error(`Не удалось прочитать данные «${key}».`, error);
      return {};
    }
  };
  const collectExistingProgress = () => {
    progress.collectedIds = [...new Set([
      ...progress.collectedIds,
      ...parseArray("flora-collection").filter((id) => typeof id === "string"),
    ])].slice(-1500);
    const storedPlans = parseArray("flora-care-settings");
    const recordedCare = storedPlans.reduce((total, plan) => {
      if (!plan || typeof plan !== "object") return total;
      const count = Number.isSafeInteger(plan.wateringCount) && plan.wateringCount >= 0
        ? plan.wateringCount
        : Array.isArray(plan.wateringHistory) ? plan.wateringHistory.length : plan.lastWatered ? 1 : 0;
      return total + count;
    }, 0);
    progress.careActions = Math.max(progress.careActions, recordedCare);
    const observations = parseObject("flora-season-observations");
    const observedPeriods = Object.entries(observations).flatMap(([plantId, periods]) =>
      Array.isArray(periods)
        ? periods.filter((period) => typeof period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(period))
          .map((period) => `${plantId}:${period}`)
        : []
    );
    progress.seasonKeys = [...new Set([...progress.seasonKeys, ...observedPeriods])].slice(-1500);
  };
  const saveProgress = () => {
    try {
      localStorage.setItem(progressKey, JSON.stringify(progress));
      window.dispatchEvent(new CustomEvent("flora:local-data-change", {
        detail: { key: progressKey, value: localStorage.getItem(progressKey) },
      }));
      status.textContent = "";
      return true;
    } catch (error) {
      console.error("Не удалось сохранить прогресс ботанических экспедиций.", error);
      status.textContent = "Не удалось сохранить прогресс. Проверьте свободное место в хранилище браузера.";
      return false;
    }
  };
  const metricValue = (route) => {
    const value = progress[route.metric];
    return Array.isArray(value) ? value.length : value;
  };
  const showReward = (route) => {
    window.dispatchEvent(new CustomEvent("flora:toast", {
      detail: {
        message: `Задание «${route.title}» выполнено! Вы получили ${route.reward} очков.`,
        type: "success",
        duration: 5200,
      },
    }));
  };
  const rankForXp = (xp) => {
    if (xp >= 320) return "Герой Silva";
    if (xp >= 240) return "Ботаник-мастер";
    if (xp >= 150) return "Хранитель сада";
    if (xp >= 60) return "Знаток растений";
    return "Начинающий исследователь";
  };
  const icon = (name) => `<svg class="ui-icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;

  const render = (forceSave = false) => {
    const previousProgress = JSON.stringify(progress);
    collectExistingProgress();
    const newlyCompleted = [];
    routes.forEach((route) => {
      if (metricValue(route) >= route.goal && !progress.completed.includes(route.id)) {
        progress.completed.push(route.id);
        newlyCompleted.push(route);
      }
    });
    const xp = routes.reduce((total, route) => total + (progress.completed.includes(route.id) ? route.reward : 0), 0);
    const rank = rankForXp(xp);
    const completedRoutes = progress.completed.length;
    const progressWithinRank = routes.length ? Math.round((completedRoutes / routes.length) * 100) : 0;
    document.querySelector("#expedition-rank").textContent = rank;
    document.querySelector("#expedition-xp-bar").style.width = `${progressWithinRank}%`;
    const track = document.querySelector(".expedition-xp-track");
    track.setAttribute("aria-valuenow", String(completedRoutes));
    document.querySelector("#expedition-xp-label").textContent = `Выполнено заданий: ${completedRoutes} из ${routes.length} · ${xp} очков`;
    document.querySelector("#expedition-toggle-count").textContent = `${completedRoutes} из ${routes.length}`;
    document.querySelector("#expedition-discovered-count").textContent = String(progress.visitedIds.length);
    document.querySelector("#expedition-badge-count").textContent = String(progress.completed.length);
    document.querySelector("#expedition-care-count").textContent = String(progress.careActions);
    grid.innerHTML = routes.map((route, index) => {
      const current = Math.min(route.goal, metricValue(route));
      const complete = progress.completed.includes(route.id);
      const percent = Math.round((current / route.goal) * 100);
      return `<article class="expedition-card${complete ? " is-complete" : ""}">
        <div class="expedition-card-top"><span class="expedition-card-icon">${icon(route.icon)}</span><span class="expedition-step">${complete ? "ВЫПОЛНЕНО" : `ЗАДАНИЕ ${index + 1}`}</span></div>
        <h3>${route.title}</h3>
        <p>${route.subtitle}</p>
        <div class="expedition-progress-copy"><span>${complete ? "Готово!" : `${current} из ${route.goal}`}</span><strong>+${route.reward} очков</strong></div>
        <div class="expedition-progress-track" role="progressbar" aria-label="Прогресс маршрута «${route.title}»" aria-valuemin="0" aria-valuemax="${route.goal}" aria-valuenow="${current}"><span style="width:${percent}%"></span></div>
        <button class="button ${complete ? "ghost" : "secondary"} expedition-action" type="button" data-expedition-action="${route.action}"${complete ? " disabled" : ""}>${complete ? "Задание выполнено" : route.actionLabel}</button>
      </article>`;
    }).join("");
    const progressChanged = JSON.stringify(progress) !== previousProgress;
    if ((forceSave || progressChanged) && saveProgress()) newlyCompleted.forEach(showReward);
  };

  const moveTo = (page) => {
    window.floraNavigateTo?.(page);
    if (page === "garden") {
      requestAnimationFrame(() => document.querySelector("#garden-care")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else if (page === "season") {
      requestAnimationFrame(() => {
        document.querySelector("#season-search")?.focus({ preventScroll: true });
        document.querySelector("#season-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-expedition-action]");
    if (button && !button.disabled) moveTo(button.dataset.expeditionAction);
  });
  window.addEventListener("flora:plant-opened", (event) => {
    const plantId = event.detail?.plantId;
    if (typeof plantId !== "string" || progress.visitedIds.includes(plantId)) return;
    progress.visitedIds.push(plantId);
    render(true);
  });
  window.addEventListener("flora:plant-saved", (event) => {
    const { plantId, saved } = event.detail || {};
    if (saved !== true || typeof plantId !== "string" || progress.collectedIds.includes(plantId)) return;
    progress.collectedIds.push(plantId);
    render(true);
  });
  window.addEventListener("flora:care-action", () => {
    const plans = parseArray("flora-care-settings");
    const total = plans.reduce((sum, plan) => sum + (
      Number.isSafeInteger(plan?.wateringCount) ? plan.wateringCount : 0
    ), 0);
    progress.careActions = Math.max(progress.careActions, total);
    render(true);
  });
  window.addEventListener("flora:season-observation", (event) => {
    const { plantId, period } = event.detail || {};
    if (typeof plantId !== "string" || typeof period !== "string") return;
    const key = `${plantId}:${period}`;
    if (progress.seasonKeys.includes(key)) return;
    progress.seasonKeys.push(key);
    render(true);
  });
  window.addEventListener("flora:quiz-correct", () => {
    progress.quizCorrect += 1;
    render(true);
  });
  window.addEventListener("flora:winter-find", (event) => {
    const key = event.detail?.key;
    if (typeof key !== "string" || !winterFindKeys.has(key) || progress.winterFinds.includes(key)) return;
    progress.winterFinds.push(key);
    render(true);
  });
  window.addEventListener("flora:account-state", () => {
    progress = loadProgress();
    render();
  });
  window.addEventListener("flora:local-data-change", (event) => {
    if (event.detail?.key === progressKey) return;
    if (["flora-collection", "flora-care-settings", "flora-season-observations"].includes(event.detail?.key)) render();
  });
  window.addEventListener("storage", (event) => {
    if (!event.key || [progressKey, "flora-collection", "flora-care-settings", "flora-season-observations"].includes(event.key)) {
      progress = loadProgress();
      render();
    }
  });
  window.addEventListener("flora:page-change", (event) => {
    if (event.detail?.page === "botanist") render();
  });

  render();
})();

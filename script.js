const DEFAULT_EVENT_BACKGROUND = "linear-gradient(135deg, #121217 0%, #252429 100%)";
let sourceYamlText = "";
let hasLoadedSourceYaml = false;

document.addEventListener("DOMContentLoaded", () => {
  setupHeader();
  setupDevEditor();
  loadEvents();
});

function setupHeader() {
  const header = document.getElementById("site-header");

  const syncHeader = () => {
    header.classList.toggle("scrolled", window.scrollY > 8);
  };

  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });
}

async function loadEvents() {
  try {
    const response = await fetch("events.yaml", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load events.yaml (${response.status})`);
    }

    sourceYamlText = await response.text();
    hasLoadedSourceYaml = true;
    syncDevEditorValue(sourceYamlText);
    renderYamlText(sourceYamlText, {
      errorTitle: "Could not load events",
      errorMessage: "Check that events.yaml exists and contains valid YAML.",
    });
  } catch (error) {
    console.error(error);
    renderYamlError(
      "Could not load events",
      "Check that events.yaml exists and contains valid YAML.",
    );
  }
}

function setupDevEditor() {
  const openButton = document.getElementById("dev-editor-open");
  const closeButton = document.getElementById("dev-editor-close");
  const modal = document.getElementById("dev-editor-modal");
  const textarea = document.getElementById("dev-editor-textarea");

  openButton.addEventListener("click", () => {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    syncDevEditorValue(sourceYamlText);
    textarea.focus();
  });

  closeButton.addEventListener("click", closeDevEditor);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeDevEditor();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeDevEditor();
    }
  });

  textarea.addEventListener("input", () => {
    renderYamlText(textarea.value, {
      errorTitle: "YAML preview error",
      errorMessage: "Fix the YAML above to continue previewing your local changes.",
      statusTarget: document.getElementById("dev-editor-status"),
    });
  });
}

function closeDevEditor() {
  document.getElementById("dev-editor-modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function syncDevEditorValue(yamlText) {
  const textarea = document.getElementById("dev-editor-textarea");

  if (!textarea || !hasLoadedSourceYaml) {
    return;
  }

  if (document.activeElement !== textarea) {
    textarea.value = yamlText;
  }
}

function renderYamlText(yamlText, options = {}) {
  const statusTarget = options.statusTarget || document.getElementById("dev-editor-status");

  try {
    const parsed = window.jsyaml.load(yamlText);
    const events = normalizeEvents(parsed)
      .filter(isUpcomingEvent)
      .sort(sortByDateAscending);

    renderEventsState(events);

    if (statusTarget) {
      statusTarget.textContent = "Preview updated locally. Changes are not saved.";
      statusTarget.classList.remove("is-error");
    }
  } catch (error) {
    console.error(error);
    renderYamlError(
      options.errorTitle || "Could not render preview",
      options.errorMessage || "Check the YAML and try again.",
    );

    if (statusTarget) {
      statusTarget.textContent = error.message;
      statusTarget.classList.add("is-error");
    }
  }
}

function renderEventsState(events) {
  const grid = document.getElementById("events-grid");
  const emptyState = document.getElementById("empty-state");

  if (!events.length) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.querySelector("h3").textContent = "No upcoming events yet";
    emptyState.querySelector("p").textContent =
      "Add or update items in events.yaml and they will appear here.";
    return;
  }

  emptyState.classList.add("hidden");
  renderEvents(events, grid);
}

function renderYamlError(title, message) {
  const grid = document.getElementById("events-grid");
  const emptyState = document.getElementById("empty-state");

  grid.innerHTML = "";
  emptyState.classList.remove("hidden");
  emptyState.querySelector("h3").textContent = title;
  emptyState.querySelector("p").textContent = message;
}

function normalizeEvents(data) {
  if (Array.isArray(data)) {
    return data.filter(Boolean);
  }

  if (Array.isArray(data?.events)) {
    return data.events.filter(Boolean);
  }

  return [];
}

function isUpcomingEvent(event) {
  const date = parseEventDate(event?.end_date || event?.start_date);

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  const endOfEventDay = new Date(date);
  endOfEventDay.setHours(23, 59, 59, 999);
  return endOfEventDay >= new Date();
}

function sortByDateAscending(first, second) {
  return getTimestamp(first?.start_date || first?.end_date) - getTimestamp(second?.start_date || second?.end_date);
}

function getTimestamp(value) {
  const date = parseEventDate(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function renderEvents(events, grid) {
  grid.innerHTML = "";

  events.forEach((event) => {
    grid.appendChild(createEventCard(event));
  });
}

function createEventCard(event) {
  const article = document.createElement("article");
  article.className = "event-card";

  const cardIcon = event.icon;

  if (cardIcon) {
    const badge = document.createElement("div");
    badge.className = "event-logo-badge";

    const badgeImage = document.createElement("img");
    badgeImage.className = "event-logo-badge-image";
    badgeImage.src = cardIcon;
    badgeImage.alt = `${event.title || "Event"} icon`;

    badge.appendChild(badgeImage);
    article.appendChild(badge);
  }

  const visual = document.createElement("div");
  visual.className = "event-visual";
  visual.style.background = formatBackground(event.background);

  if (event.logo) {
    const logo = document.createElement("img");
    logo.className = "event-logo";
    logo.src = event.logo;
    logo.alt = event.title || "Event logo";
    visual.appendChild(logo);
  } else {
    const heading = document.createElement("h3");
    heading.className = "event-title-display";
    heading.textContent = event.title || "Untitled event";
    if (event.title_color) {
      heading.style.color = event.title_color;
    }
    visual.appendChild(heading);
  }

  const content = document.createElement("div");
  content.className = "event-content";

  const date = document.createElement("div");
  date.className = "event-date";
  date.textContent = formatDateRange(event.start_date, event.end_date);

  const relativeDate = document.createElement("div");
  relativeDate.className = "event-relative-date";
  relativeDate.textContent = formatRelativeDate(event.start_date, event.end_date);

  const description = document.createElement("p");
  description.className = "event-description";
  description.textContent = event.description || "Add a description in events.yaml.";

  const actions = document.createElement("div");
  actions.className = "event-actions";
  actions.appendChild(createIconLink(event.website, "Event website", "website"));
  actions.appendChild(createIconLink(event.slack, "Slack link", "slack"));

  content.append(date, relativeDate, description, actions);
  article.append(visual, content);

  return article;
}

function createIconLink(href, label, iconType) {
  const link = document.createElement("a");
  link.className = "event-link";
  link.href = href || "#";
  link.setAttribute("aria-label", label);
  link.innerHTML = getLinkIcon(iconType);

  if (href) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  } else {
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
  }

  return link;
}

function getLinkIcon(iconType) {
  if (iconType === "slack") {
    return `
      <img
        class="event-link-icon event-link-icon-image"
        src="https://www.svgrepo.com/show/473790/slack.svg"
        alt=""
      >
    `;
  }

  return `
    <img
      class="event-link-icon event-link-icon-image"
      src="https://www.svgrepo.com/show/532860/globe-alt-1.svg"
      alt=""
    >
  `;
}

function formatBackground(background) {
  if (!background || typeof background !== "string") {
    return DEFAULT_EVENT_BACKGROUND;
  }

  const trimmed = background.trim();

  if (/^(https?:\/\/|\/|\.\/)/.test(trimmed)) {
    return `linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.38)), url("${trimmed}") center/cover`;
  }

  return trimmed;
}

function formatDateRange(startDateString, endDateString) {
  const start = parseEventDate(startDateString);
  const end = parseEventDate(endDateString);

  if (Number.isNaN(start.getTime()) && Number.isNaN(end.getTime())) {
    return "Dates TBD";
  }

  if (Number.isNaN(end.getTime())) {
    return formatSingleDate(startDateString);
  }

  if (Number.isNaN(start.getTime())) {
    return formatSingleDate(endDateString);
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${new Intl.DateTimeFormat("en-US", {
      month: "long",
    }).format(start)} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }

  if (sameYear) {
    return `${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(start)} - ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(end)}`;
  }

  return `${formatSingleDate(startDateString)} - ${formatSingleDate(endDateString)}`;
}

function formatSingleDate(dateString) {
  const date = parseEventDate(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString || "Date TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeDate(startDateString, endDateString) {
  const start = parseEventDate(startDateString);
  const end = parseEventDate(endDateString || startDateString);

  if (Number.isNaN(start.getTime()) && Number.isNaN(end.getTime())) {
    return "";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventStart = new Date(Number.isNaN(start.getTime()) ? end : start);
  eventStart.setHours(0, 0, 0, 0);

  const eventEnd = new Date(Number.isNaN(end.getTime()) ? start : end);
  eventEnd.setHours(0, 0, 0, 0);

  const daysUntilStart = Math.round((eventStart - today) / 86400000);
  const daysUntilEnd = Math.round((eventEnd - today) / 86400000);

  if (daysUntilStart > 1) {
    return `Starts in ${daysUntilStart} days`;
  }

  if (daysUntilStart === 1) {
    return "Starts tomorrow";
  }

  if (daysUntilStart === 0 && daysUntilEnd === 0) {
    return "Ends today";
  }

  if (daysUntilStart === 0) {
    return "Starts today";
  }

  if (daysUntilEnd > 1) {
    return `${daysUntilEnd} days left`;
  }

  if (daysUntilEnd === 1) {
    return "Ends tomorrow";
  }

  if (daysUntilEnd === 0) {
    return "Ends today";
  }

  return "Ended";
}

function parseEventDate(value) {
  if (!value) {
    return new Date(NaN);
  }

  if (value instanceof Date) {
    return value;
  }

  const trimmed = String(value).trim();
  const localDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (localDateMatch) {
    const [, year, month, day] = localDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(trimmed);
}

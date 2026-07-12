const contacts = [
  { name: "Maya", role: "Daughter", note: "Last call: yesterday", color: "#4a6f91" },
  { name: "Samuel", role: "Son", note: "Visits every Friday", color: "#2f6f5e" },
  { name: "Hana", role: "Friend", note: "Tea group companion", color: "#c96856" },
  { name: "Pastor Daniel", role: "Prayer support", note: "Sunday service reminder", color: "#8a6a2d" }
];

const defaultRoutine = [
  { id: "breakfast", title: "Eat breakfast", time: "8:00 AM", done: false },
  { id: "medicine", title: "Take morning medicine", time: "8:15 AM", done: false },
  { id: "walk", title: "Gentle walk", time: "10:30 AM", done: false },
  { id: "call", title: "Call family or friend", time: "4:00 PM", done: false },
  { id: "evening", title: "Prepare for sleep", time: "8:30 PM", done: false }
];

const defaultReminders = [
  { id: makeId(), name: "Blood pressure tablet", time: "08:00", type: "Medication", done: false },
  { id: makeId(), name: "Drink water", time: "11:00", type: "Routine", done: false },
  { id: makeId(), name: "Evening medicine", time: "20:00", type: "Medication", done: false }
];

const prayerSchedule = [
  { name: "Morning prayer", time: "06:30" },
  { name: "Midday prayer", time: "12:30" },
  { name: "Evening prayer", time: "19:00" }
];

const recallWords = ["garden", "orange", "window"];
const gameSymbols = ["★", "☀", "◆", "♣", "♪", "●"];

let routine = readStore("familyCircleRoutine", defaultRoutine);
let reminders = readStore("familyCircleReminders", defaultReminders);
let score = Number(localStorage.getItem("familyCircleScore") || 0);
let openCards = [];
let matchedCards = 0;

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const toast = document.getElementById("toast");
const installButton = document.getElementById("installButton");
const notificationStatus = document.getElementById("notificationStatus");
let deferredInstallPrompt = null;

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function switchView(viewId) {
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  if (location.hash.slice(1) !== viewId) {
    history.replaceState(null, "", `#${viewId}`);
  }
}

function openInitialView() {
  const viewId = location.hash.slice(1);
  if (viewId && document.getElementById(viewId)) {
    switchView(viewId);
  }
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderDate() {
  const label = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  document.getElementById("todayLabel").textContent = label;
}

function renderContacts() {
  const homeContacts = document.getElementById("homeContacts");
  const contactGrid = document.getElementById("contactGrid");

  const rowHtml = contacts.slice(0, 3).map(contactRow).join("");
  const gridHtml = contacts.map(contactCard).join("");

  homeContacts.innerHTML = rowHtml;
  contactGrid.innerHTML = gridHtml;
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function contactRow(contact) {
  return `
    <div class="contact-row">
      <div class="avatar" style="background:${contact.color}">${initials(contact.name)}</div>
      <div>
        <h4>${contact.name}</h4>
        <p>${contact.role}</p>
      </div>
      <button class="call-button" type="button" data-call="${contact.name}" aria-label="Call ${contact.name}">☎</button>
    </div>
  `;
}

function contactCard(contact) {
  return `
    <article class="contact-card">
      <div class="avatar" style="background:${contact.color}">${initials(contact.name)}</div>
      <div>
        <h3>${contact.name}</h3>
        <p>${contact.role}</p>
      </div>
      <p>${contact.note}</p>
      <button class="primary-action" type="button" data-call="${contact.name}">Call ${contact.name}</button>
    </article>
  `;
}

function renderRoutine() {
  const routineList = document.getElementById("routineList");
  routineList.innerHTML = routine
    .map(
      (item) => `
        <div class="routine-item ${item.done ? "done" : ""}">
          <div class="routine-check" aria-hidden="true">${item.done ? "✓" : ""}</div>
          <div>
            <h4>${item.title}</h4>
            <p>${item.time}</p>
          </div>
          <button class="complete-button" type="button" data-routine="${item.id}">
            ${item.done ? "Done" : "Mark done"}
          </button>
        </div>
      `
    )
    .join("");
}

function renderReminders() {
  const reminderList = document.getElementById("reminderList");
  const sorted = [...reminders].sort((a, b) => a.time.localeCompare(b.time));
  reminderList.innerHTML = sorted.map(reminderTemplate).join("");
  renderNextReminder(sorted);
}

function reminderTemplate(reminder) {
  return `
    <div class="reminder-item">
      <div class="routine-check" aria-hidden="true">${reminder.done ? "✓" : ""}</div>
      <div>
        <h4>${reminder.name}</h4>
        <p>${formatTime(reminder.time)} · ${reminder.type}</p>
      </div>
      <button class="delete-button" type="button" data-delete-reminder="${reminder.id}" aria-label="Delete ${reminder.name}">Delete</button>
    </div>
  `;
}

function renderNextReminder(sortedReminders) {
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next = sortedReminders.find((reminder) => reminder.time >= current) || sortedReminders[0];

  if (!next) {
    document.getElementById("nextReminderTitle").textContent = "No reminders yet";
    document.getElementById("nextReminderDetail").textContent = "Add medication, routine, family, or prayer reminders.";
    return;
  }

  document.getElementById("nextReminderTitle").textContent = `${next.type} at ${formatTime(next.time)}`;
  document.getElementById("nextReminderDetail").textContent = next.name;
}

function renderPrayer() {
  const prayerList = document.getElementById("prayerList");
  prayerList.innerHTML = prayerSchedule
    .map(
      (prayer) => `
        <div class="reminder-item">
          <div class="routine-check" aria-hidden="true">✦</div>
          <div>
            <h4>${prayer.name}</h4>
            <p>${formatTime(prayer.time)}</p>
          </div>
          <button class="complete-button" type="button" data-prayer="${prayer.name}">Done</button>
        </div>
      `
    )
    .join("");

  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next = prayerSchedule.find((prayer) => prayer.time >= current) || prayerSchedule[0];
  document.getElementById("nextPrayer").textContent = `${formatTime(next.time)} ${next.name}`;
}

function renderNotificationStatus() {
  if (!("Notification" in window)) {
    notificationStatus.textContent = "This browser does not support device notifications.";
    return;
  }

  if (Notification.permission === "granted") {
    notificationStatus.textContent = "Device notifications are enabled for this app.";
    return;
  }

  if (Notification.permission === "denied") {
    notificationStatus.textContent = "Notifications are blocked. You can allow them from browser settings.";
    return;
  }

  notificationStatus.textContent = "Enable device notifications for medication, prayer, and routine alerts.";
}

function scheduleReminderChecks() {
  setInterval(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todayKey = now.toDateString();

    reminders.forEach((reminder) => {
      const alertKey = `familyCircleAlert-${todayKey}-${reminder.id}`;
      if (reminder.time === current && !localStorage.getItem(alertKey)) {
        new Notification(`${reminder.type} reminder`, {
          body: reminder.name,
          icon: "icons/icon.svg"
        });
        localStorage.setItem(alertKey, "sent");
      }
    });
  }, 30000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("sw.js")
    .then(() => showToast("App ready for offline use."))
    .catch(() => showToast("Offline setup needs a local or secure web server."));
}

function renderWords() {
  const html = recallWords.map((word) => `<span>${word}</span>`).join("");
  document.getElementById("dailyWords").innerHTML = html;
  document.getElementById("recallWords").innerHTML = html;
}

function setScore(value) {
  score = value;
  localStorage.setItem("familyCircleScore", String(score));
  document.getElementById("scoreValue").textContent = score;
}

function buildMemoryGame() {
  const memoryBoard = document.getElementById("memoryBoard");
  const cards = [...gameSymbols, ...gameSymbols]
    .sort(() => Math.random() - 0.5)
    .map((symbol, index) => ({ id: `${symbol}-${index}`, symbol }));

  openCards = [];
  matchedCards = 0;
  memoryBoard.innerHTML = cards
    .map(
      (card) => `
        <button class="memory-card" type="button" data-card-id="${card.id}" data-symbol="${card.symbol}" aria-label="Memory card">
          ?
        </button>
      `
    )
    .join("");
}

function handleMemoryCard(card) {
  if (card.classList.contains("open") || card.classList.contains("matched") || openCards.length === 2) return;

  card.classList.add("open");
  card.textContent = card.dataset.symbol;
  openCards.push(card);

  if (openCards.length !== 2) return;

  const [first, second] = openCards;
  if (first.dataset.symbol === second.dataset.symbol) {
    first.classList.add("matched");
    second.classList.add("matched");
    matchedCards += 2;
    setScore(score + 10);
    openCards = [];
    if (matchedCards === gameSymbols.length * 2) showToast("Picture match complete. Lovely work.");
    return;
  }

  setTimeout(() => {
    first.classList.remove("open");
    second.classList.remove("open");
    first.textContent = "?";
    second.textContent = "?";
    openCards = [];
  }, 900);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  const shortcut = event.target.closest("[data-view-shortcut]");
  const call = event.target.closest("[data-call]");
  const routineButton = event.target.closest("[data-routine]");
  const deleteReminder = event.target.closest("[data-delete-reminder]");
  const prayerButton = event.target.closest("[data-prayer]");
  const card = event.target.closest("[data-card-id]");

  if (nav) switchView(nav.dataset.view);
  if (shortcut) switchView(shortcut.dataset.viewShortcut);
  if (call) showToast(`Calling ${call.dataset.call}. In a full app this would start phone or video call.`);
  if (prayerButton) showToast(`${prayerButton.dataset.prayer} marked complete.`);
  if (card) handleMemoryCard(card);

  if (routineButton) {
    routine = routine.map((item) =>
      item.id === routineButton.dataset.routine ? { ...item, done: !item.done } : item
    );
    saveStore("familyCircleRoutine", routine);
    renderRoutine();
  }

  if (deleteReminder) {
    reminders = reminders.filter((reminder) => reminder.id !== deleteReminder.dataset.deleteReminder);
    saveStore("familyCircleReminders", reminders);
    renderReminders();
    showToast("Reminder removed.");
  }
});

document.getElementById("resetRoutine").addEventListener("click", () => {
  routine = defaultRoutine.map((item) => ({ ...item, done: false }));
  saveStore("familyCircleRoutine", routine);
  renderRoutine();
  showToast("Daily route reset.");
});

document.getElementById("checkInButton").addEventListener("click", () => {
  showToast("Check-in sent to family. They will know everything is okay.");
});

document.getElementById("messageAll").addEventListener("click", () => {
  showToast("Family update prepared: I am okay today.");
});

document.getElementById("reminderForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("reminderName").value.trim();
  const time = document.getElementById("reminderTime").value;
  const type = document.getElementById("reminderType").value;

  reminders.push({ id: makeId(), name, time, type, done: false });
  saveStore("familyCircleReminders", reminders);
  event.target.reset();
  renderReminders();
  showToast("Reminder added.");
});

document.getElementById("startRecall").addEventListener("click", () => {
  switchView("games");
  document.getElementById("recallWords").style.visibility = "hidden";
  document.getElementById("recallPrompt").textContent = "Write the three words you remember.";
  document.getElementById("recallAnswer").focus();
});

document.getElementById("checkRecall").addEventListener("click", () => {
  const answer = document.getElementById("recallAnswer").value.toLowerCase();
  const remembered = recallWords.filter((word) => answer.includes(word));
  document.getElementById("recallResult").textContent = `You remembered ${remembered.length} of 3 words.`;
  document.getElementById("recallWords").style.visibility = "visible";
  setScore(score + remembered.length * 5);
});

document.getElementById("newGame").addEventListener("click", buildMemoryGame);
document.getElementById("markPrayer").addEventListener("click", () => showToast("Prayer time marked complete."));
document.getElementById("enableAlerts").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    renderNotificationStatus();
    return;
  }

  const permission = await Notification.requestPermission();
  renderNotificationStatus();
  showToast(permission === "granted" ? "Alerts enabled." : "Alerts were not enabled.");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showToast("Use your browser menu to add this app to the home screen.");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  showToast("Family Circle Care installed.");
});

renderDate();
renderContacts();
renderRoutine();
renderReminders();
renderPrayer();
renderWords();
setScore(score);
buildMemoryGame();
renderNotificationStatus();
openInitialView();
scheduleReminderChecks();
registerServiceWorker();

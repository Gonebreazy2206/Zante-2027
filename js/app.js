(() => {
  const DAYS = ["Dag 1", "Dag 2", "Dag 3", "Dag 4", "Dag 5", "Dag 6", "Dag 7"];
  const SESSION_KEY = "zanteSession";
  let db;
  let room = null;
  let currentMember = null;
  let selectedDay = 0;
  let members = [];
  let events = [];
  let ideas = [];
  let expenses = [];
  let packingItems = [];
  let realtimeChannel = null;
  let reloadTimer = null;

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    document.querySelector(".toast")?.remove();
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2200);
  }

  function isAdmin() {
    return Boolean(currentMember?.is_admin);
  }

  function isNate(member) {
    return member?.name?.trim().toLowerCase() === "nate";
  }

  function canDelete(createdBy) {
    return isAdmin() || createdBy === currentMember?.id;
  }

  function memberName(memberId) {
    return members.find((member) => member.id === memberId)?.name || "Onbekend";
  }

  function openModal(id) {
    $(id)?.classList.remove("hidden");
  }

  function closeModal(id) {
    $(id)?.classList.add("hidden");
  }

  function setupStaticUi() {
    document.querySelectorAll("[data-open-modal]").forEach((button) => {
      button.addEventListener("click", () => openModal(button.dataset.openModal));
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });

    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal.id);
      });
    });

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => changeTab(button.dataset.tab, button));
    });

    $("shareRoomButton").addEventListener("click", shareRoom);
    $("logoutButton").addEventListener("click", logout);
    $("profileButton").addEventListener("click", logout);
  }

  function changeTab(tabId, button) {
    document.querySelectorAll(".page-section").forEach((section) => section.classList.remove("active"));
    $(tabId).classList.add("active");
    document.querySelectorAll(".nav-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  }

  async function login(event) {
    event.preventDefault();

    const errorBox = $("loginError");
    const button = $("loginButton");
    const name = $("nameInput").value.trim();
    const roomKey = $("roomKeyInput").value.trim();

    errorBox.classList.add("hidden");
    button.disabled = true;
    button.textContent = "Verbinden...";

    try {
      const { data: roomData, error: roomError } = await db
        .from("rooms")
        .select("id,name")
        .eq("room_key", roomKey)
        .maybeSingle();

      if (roomError || !roomData) throw new Error("Room key klopt niet.");

      room = roomData;

      let { data: memberData, error: memberError } = await db
        .from("members")
        .select("*")
        .eq("room_id", room.id)
        .ilike("name", name)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!memberData) {
        const { data, error } = await db
          .from("members")
          .insert({
            room_id: room.id,
            name,
            is_admin: name.toLowerCase() === "nate"
          })
          .select()
          .single();

        if (error) throw error;
        memberData = data;
      }

      currentMember = memberData;

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId: room.id,
        roomName: room.name,
        memberId: currentMember.id,
        memberName: currentMember.name,
        roomKey
      }));

      await openApp();
    } catch (error) {
      console.error(error);
      errorBox.textContent = error.message || "Er ging iets mis.";
      errorBox.classList.remove("hidden");
    } finally {
      button.disabled = false;
      button.textContent = "Open vakantie";
    }
  }

  async function restoreSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        db.from("rooms").select("id,name").eq("id", saved.roomId).maybeSingle(),
        db.from("members").select("*").eq("id", saved.memberId).maybeSingle()
      ]);

      if (!roomData || !memberData) return;

      room = roomData;
      currentMember = memberData;
      await openApp();
    } catch (error) {
      console.error(error);
    }
  }

  async function openApp() {
    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("username").textContent = currentMember.name;
    $("avatar").textContent = currentMember.name.charAt(0).toUpperCase();
    $("roomName").textContent = room.name;
    $("adminBadge").classList.toggle("hidden", !isAdmin());

    renderDayControls();
    await loadEverything();
    startRealtime();
  }

  async function loadEverything() {
    if (!room) return;

    try {
      const [membersRes, eventsRes, ideasRes, expensesRes, packingRes] = await Promise.all([
        db.from("members").select("*").eq("room_id", room.id).order("created_at"),
        db.from("events").select("*").eq("room_id", room.id).order("start_time"),
        db.from("ideas").select("*").eq("room_id", room.id).order("created_at", { ascending: false }),
        db.from("expenses").select("*").eq("room_id", room.id).order("created_at", { ascending: false }),
        db.from("packing_items").select("*").eq("room_id", room.id).order("created_at")
      ]);

      [membersRes, eventsRes, ideasRes, expensesRes, packingRes].forEach((response) => {
        if (response.error) throw response.error;
      });

      members = membersRes.data || [];
      events = eventsRes.data || [];
      ideas = ideasRes.data || [];
      expenses = expensesRes.data || [];
      packingItems = packingRes.data || [];

      currentMember = members.find((member) => member.id === currentMember.id) || currentMember;
      $("adminBadge").classList.toggle("hidden", !isAdmin());

      renderEverything();
    } catch (error) {
      console.error("Load error:", error);
      toast("Kon data niet laden");
    }
  }

  function startRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);

    realtimeChannel = db.channel(`zante-${room.id}`);

    ["members", "events", "ideas", "expenses", "packing_items"].forEach((table) => {
      realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleReload);
    });

    realtimeChannel.subscribe();
  }

  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadEverything, 200);
  }

  function renderDayControls() {
    const tabs = $("dayTabs");
    const eventDay = $("eventDay");
    const ideaDay = $("ideaDay");

    tabs.innerHTML = "";
    eventDay.innerHTML = "";
    ideaDay.innerHTML = "";

    DAYS.forEach((day, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day-tab${selectedDay === index ? " active" : ""}`;
      button.textContent = day;

      button.addEventListener("click", () => {
        selectedDay = index;
        renderDayControls();
        renderEvents();
      });

      tabs.appendChild(button);

      [eventDay, ideaDay].forEach((select) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = day;
        select.appendChild(option);
      });
    });

    eventDay.value = selectedDay;
    ideaDay.value = selectedDay;
  }

  function renderEverything() {
    renderEvents();
    renderMembers();
    renderIdeas();
    renderExpenses();
    renderPacking();

    $("eventCount").textContent = events.length;
    $("ideaCount").textContent = ideas.length;
    $("memberCount").textContent = members.length;
    $("adminCount").textContent = members.filter((member) => member.is_admin).length;
  }

  function renderEvents() {
    const list = events
      .filter((item) => item.day === selectedDay)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

    if (!list.length) {
      $("events").innerHTML = `<div class="empty">Nog niets gepland voor ${DAYS[selectedDay]}.</div>`;
      return;
    }

    $("events").innerHTML = list.map((event) => `
      <article class="event-card">
        <div class="event-top">
          <div>
            <div class="event-time">${escapeHtml(String(event.start_time).slice(0,5))} — ${escapeHtml(String(event.end_time).slice(0,5))}</div>
            <div class="event-title">${escapeHtml(event.title)}</div>
            ${event.location ? `<div class="event-meta">📍 ${escapeHtml(event.location)}</div>` : ""}
            ${event.description ? `<div class="event-meta">${escapeHtml(event.description)}</div>` : ""}
            <div class="creator">Toegevoegd door ${escapeHtml(memberName(event.created_by))}</div>
          </div>
          ${canDelete(event.created_by) ? `<button class="delete-button" data-delete-event="${event.id}">Verwijder</button>` : ""}
        </div>
      </article>
    `).join("");

    document.querySelectorAll("[data-delete-event]").forEach((button) => {
      button.addEventListener("click", () => deleteRow("events", Number(button.dataset.deleteEvent), "Activiteit verwijderd"));
    });
  }

  function renderMembers() {
    $("members").innerHTML = members.map((member) => {
      const current = member.id === currentMember.id;
      const protectedAdmin = isNate(member);
      const adminControls = isAdmin() && !current && !protectedAdmin
        ? `
          <div class="member-actions">
            <button class="mini-button" data-toggle-admin="${member.id}">
              ${member.is_admin ? "Admin verwijderen" : "Maak admin"}
            </button>
            <button class="mini-button danger-mini" data-remove-member="${member.id}">Verwijder</button>
          </div>
        `
        : "";

      return `
        <div class="member-row member-row-admin">
          <div class="member-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</div>
          <div class="member-main">
            <div class="member-name">
              ${escapeHtml(member.name)}
              ${member.is_admin ? '<span class="admin-pill">Admin</span>' : ""}
              ${current ? '<span class="you">· jij</span>' : ""}
            </div>
            ${adminControls}
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-toggle-admin]").forEach((button) => {
      button.addEventListener("click", () => toggleAdmin(Number(button.dataset.toggleAdmin)));
    });

    document.querySelectorAll("[data-remove-member]").forEach((button) => {
      button.addEventListener("click", () => removeMember(Number(button.dataset.removeMember)));
    });
  }

  function renderIdeas() {
    $("ideasList").innerHTML = ideas.length
      ? ideas.map((idea) => `
          <article class="idea-card">
            <div class="idea-top">
              <div>
                <div class="idea-title">${escapeHtml(idea.title)}</div>
                <div class="idea-meta">${DAYS[idea.day]} · door ${escapeHtml(memberName(idea.created_by))}</div>
                ${idea.description ? `<div class="idea-meta">${escapeHtml(idea.description)}</div>` : ""}
              </div>
              ${canDelete(idea.created_by) ? `<button class="delete-button" data-delete-idea="${idea.id}">Verwijder</button>` : ""}
            </div>
          </article>
        `).join("")
      : '<div class="empty">Nog geen ideeën.</div>';

    document.querySelectorAll("[data-delete-idea]").forEach((button) => {
      button.addEventListener("click", () => deleteRow("ideas", Number(button.dataset.deleteIdea), "Idee verwijderd"));
    });
  }

  function renderExpenses() {
    $("expenses").innerHTML = expenses.length
      ? expenses.map((expense) => `
          <div class="expense-row">
            <div>
              <div class="expense-title">${escapeHtml(expense.title)}</div>
              <div class="expense-person">${escapeHtml(memberName(expense.created_by))}</div>
            </div>
            <div class="expense-side">
              <div class="expense-amount">€${Number(expense.amount).toFixed(2).replace(".", ",")}</div>
              ${canDelete(expense.created_by) ? `<button class="delete-button" data-delete-expense="${expense.id}">Verwijder</button>` : ""}
            </div>
          </div>
        `).join("")
      : '<div class="empty">Nog geen uitgaven.</div>';

    document.querySelectorAll("[data-delete-expense]").forEach((button) => {
      button.addEventListener("click", () => deleteRow("expenses", Number(button.dataset.deleteExpense), "Uitgave verwijderd"));
    });

    const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    $("budgetTotal").textContent = `€${total.toFixed(2).replace(".", ",")}`;
  }

  function renderPacking() {
    $("packingList").innerHTML = packingItems.length
      ? packingItems.map((item) => `
          <div class="packing-row">
            <label class="packing-content">
              <input class="packing-checkbox" type="checkbox" data-packing-id="${item.id}" ${item.done ? "checked" : ""}>
              <span class="packing-text${item.done ? " done" : ""}">${escapeHtml(item.text)}</span>
            </label>
            ${canDelete(item.created_by) ? `<button class="delete-button" data-delete-packing="${item.id}">Verwijder</button>` : ""}
          </div>
        `).join("")
      : '<div class="empty">Nog niets op de lijst.</div>';

    document.querySelectorAll("[data-packing-id]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => togglePacking(Number(checkbox.dataset.packingId), checkbox.checked));
    });

    document.querySelectorAll("[data-delete-packing]").forEach((button) => {
      button.addEventListener("click", () => deleteRow("packing_items", Number(button.dataset.deletePacking), "Item verwijderd"));
    });
  }

  async function addEvent(event) {
    event.preventDefault();

    const start = $("eventStart").value;
    const end = $("eventEnd").value;

    if (end <= start) return toast("Eindtijd moet later zijn dan begintijd.");

    const { error } = await db.from("events").insert({
      room_id: room.id,
      created_by: currentMember.id,
      title: $("eventTitle").value.trim(),
      day: Number($("eventDay").value),
      start_time: start,
      end_time: end,
      location: $("eventLocation").value.trim(),
      description: $("eventDescription").value.trim()
    });

    if (error) return handleDbError(error, "Activiteit toevoegen mislukt");

    closeModal("eventModal");
    event.target.reset();
    await loadEverything();
    toast("Activiteit toegevoegd");
  }

  async function addIdea(event) {
    event.preventDefault();

    const { error } = await db.from("ideas").insert({
      room_id: room.id,
      created_by: currentMember.id,
      title: $("ideaTitle").value.trim(),
      description: $("ideaDescription").value.trim(),
      day: Number($("ideaDay").value)
    });

    if (error) return handleDbError(error, "Idee toevoegen mislukt");

    closeModal("ideaModal");
    event.target.reset();
    await loadEverything();
  }

  async function addExpense(event) {
    event.preventDefault();

    const { error } = await db.from("expenses").insert({
      room_id: room.id,
      created_by: currentMember.id,
      title: $("expenseTitle").value.trim(),
      amount: Number($("expenseAmount").value)
    });

    if (error) return handleDbError(error, "Uitgave toevoegen mislukt");

    closeModal("expenseModal");
    event.target.reset();
    await loadEverything();
  }

  async function addPackingItem(event) {
    event.preventDefault();

    const { error } = await db.from("packing_items").insert({
      room_id: room.id,
      created_by: currentMember.id,
      text: $("packingText").value.trim(),
      done: false
    });

    if (error) return handleDbError(error, "Item toevoegen mislukt");

    closeModal("packingModal");
    event.target.reset();
    await loadEverything();
  }

  async function togglePacking(id, done) {
    const { error } = await db.from("packing_items").update({ done }).eq("id", id);
    if (error) return handleDbError(error, "Opslaan mislukt");
    await loadEverything();
  }

  async function deleteRow(table, id, successMessage) {
    const itemMap = {
      events,
      ideas,
      expenses,
      packing_items: packingItems
    };

    const item = itemMap[table]?.find((row) => row.id === id);
    if (!item || !canDelete(item.created_by)) return toast("Geen toestemming.");

    const { error } = await db.from(table).delete().eq("id", id);
    if (error) return handleDbError(error, "Verwijderen mislukt");

    toast(successMessage);
    await loadEverything();
  }

  async function toggleAdmin(memberId) {
    if (!isAdmin()) return toast("Alleen admins kunnen dit doen.");

    const target = members.find((member) => member.id === memberId);
    if (!target || isNate(target)) return toast("Nate blijft hoofd-admin.");

    const { error } = await db
      .from("members")
      .update({ is_admin: !target.is_admin })
      .eq("id", memberId)
      .eq("room_id", room.id);

    if (error) return handleDbError(error, "Admin wijzigen mislukt");

    await loadEverything();
  }

  async function removeMember(memberId) {
    if (!isAdmin()) return toast("Alleen admins kunnen dit doen.");

    const target = members.find((member) => member.id === memberId);
    if (!target || target.id === currentMember.id || isNate(target)) {
      return toast("Dit lid kan niet worden verwijderd.");
    }

    const { error } = await db
      .from("members")
      .delete()
      .eq("id", memberId)
      .eq("room_id", room.id);

    if (error) return handleDbError(error, "Lid verwijderen mislukt");

    await loadEverything();
  }

  function handleDbError(error, message) {
    console.error(error);
    toast(message);
  }

  async function shareRoom() {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    const text = `${room?.name || "Zante 2027"}\nRoom key: ${session.roomKey || ""}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: room?.name || "Zante 2027", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast("Room key gekopieerd");
      }
    } catch (error) {
      console.debug(error);
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    location.reload();
  }

  function wireForms() {
    $("loginForm").addEventListener("submit", login);
    $("eventForm").addEventListener("submit", addEvent);
    $("ideaForm").addEventListener("submit", addIdea);
    $("expenseForm").addEventListener("submit", addExpense);
    $("packingForm").addEventListener("submit", addPackingItem);
  }

  async function init() {
    const config = window.APP_CONFIG;

    if (!config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY || !window.supabase) {
      $("loginError").textContent = "Supabase configuratie ontbreekt.";
      $("loginError").classList.remove("hidden");
      return;
    }

    db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
    setupStaticUi();
    wireForms();
    await restoreSession();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
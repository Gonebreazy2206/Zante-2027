(() => {
  const DAYS = ["Dag 1", "Dag 2", "Dag 3", "Dag 4", "Dag 5", "Dag 6", "Dag 7"];
  const SESSION_KEY = "zanteSession";
  let db;
  let room = null;
  let currentMember = null;
  let selectedDay = 0;
  let members = [];
  let events = [];
  let eventVotes = [];
  let ideas = [];
  let ideaVotes = [];
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

  function openModal(id) { $(id)?.classList.remove("hidden"); }
  function closeModal(id) { $(id)?.classList.add("hidden"); }

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

  function memberName(memberId) {
    return members.find((member) => member.id === memberId)?.name || "Onbekend";
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
        .eq("name", name)
        .maybeSingle();
      if (memberError) throw memberError;

      if (!memberData) {
        const { data, error } = await db
          .from("members")
          .insert({ room_id: room.id, name })
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

      eventVotes = events.length
        ? (await db.from("event_votes").select("*").in("event_id", events.map((item) => item.id))).data || []
        : [];
      ideaVotes = ideas.length
        ? (await db.from("votes").select("*").in("idea_id", ideas.map((item) => item.id))).data || []
        : [];

      renderEverything();
    } catch (error) {
      console.error("Load error:", error);
      toast("Kon data niet laden");
    }
  }

  function startRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    realtimeChannel = db.channel(`zante-${room.id}`);
    ["members", "events", "event_votes", "ideas", "votes", "expenses", "packing_items"].forEach((table) => {
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
        renderPopularEvents();
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
    renderPopularEvents();
    renderMembers();
    renderIdeas();
    renderExpenses();
    renderPacking();
    $("eventCount").textContent = events.length;
    $("eventVoteCount").textContent = eventVotes.length;
    $("ideaCount").textContent = ideas.length;
    $("memberCount").textContent = members.length;
  }

  function eventVoteCount(eventId) {
    return eventVotes.filter((vote) => vote.event_id === eventId).length;
  }

  function hasEventVoted(eventId) {
    return eventVotes.some((vote) => vote.event_id === eventId && vote.member_id === currentMember.id);
  }

  function renderEvents() {
    const list = events
      .filter((item) => item.day === selectedDay)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

    if (!list.length) {
      $("events").innerHTML = `<div class="empty">Nog niets gepland voor ${DAYS[selectedDay]}.</div>`;
      return;
    }

    $("events").innerHTML = list.map((event) => {
      const voted = hasEventVoted(event.id);
      const votes = eventVoteCount(event.id);
      const canDelete = event.created_by === currentMember.id;
      return `
        <article class="event-card">
          <div class="event-top">
            <div>
              <div class="event-time">${escapeHtml(String(event.start_time).slice(0,5))} — ${escapeHtml(String(event.end_time).slice(0,5))}</div>
              <div class="event-title">${escapeHtml(event.title)}</div>
              ${event.location ? `<div class="event-meta">📍 ${escapeHtml(event.location)}</div>` : ""}
              ${event.description ? `<div class="event-meta">${escapeHtml(event.description)}</div>` : ""}
              <div class="creator">Toegevoegd door ${escapeHtml(memberName(event.created_by))}</div>
            </div>
          </div>
          <div class="event-actions">
            <button class="vote-button${voted ? " voted" : ""}" data-event-vote="${event.id}">
              ${voted ? "✓ Gestemd" : "♡ Stem"}<span class="vote-count">${votes}</span>
            </button>
            ${canDelete ? `<button class="delete-button" data-delete-event="${event.id}">Verwijder</button>` : ""}
          </div>
        </article>`;
    }).join("");

    document.querySelectorAll("[data-event-vote]").forEach((button) => {
      button.addEventListener("click", () => toggleEventVote(Number(button.dataset.eventVote)));
    });
    document.querySelectorAll("[data-delete-event]").forEach((button) => {
      button.addEventListener("click", () => deleteEvent(Number(button.dataset.deleteEvent)));
    });
  }

  function renderPopularEvents() {
    const ranked = events
      .filter((item) => item.day === selectedDay)
      .map((item) => ({ ...item, votes: eventVoteCount(item.id) }))
      .sort((a, b) => b.votes - a.votes);

    $("popularEvents").innerHTML = ranked.length
      ? ranked.slice(0, 5).map((event, index) => `
          <div class="rank-item">
            <div class="rank-number">${index + 1}</div>
            <div class="rank-title">${escapeHtml(event.title)}</div>
            <div class="rank-votes">${event.votes} stem${event.votes === 1 ? "" : "men"}</div>
          </div>`).join("")
      : '<div class="empty">Nog geen activiteiten.</div>';
  }

  function renderMembers() {
    $("members").innerHTML = members.map((member) => `
      <div class="member-row">
        <div class="member-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</div>
        <div class="member-name">${escapeHtml(member.name)} ${member.id === currentMember.id ? '<span class="you">· jij</span>' : ""}</div>
      </div>`).join("");
  }

  function ideaVoteCount(ideaId) {
    return ideaVotes.filter((vote) => vote.idea_id === ideaId).length;
  }

  function hasIdeaVoted(ideaId) {
    return ideaVotes.some((vote) => vote.idea_id === ideaId && vote.member_id === currentMember.id);
  }

  function renderIdeas() {
    const ranked = ideas
      .map((idea) => ({ ...idea, voteCount: ideaVoteCount(idea.id) }))
      .sort((a, b) => b.voteCount - a.voteCount);

    $("ideasList").innerHTML = ranked.length
      ? ranked.map((idea) => `
        <article class="idea-card">
          <div class="idea-top">
            <div>
              <div class="idea-title">${escapeHtml(idea.title)}</div>
              <div class="idea-meta">${DAYS[idea.day]} · door ${escapeHtml(memberName(idea.created_by))}</div>
              ${idea.description ? `<div class="idea-meta">${escapeHtml(idea.description)}</div>` : ""}
            </div>
            <div class="idea-score">${idea.voteCount}</div>
          </div>
          <div class="idea-actions">
            <button class="vote-button${hasIdeaVoted(idea.id) ? " voted" : ""}" data-idea-vote="${idea.id}">
              ${hasIdeaVoted(idea.id) ? "✓ Gestemd" : "♡ Stem"}
            </button>
          </div>
        </article>`).join("")
      : '<div class="empty">Nog geen ideeën.</div>';

    document.querySelectorAll("[data-idea-vote]").forEach((button) => {
      button.addEventListener("click", () => toggleIdeaVote(Number(button.dataset.ideaVote)));
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
          <div class="expense-amount">€${Number(expense.amount).toFixed(2).replace(".", ",")}</div>
        </div>`).join("")
      : '<div class="empty">Nog geen uitgaven.</div>';

    const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    $("budgetTotal").textContent = `€${total.toFixed(2).replace(".", ",")}`;
  }

  function renderPacking() {
    $("packingList").innerHTML = packingItems.length
      ? packingItems.map((item) => `
        <label class="packing-row">
          <input class="packing-checkbox" type="checkbox" data-packing-id="${item.id}" ${item.done ? "checked" : ""}>
          <span class="packing-text${item.done ? " done" : ""}">${escapeHtml(item.text)}</span>
        </label>`).join("")
      : '<div class="empty">Nog niets op de lijst.</div>';

    document.querySelectorAll("[data-packing-id]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => togglePacking(Number(checkbox.dataset.packingId), checkbox.checked));
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

  async function toggleEventVote(eventId) {
    const existing = eventVotes.find((vote) => vote.event_id === eventId && vote.member_id === currentMember.id);
    const query = existing
      ? db.from("event_votes").delete().eq("event_id", eventId).eq("member_id", currentMember.id)
      : db.from("event_votes").insert({ event_id: eventId, member_id: currentMember.id });
    const { error } = await query;
    if (error) return handleDbError(error, "Stemmen mislukt");
    await loadEverything();
  }

  async function deleteEvent(eventId) {
    const { error } = await db.from("events").delete().eq("id", eventId).eq("created_by", currentMember.id);
    if (error) return handleDbError(error, "Verwijderen mislukt");
    await loadEverything();
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

  async function toggleIdeaVote(ideaId) {
    const existing = ideaVotes.find((vote) => vote.idea_id === ideaId && vote.member_id === currentMember.id);
    const query = existing
      ? db.from("votes").delete().eq("idea_id", ideaId).eq("member_id", currentMember.id)
      : db.from("votes").insert({ idea_id: ideaId, member_id: currentMember.id });
    const { error } = await query;
    if (error) return handleDbError(error, "Stemmen mislukt");
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

  function handleDbError(error, message) {
    console.error(error);
    toast(message);
  }

  async function shareRoom() {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    const text = `${room?.name || "Zante 2027"}\nRoom key: ${session.roomKey || ""}`;
    try {
      if (navigator.share) await navigator.share({ title: room?.name || "Zante 2027", text });
      else {
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

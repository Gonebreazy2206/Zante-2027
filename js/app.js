(() => {
  const DAYS = [
    {name:"Monday",short:"Mon",date:19},
    {name:"Tuesday",short:"Tue",date:20},
    {name:"Wednesday",short:"Wed",date:21},
    {name:"Thursday",short:"Thu",date:22},
    {name:"Friday",short:"Fri",date:23},
    {name:"Saturday",short:"Sat",date:24},
    {name:"Sunday",short:"Sun",date:25},
    {name:"Monday",short:"Mon",date:26}
  ];

  const AIRBNB_URL = "https://www.airbnb.nl/rooms/1258429?unique_share_id=102ad136-1a11-4c66-99ef-1032ac10ce70&viralityEntryPoint=1&s=76&source_impression_id=p3_1790667460_P3EcSs3MJJsvKi77";
  const MAPS_URL = "https://www.google.com/maps/dir/?api=1&destination=Doliva%20Estate%2C%20Laganas%20Road%2C%20Agrilia%20290%2092%2C%20Greece";
  const KEY = "zantePlannerV1";
  const DB_NAME = "zanteWalletDB";
  const DB_VERSION = 1;
  const STORE_NAME = "documents";

  const state = Object.assign(
    {selectedDay:0,plans:[],ideas:[],packing:[]},
    JSON.parse(localStorage.getItem(KEY) || "{}")
  );

  let documents = [];
  let expandedDocumentId = null;
  let documentUrls = new Map();

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  function renderDays(){
    $("dayStrip").innerHTML = DAYS.map((day,index) => `
      <button class="day-chip ${index === state.selectedDay ? "active" : ""}" data-day="${index}" aria-label="${day.name} ${day.date} July">
        <small>${day.short}</small>
        <strong>${day.date}</strong>
      </button>
    `).join("");

    document.querySelectorAll("[data-day]").forEach(button => {
      button.onclick = () => {
        state.selectedDay = Number(button.dataset.day);
        save();
        renderDays();
        renderPlans();
      };
    });

    const day = DAYS[state.selectedDay];
    $("selectedDate").textContent = `${day.name.toUpperCase()} · ${day.date} JULY`;
    $("selectedDayTitle").textContent = state.selectedDay === 7 ? "Departure" : `Day ${state.selectedDay + 1}`;
    $("planDay").value = state.selectedDay;
  }

  function renderPlans(){
    const plans = state.plans
      .filter(plan => plan.day === state.selectedDay)
      .sort((a,b) => a.time.localeCompare(b.time));

    $("planCount").textContent = `${plans.length} ${plans.length === 1 ? "plan" : "plans"}`;

    $("plansList").innerHTML = plans.length
      ? plans.map(plan => `
          <article class="plan-row">
            <div class="time">
              <strong>${esc(plan.time)}</strong>
              ${plan.end ? `<span>to ${esc(plan.end)}</span>` : ""}
            </div>
            <div class="plan-main">
              <strong>${esc(plan.title)}</strong>
              ${plan.location ? `<div class="meta">${esc(plan.location)}</div>` : ""}
              ${plan.notes ? `<div class="meta">${esc(plan.notes)}</div>` : ""}
            </div>
            <button class="delete" data-delete-plan="${plan.id}" aria-label="Delete ${esc(plan.title)}">×</button>
          </article>
        `).join("")
      : `<div class="empty"><strong>Nothing planned yet</strong><span>Tap + to add the first thing for this day.</span></div>`;

    document.querySelectorAll("[data-delete-plan]").forEach(button => {
      button.onclick = () => {
        const plan = state.plans.find(item => item.id === button.dataset.deletePlan);
        if (!window.confirm(`Delete "${plan?.title || "this plan"}"?`)) return;
        state.plans = state.plans.filter(plan => plan.id !== button.dataset.deletePlan);
        save();
        renderPlans();
      };
    });
  }

  function renderIdeas(){
    $("ideasList").innerHTML = state.ideas.length
      ? state.ideas.map(idea => `
          <div class="idea-row">
            <div class="idea-main">
              <strong>${esc(idea.title)}</strong>
              ${idea.note ? `<span>${esc(idea.note)}</span>` : ""}
            </div>
            <button class="delete" data-delete-idea="${idea.id}" aria-label="Delete idea">×</button>
          </div>
        `).join("")
      : `<div class="empty"><strong>No ideas saved</strong><span>Add places, restaurants or things you might want to do.</span></div>`;

    document.querySelectorAll("[data-delete-idea]").forEach(button => {
      button.onclick = () => {
        const idea = state.ideas.find(item => item.id === button.dataset.deleteIdea);
        if (!window.confirm(`Delete "${idea?.title || "this idea"}"?`)) return;
        state.ideas = state.ideas.filter(idea => idea.id !== button.dataset.deleteIdea);
        save();
        renderIdeas();
      };
    });
  }

  function renderPacking(){
    const done = state.packing.filter(item => item.done).length;
    const total = state.packing.length;

    $("packingProgress").textContent = `${done} of ${total} packed`;
    $("progressBar").style.width = total ? `${done / total * 100}%` : "0%";

    $("packingList").innerHTML = total
      ? state.packing.map(item => `
          <div class="packing-row ${item.done ? "done" : ""}">
            <button class="packing-toggle" data-toggle-pack="${item.id}" type="button">
              <span class="check"></span>
              <span class="packing-text">${esc(item.text)}</span>
            </button>
            <button class="delete" data-delete-pack="${item.id}" aria-label="Delete item">×</button>
          </div>
        `).join("")
      : `<div class="empty"><strong>Your bag is empty</strong><span>Add the things you don’t want to forget.</span></div>`;

    document.querySelectorAll("[data-toggle-pack]").forEach(button => {
      button.onclick = () => {
        const item = state.packing.find(entry => entry.id === button.dataset.togglePack);
        if (item) item.done = !item.done;
        save();
        renderPacking();
      };
    });

    document.querySelectorAll("[data-delete-pack]").forEach(button => {
      button.onclick = () => {
        const item = state.packing.find(entry => entry.id === button.dataset.deletePack);
        if (!window.confirm(`Delete "${item?.text || "this item"}"?`)) return;
        state.packing = state.packing.filter(item => item.id !== button.dataset.deletePack);
        save();
        renderPacking();
      };
    });
  }

  function openDatabase(){
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {keyPath:"id"});
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getDocuments(){
    const db = await openDatabase();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onsuccess = () => resolve(request.result.sort((a,b) => b.addedAt - a.addedAt));
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  async function putDocument(documentItem){
    const db = await openDatabase();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(documentItem);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  async function removeDocument(id){
    const db = await openDatabase();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  function clearDocumentUrls(){
    documentUrls.forEach(url => URL.revokeObjectURL(url));
    documentUrls = new Map();
  }

  function documentIconMarkup(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/></svg>`;
  }

  function formatFileSize(bytes){
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderDocuments(){
    clearDocumentUrls();

    if (!documents.length) {
      $("documentsList").innerHTML = `<div class="list"><div class="empty"><strong>Your Wallet is empty</strong><span>Add boarding passes, reservations or travel PDFs here.</span></div></div>`;
      return;
    }

    $("documentsList").innerHTML = documents.map(documentItem => {
      const expanded = documentItem.id === expandedDocumentId;
      let preview = "";

      if (expanded) {
        const url = URL.createObjectURL(documentItem.blob);
        documentUrls.set(documentItem.id, url);

        if (documentItem.blob.type.startsWith("image/")) {
          preview = `<img class="image-preview" src="${url}" alt="${esc(documentItem.title)}">`;
        } else {
          preview = `<iframe class="document-preview" src="${url}" title="${esc(documentItem.title)}"></iframe>`;
        }

        preview += `
          <div class="document-actions">
            <button class="document-action" data-open-document="${documentItem.id}" type="button">Open file</button>
            <button class="document-action danger" data-delete-document="${documentItem.id}" type="button">Delete</button>
          </div>
        `;
      }

      return `
        <article class="document-card ${expanded ? "expanded" : ""}">
          <button class="document-summary" data-toggle-document="${documentItem.id}" type="button" aria-expanded="${expanded}">
            <span class="document-badge">${documentIconMarkup()}</span>
            <span class="document-copy">
              <strong>${esc(documentItem.title)}</strong>
              <span>${esc(documentItem.type)} · ${formatFileSize(documentItem.blob.size)}</span>
            </span>
            <span class="document-chevron">›</span>
          </button>
          <div class="document-details">${preview}</div>
        </article>
      `;
    }).join("");

    document.querySelectorAll("[data-toggle-document]").forEach(button => {
      button.onclick = () => {
        expandedDocumentId = expandedDocumentId === button.dataset.toggleDocument ? null : button.dataset.toggleDocument;
        renderDocuments();
      };
    });

    document.querySelectorAll("[data-open-document]").forEach(button => {
      button.onclick = () => {
        const url = documentUrls.get(button.dataset.openDocument);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      };
    });

    document.querySelectorAll("[data-delete-document]").forEach(button => {
      button.onclick = async () => {
        const documentItem = documents.find(item => item.id === button.dataset.deleteDocument);
        if (!window.confirm(`Delete "${documentItem?.title || "this document"}"?`)) return;
        await removeDocument(button.dataset.deleteDocument);
        if (expandedDocumentId === button.dataset.deleteDocument) expandedDocumentId = null;
        await loadDocuments();
      };
    });
  }

  async function loadDocuments(){
    try {
      documents = await getDocuments();
      renderDocuments();
    } catch (error) {
      console.error("Wallet load error", error);
      $("documentsList").innerHTML = `<div class="list"><div class="empty"><strong>Wallet unavailable</strong><span>This browser could not open local document storage.</span></div></div>`;
    }
  }

  function render(){
    renderDays();
    renderPlans();
    renderIdeas();
    renderPacking();
  }

  function openSheet(id){
    const element = $(id);
    element.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => element.querySelector("input,select,textarea,button")?.focus());
  }

  function closeSheet(element){
    element.classList.add("hidden");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".tab").forEach((tab,index) => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === tab.dataset.view));
      $("pageTitle").textContent = tab.dataset.title;
      $("addButton").style.display = tab.dataset.view === "weekView" ? "grid" : "none";
      $("tabIndicator").style.transform = `translateX(${tab.offsetLeft - 6}px)`;
      if (tab.dataset.view === "walletView") loadDocuments();
    };
  });

  $("addButton").onclick = () => {
    $("planDay").value = state.selectedDay;
    openSheet("planSheet");
  };

  $("stayButton").onclick = () => openSheet("staySheet");

  $("directionsButton").onclick = () => {
    window.open(MAPS_URL, "_blank", "noopener,noreferrer");
    closeSheet($("staySheet"));
  };

  $("airbnbButton").onclick = () => {
    window.open(AIRBNB_URL, "_blank", "noopener,noreferrer");
    closeSheet($("staySheet"));
  };

  document.querySelectorAll("[data-open]").forEach(button => {
    button.onclick = () => openSheet(button.dataset.open);
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.onclick = () => closeSheet(button.closest(".sheet-backdrop"));
  });

  document.querySelectorAll(".sheet-backdrop").forEach(backdrop => {
    backdrop.onclick = event => {
      if (event.target === backdrop) closeSheet(backdrop);
    };
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const openBackdrop = document.querySelector(".sheet-backdrop:not(.hidden)");
      if (openBackdrop) closeSheet(openBackdrop);
    }
  });

  DAYS.forEach((day,index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${day.name} ${day.date} July`;
    $("planDay").appendChild(option);
  });

  $("planForm").onsubmit = event => {
    event.preventDefault();

    state.plans.push({
      id:uid(),
      title:$("planTitle").value.trim(),
      time:$("planTime").value,
      end:$("planEnd").value,
      day:Number($("planDay").value),
      location:$("planLocation").value.trim(),
      notes:$("planNotes").value.trim()
    });

    state.selectedDay = Number($("planDay").value);
    save();
    event.target.reset();
    closeSheet($("planSheet"));
    render();
  };

  $("ideaForm").onsubmit = event => {
    event.preventDefault();

    state.ideas.unshift({
      id:uid(),
      title:$("ideaTitle").value.trim(),
      note:$("ideaNote").value.trim()
    });

    save();
    event.target.reset();
    closeSheet($("ideaSheet"));
    renderIdeas();
  };

  $("packingForm").onsubmit = event => {
    event.preventDefault();

    state.packing.push({
      id:uid(),
      text:$("packingText").value.trim(),
      done:false
    });

    save();
    event.target.reset();
    closeSheet($("packingSheet"));
    renderPacking();
  };

  $("documentForm").onsubmit = async event => {
    event.preventDefault();

    const file = $("documentFile").files[0];
    if (!file) return;

    const title = $("documentTitle").value.trim() || file.name.replace(/\.[^.]+$/, "");

    await putDocument({
      id:uid(),
      title,
      type:$("documentType").value,
      fileName:file.name,
      mimeType:file.type,
      addedAt:Date.now(),
      blob:file
    });

    event.target.reset();
    closeSheet($("documentSheet"));
    await loadDocuments();
  };

  window.addEventListener("beforeunload", clearDocumentUrls);
  window.addEventListener("resize", () => {
    const activeTab = document.querySelector(".tab.active");
    if (activeTab) $("tabIndicator").style.transform = `translateX(${activeTab.offsetLeft - 6}px)`;
  });

  render();
  loadDocuments();
})();
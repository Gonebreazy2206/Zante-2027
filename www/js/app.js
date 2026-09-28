(() => {
  const DAYS = [
    {name:"Monday",short:"Mon",date:19},
    {name:"Tuesday",short:"Tue",date:20},
    {name:"Wednesday",short:"Wed",date:21},
    {name:"Thursday",short:"Thu",date:22},
    {name:"Friday",short:"Fri",date:23},
    {name:"Saturday",short:"Sat",date:24},
    {name:"Sunday",short:"Sun",date:25}
  ];
  const KEY="zantePlannerV1";
  const state=Object.assign({selectedDay:0,plans:[],ideas:[],packing:[]},JSON.parse(localStorage.getItem(KEY)||"{}"));
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  function renderDays(){
    $("dayStrip").innerHTML=DAYS.map((d,i)=>`<button class="day-chip ${i===state.selectedDay?"active":""}" data-day="${i}" aria-label="${d.name} ${d.date} July"><small>${d.short}</small><strong>${d.date}</strong></button>`).join("");
    document.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{state.selectedDay=Number(b.dataset.day);save();render();});
    const d=DAYS[state.selectedDay];
    $("selectedDate").textContent=`${d.name.toUpperCase()} · ${d.date} JULY`;
    $("selectedDayTitle").textContent=`Day ${state.selectedDay+1}`;
    $("planDay").value=state.selectedDay;
  }

  function renderPlans(){
    const plans=state.plans.filter(p=>p.day===state.selectedDay).sort((a,b)=>a.time.localeCompare(b.time));
    $("planCount").textContent=`${plans.length} ${plans.length===1?"plan":"plans"}`;
    $("plansList").innerHTML=plans.length?plans.map(p=>`
      <article class="plan-row">
        <div class="time"><strong>${esc(p.time)}</strong>${p.end?`<span>to ${esc(p.end)}</span>`:""}</div>
        <div class="plan-main"><strong>${esc(p.title)}</strong>${p.location?`<div class="meta">${esc(p.location)}</div>`:""}${p.notes?`<div class="meta">${esc(p.notes)}</div>`:""}</div>
        <button class="delete" data-delete-plan="${p.id}" aria-label="Delete ${esc(p.title)}">×</button>
      </article>`).join(""):`<div class="empty"><strong>Nothing planned yet</strong><span>Tap + to add the first thing for this day.</span></div>`;
    document.querySelectorAll("[data-delete-plan]").forEach(b=>b.onclick=()=>{state.plans=state.plans.filter(p=>p.id!==b.dataset.deletePlan);save();renderPlans();});
  }

  function renderIdeas(){
    $("ideasList").innerHTML=state.ideas.length?state.ideas.map(i=>`<div class="idea-row"><div class="idea-main"><strong>${esc(i.title)}</strong>${i.note?`<span>${esc(i.note)}</span>`:""}</div><button class="delete" data-delete-idea="${i.id}" aria-label="Delete idea">×</button></div>`).join(""):`<div class="empty"><strong>No ideas saved</strong><span>Add places, restaurants or things you might want to do.</span></div>`;
    document.querySelectorAll("[data-delete-idea]").forEach(b=>b.onclick=()=>{state.ideas=state.ideas.filter(i=>i.id!==b.dataset.deleteIdea);save();renderIdeas();});
  }

  function renderPacking(){
    const done=state.packing.filter(i=>i.done).length,total=state.packing.length;
    $("packingProgress").textContent=`${done} of ${total} packed`;
    $("progressBar").style.width=total?`${done/total*100}%`:"0%";
    $("packingList").innerHTML=total?state.packing.map(i=>`<div class="packing-row ${i.done?"done":""}"><button class="packing-toggle" data-toggle-pack="${i.id}"><span class="check"></span><span class="packing-text">${esc(i.text)}</span></button><button class="delete" data-delete-pack="${i.id}" aria-label="Delete item">×</button></div>`).join(""):`<div class="empty"><strong>Your bag is empty</strong><span>Add the things you don’t want to forget.</span></div>`;
    document.querySelectorAll("[data-toggle-pack]").forEach(b=>b.onclick=()=>{const x=state.packing.find(i=>i.id===b.dataset.togglePack);if(x)x.done=!x.done;save();renderPacking();});
    document.querySelectorAll("[data-delete-pack]").forEach(b=>b.onclick=()=>{state.packing=state.packing.filter(i=>i.id!==b.dataset.deletePack);save();renderPacking();});
  }

  function render(){renderDays();renderPlans();renderIdeas();renderPacking();}

  function openSheet(id){
    const el=$(id);el.classList.remove("hidden");document.body.style.overflow="hidden";
    requestAnimationFrame(()=>el.querySelector("input,select,textarea")?.focus());
  }
  function closeSheet(el){el.classList.add("hidden");document.body.style.overflow="";}

  document.querySelectorAll(".tab").forEach((tab,i)=>tab.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===tab.dataset.view));
    $("pageTitle").textContent=tab.dataset.title;
    $("addButton").style.display=tab.dataset.view==="weekView"?"grid":"none";
    $("tabIndicator").style.transform=`translateX(${i*100}%)`;
  });

  $("addButton").onclick=()=>{$("planDay").value=state.selectedDay;openSheet("planSheet");};
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openSheet(b.dataset.open));
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeSheet(b.closest(".sheet-backdrop")));
  document.querySelectorAll(".sheet-backdrop").forEach(x=>x.onclick=e=>{if(e.target===x)closeSheet(x);});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){const x=document.querySelector(".sheet-backdrop:not(.hidden)");if(x)closeSheet(x);}});

  DAYS.forEach((d,i)=>{const o=document.createElement("option");o.value=i;o.textContent=`${d.name} ${d.date} July`;$("planDay").appendChild(o);});

  $("planForm").onsubmit=e=>{e.preventDefault();state.plans.push({id:uid(),title:$("planTitle").value.trim(),time:$("planTime").value,end:$("planEnd").value,day:Number($("planDay").value),location:$("planLocation").value.trim(),notes:$("planNotes").value.trim()});state.selectedDay=Number($("planDay").value);save();e.target.reset();closeSheet($("planSheet"));render();};
  $("ideaForm").onsubmit=e=>{e.preventDefault();state.ideas.unshift({id:uid(),title:$("ideaTitle").value.trim(),note:$("ideaNote").value.trim()});save();e.target.reset();closeSheet($("ideaSheet"));renderIdeas();};
  $("packingForm").onsubmit=e=>{e.preventDefault();state.packing.push({id:uid(),text:$("packingText").value.trim(),done:false});save();e.target.reset();closeSheet($("packingSheet"));renderPacking();};

  render();
})();
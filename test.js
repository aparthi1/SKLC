// script.js — frontend (fixed to use image_url from DB + indexedDB caching)
document.addEventListener("DOMContentLoaded", () => {
    // ------------------- CONFIG -------------------
    const API_BASE = "https://poolampatti.onrender.com"; // Render backend
    //const API_BASE = "http://localhost:8080";
  
    const LS_PEOPLE_KEY = "poolampatti_people_v1";
    const IDB_DB = "poolampatti_images_db";
    const IDB_STORE = "images";
    
  
    // ---------- DOM refs ----------
    const views = {
      home: document.getElementById("view-home"),
      contact: document.getElementById("view-contact"),
      login: document.getElementById("view-login"),
      upload: document.getElementById("view-upload"),
    };
  
    const cardsContainer = document.getElementById("cardsContainer");
    const contactCard = document.getElementById("contactCard");
    const uploadCards = document.getElementById("uploadCards");
    const uploadSearch = document.getElementById("uploadSearch");
    const addUserBtn = document.getElementById("addUserBtn");
    const logoutBtn = document.getElementById("logoutBtn");
  
    // navbar refresh UI
    const refreshBtn = document.getElementById("refreshBtn");
    const syncStatusEl = document.getElementById("syncStatus"); // optional
  
    // user modal
    const userModal = document.getElementById("userModal");
    const userModalTitle = document.getElementById("userModalTitle");
    const userForm = document.getElementById("userForm");
    const userName = document.getElementById("userName");
    const userPhone = document.getElementById("userPhone");
    const userFile = document.getElementById("userFile");
    const userCancel = document.getElementById("userCancel");
  
    // crop modal
    const cropModal = document.getElementById("cropModal");
    const cropCanvas = document.getElementById("cropCanvas");
    const cropCtx = cropCanvas.getContext("2d");
    const zoomRange = document.getElementById("zoomRange");
    const cropSave = document.getElementById("cropSave");
    const cropCancel = document.getElementById("cropCancel");
    const cropTitle = document.getElementById("cropTitle");
  
    // login
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");
    const VALID_USER = "9787941086";
    const VALID_PASS = "Ajith@9787";
  
    // ---------- state ----------
    let peopleList = [];
    let action = null;
    let activePhone = null;        // phone used for the current image operation / editing
    let editingExisting = false;   // whether user modal is edit mode
    let pendingFile = null;        // selected file for cropping
    let imgObj = new Image();
    let imgW = 0, imgH = 0;
  
    // crop pan/zoom state
    let panX = 0, panY = 0;
    let isDragging = false, dragStartX = 0, dragStartY = 0, startPanX = 0, startPanY = 0;
  
    // ------------------- IndexedDB helpers -------------------
    function openImageDB() {
      return new Promise((res, rej) => {
        const req = indexedDB.open(IDB_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }
    try {
      if (typeof Swiper !== "undefined") {
        new Swiper(".mySwiper", {
          pagination: { el: ".swiper-pagination" },
          autoplay: { delay: 2500, disableOnInteraction: false },
          loop: true,
        });
      }
    } catch (e) { console.warn("Swiper init failed", e); }
  
    async function idbGetBlob(key) {
      try {
        const db = await openImageDB();
        return await new Promise((res, rej) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const store = tx.objectStore(IDB_STORE);
          const r = store.get(key);
          r.onsuccess = () => res(r.result || null);
          r.onerror = () => rej(r.error);
        });
      } catch (e) {
        console.warn("idbGetBlob error", e);
        return null;
      }
    }
  
    async function idbPutBlob(key, blob) {
      try {
        const db = await openImageDB();
        return await new Promise((res, rej) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          const r = store.put(blob, key);
          r.onsuccess = () => res(true);
          r.onerror = () => rej(r.error);
        });
      } catch (e) {
        console.warn("idbPutBlob error", e);
        return false;
      }
    }
  
    async function idbDeleteBlob(key) {
      try {
        const db = await openImageDB();
        return await new Promise((res, rej) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          const r = store.delete(key);
          r.onsuccess = () => res(true);
          r.onerror = () => rej(r.error);
        });
      } catch (e) {
        console.warn("idbDeleteBlob error", e);
        return false;
      }
    }
  
    async function idbClearAll() {
      try {
        const db = await openImageDB();
        return await new Promise((res, rej) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          const r = store.clear();
          r.onsuccess = () => res(true);
          r.onerror = () => rej(r.error);
        });
      } catch (e) {
        console.warn("idbClearAll error", e);
        return false;
      }
    }
  
    // ------------------- localStorage helpers (people list) -------------------
    function savePeopleToCache(list) {
      try { localStorage.setItem(LS_PEOPLE_KEY, JSON.stringify(list)); } catch (e) { console.warn(e); }
    }
    function loadPeopleFromCache() {
      try {
        const raw = localStorage.getItem(LS_PEOPLE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      } catch (e) { console.warn(e); return null; }
    }
  
    // ------------------- image caching & retrieval (uses image_url) -------------------
    async function getImageObjectUrl(phone) {
      if (!phone) return `${API_BASE}/images/no-photo.jpg`;
  
      // find user record (peopleList should be kept up-to-date)
      const user = peopleList.find(p => p.phone === phone);
      const imgUrl = user?.image_url || null;
  
      // 1) check IDB cache
      try {
        const cached = await idbGetBlob(phone);
        if (cached) return URL.createObjectURL(cached);
      } catch (e) {
        console.warn("idb get failed", e);
      }
  
      // 2) if we have an image_url, fetch it
      if (imgUrl) {
        try {
          const resp = await fetch(imgUrl, { cache: "no-store" });
          if (!resp.ok) throw new Error("fetch img failed");
          const blob = await resp.blob();
          try { await idbPutBlob(phone, blob); } catch (e) { console.warn("idb put failed", e); }
          return URL.createObjectURL(blob);
        } catch (e) {
          console.warn("getImageObjectUrl fetch failed", e);
          // fallthrough to fallback
        }
      }
  
      // 3) fallback: try server path like /images/<phone>.jpg (legacy)
      try {
        const resp2 = await fetch(`${API_BASE}/images/${phone}.jpg`, { cache: "no-store" });
        if (resp2.ok) {
          const blob2 = await resp2.blob();
          try { await idbPutBlob(phone, blob2); } catch (e) { console.warn("idb put failed", e); }
          return URL.createObjectURL(blob2);
        }
      } catch (e) {
        // ignore
      }
  
      // final fallback
      return `${API_BASE}/images/no-photo.jpg`;
    }
  
    function prefetchImagesForList(list) {
      if (!Array.isArray(list)) return;
      const phones = list.map(p => p.phone).filter(Boolean);
      const concurrency = 6;
      let idx = 0;
      let active = 0;
      function next() {
        if (idx >= phones.length) return;
        if (active >= concurrency) return;
        const phone = phones[idx++];
        active++;
        getImageObjectUrl(phone).finally(() => { active--; next(); });
        next();
      }
      for (let i = 0; i < concurrency; i++) next();
    }
  
    async function setImgSrcFromCache(imgEl, phone) {
      if (!imgEl) return;
      try {
        const urlOrPath = await getImageObjectUrl(phone);
        imgEl.src = urlOrPath;
        imgEl.onerror = () => { imgEl.src = `${API_BASE}/images/no-photo.jpg`; };
      } catch (e) {
        imgEl.src = `${API_BASE}/images/no-photo.jpg`;
      }
    }
  
    // ------------------- apply cached blobs to DOM immediately -------------------
    async function applyCachedImagesToDOM() {
      try {
        const imgs = Array.from(document.querySelectorAll("#cardsContainer .card img, #uploadCards .card img, #contactCard img"));
        if (!imgs.length) return;
        for (const img of imgs) {
          let phone = null;
          const h3 = img.parentElement?.querySelector("h3");
          if (h3) {
            const m = (h3.textContent || "").match(/\(([^)]+)\)$/);
            if (m && m[1]) phone = m[1].trim();
          }
          if (!phone && img.dataset?.phone) phone = img.dataset.phone;
          if (!phone && img.src) {
            const m2 = img.src.match(/\/images\/([^\/?#]+)\.jpg/);
            if (m2 && m2[1]) phone = m2[1];
          }
          if (!phone) continue;
          const blob = await idbGetBlob(phone);
          if (blob) {
            try {
              const obj = URL.createObjectURL(blob);
              img.src = obj;
              setTimeout(() => { try { URL.revokeObjectURL(obj); } catch(_) {} }, 60_000);
            } catch (e) { /* ignore */ }
          }
        }
      } catch (e) {
        console.warn("applyCachedImagesToDOM error", e);
      }
    }
  
    // ------------------- sync/refresh -------------------
    function setSyncStatus(text) {
      if (!syncStatusEl) return;
      syncStatusEl.textContent = text || "";
    }
  
    // Replace your existing doFullRefresh with this improved version.
  // Usage examples:
  //   doFullRefresh(false, false); // normal refresh (no cache clear) — same as before
  //   doFullRefresh(true, true);   // refresh AND clear local cache (IDB + localStorage)
  
  async function doFullRefresh(showAlert = false, clearCache = false) {
    try {
      if(showAlert){showLoader("Refreshing");}
      //else{showLoader("Welcome..");}
      // If requested, clear indexedDB blobs and localStorage first
      if (clearCache) {
        try {
          setSyncStatus("Clearing local cache...");
          // clear indexedDB store (images)
          await idbClearAll().catch((e) => console.warn("idbClearAll failed", e));
          // remove cached people list
          try { localStorage.removeItem(LS_PEOPLE_KEY); } catch (e) { console.warn("localStorage remove failed", e); }
          // reset in-memory list so UI shows 0 while we fetch fresh
          peopleList = [];
          setTotalCount();
          // optionally re-render empty views
          //renderHomeCards("");
          renderUploadCards("");
          renderContactCard();
        } catch (e) {
          console.warn("clearCache section failed", e);
        }
      }
  
      setSyncStatus("Refreshing...");
      const r = await fetch(`${API_BASE}/data.json`, { cache: "no-store" });
      if (!r.ok) throw new Error("Failed to fetch data.json");
      const fresh = await r.json();
      peopleList = Array.isArray(fresh) ? fresh : [];
  
      // persist new list to localStorage (overwrites previous)
      savePeopleToCache(peopleList);
  
      setTotalCount();
      // prefetch images (this will repopulate IDB)
      prefetchImagesForList(peopleList);
  
      // re-render UI with fresh data
      //renderHomeCards(document.getElementById("searchInput")?.value || "");
      renderUploadCards(uploadSearch?.value || "");
      renderContactCard();
  
      // apply any blobs from IDB to DOM (useful if prefetch already cached some)
      await applyCachedImagesToDOM();
  
      setSyncStatus("Refreshed ✓");
      //if (showAlert) alert("Refreshed from server ✔");
    } catch (e) {
      console.error("Full refresh failed", e);
      setSyncStatus("Refresh failed");
      if (showAlert) alert("Refresh failed: " + (e.message || ""));
    } finally {
      // clear status after a short delay
      setTimeout(() => setSyncStatus(""), 2000);
      hideLoader();
    }
  }
  
  
    async function startupLoad() {
      const cached = loadPeopleFromCache();
      if (cached && cached.length) {
        peopleList = cached;
        setTotalCount();
        //renderHomeCards(document.getElementById("searchInput")?.value || "");
        renderUploadCards(uploadSearch?.value || "");
        renderContactCard();
        prefetchImagesForList(peopleList);
        applyCachedImagesToDOM().catch(()=>{});
      }
      // refresh from server to ensure image_url is fresh
      doFullRefresh(false);
    }
  
    // ------------------- UI: total count -------------------
    function setTotalCount() {
      const el = document.getElementById("totalUser");
      if (!el) return;
      el.textContent = peopleList.length;
    }
  
    // ------------------- Navigation -------------------
    document.querySelectorAll(".nav-link").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const v = a.dataset.view;
        showView(v);
        if (v === "contact") renderContactCard();
      });
    });
  
    function showView(name) {
      Object.values(views).forEach(v => v.style.display = "none");
      if (views[name]) views[name].style.display = "block";
      document.getElementById("nav-login").textContent = (name === "upload") ? "Upload" : "Login";
      //if (name === "home") renderHomeCards(document.getElementById("searchInput").value || "");
      if (name === "upload") renderUploadCards();
    }
  
    showView("home");
  
    // ------------------- Rendering -------------------
  
  
    function renderContactCard() {
      contactCard.innerHTML = "";
      const aj = peopleList.find(x => x.phone === "9787941086") || peopleList[0];
      if (!aj) return;
      const c = document.createElement("div");
      c.className = "card";
      c.style.maxWidth = "300px";
      c.style.margin = "0 auto";
  
      const img = document.createElement("img");
      img.draggable = false;
      img.dataset.phone = aj.phone;
      img.src = `${API_BASE}/images/no-photo.jpg`;
      setImgSrcFromCache(img, aj.phone);
  
      const nm = document.createElement("h3");
      nm.textContent = `${aj.name} (${aj.phone})`;
  
      const wa = document.createElement("a");
      wa.className = "call-btn";
      wa.style.background = "#25D366";
      wa.href = `https://wa.me/91${aj.phone}?text=Hi ${encodeURIComponent(aj.name)}`;
      wa.target = "_blank";
      wa.textContent = "📩 WhatsApp";
  
      c.appendChild(img);
      c.appendChild(nm);
      c.appendChild(wa);
  
      contactCard.appendChild(c);
  
      applyCachedImagesToDOM().catch(()=>{});
    }
  
    async function renderUploadCards(filter = "") {
      const q = (filter || "").toLowerCase();
      uploadCards.innerHTML = "";
  
      for (let i = 0; i < peopleList.length; i++) {
        const p = peopleList[i];
        if (!p) continue;
        if ((p.name || "").toLowerCase().includes(q) || (p.phone || "").includes(q)) {
          const c = document.createElement("div");
          c.className = "card";
  
          const img = document.createElement("img");
          img.draggable = false;
          img.dataset.phone = p.phone;
          img.src = `${API_BASE}/images/no-photo.jpg`;
          setImgSrcFromCache(img, p.phone);
  
          const nm = document.createElement("h3");
          nm.textContent = `${p.name} (${p.phone})`;
  
          const actions = document.createElement("div");
          actions.style.display = "flex";
          actions.style.gap = "8px";
          actions.style.justifyContent = "center";
          actions.style.marginTop = "8px";
  
          const editBtn = document.createElement("button");
          editBtn.className = "call-btn";
          editBtn.style.background = "#f39c12";
          editBtn.textContent = "Edit";
          editBtn.onclick = (ev) => { ev.stopPropagation(); openUserModal(p, true); };
  
          const imgBtn = document.createElement("button");
          imgBtn.className = "call-btn";
          imgBtn.style.background = "#3498db";
          imgBtn.textContent = "Change Image";
          imgBtn.onclick = (ev) => {
            ev.stopPropagation();
            activePhone = p.phone;
            userFile.value = "";
            userFile.click();
          };
  
          actions.appendChild(editBtn);
          actions.appendChild(imgBtn);
  
          c.appendChild(img);
          c.appendChild(nm);
          c.appendChild(actions);
  
          c.onclick = () => openUserModal(p, true);
  
          uploadCards.appendChild(c);
        }
      }
  
      await applyCachedImagesToDOM().catch(()=>{});
    }
  
    uploadSearch.addEventListener("input", (e) => renderUploadCards(e.target.value.trim()));
    addUserBtn.addEventListener("click", () => openUserModal({ name: "", phone: "" }, false));
    logoutBtn.addEventListener("click", () => showView("home"));
  
    // ------------------- Modals -------------------
    function openUserModal(person, isEdit) {
      editingExisting = !!isEdit;
      userModalTitle.textContent = isEdit ? "Edit User" : "Add User";
      userName.value = person.name || "";
      userPhone.value = person.phone || "";
      activePhone = person.phone || null;
      action = isEdit ? "Edit User" : "Add User";
      userFile.value = "";
      userModal.style.display = "flex";
      document.body.classList.add("modal-open");
      setTimeout(() => userName.focus(), 60);
    }
    function closeUserModal() {
      userModal.style.display = "none";
      document.body.classList.remove("modal-open");
    }
    userCancel.addEventListener("click", closeUserModal);
    userModal.addEventListener("click", (ev) => { if (ev.target === userModal) closeUserModal(); });
  
    // ------------------- Server API helpers -------------------
    async function saveUserToServer(name, phone, oldPhone = null) {
      const res = await fetch(`${API_BASE}/saveUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, oldPhone })
      });
      return await res.json();
    }
  
    async function uploadCroppedImage(phone, actionVal, dataUrl, nameVal = "") {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append("file", blob, phone + ".jpg");
      form.append("phone", phone);
      if (actionVal) form.append("action", actionVal);
      if (nameVal) form.append("name", nameVal);
      const res = await fetch(`${API_BASE}/uploadImage`, { method: "POST", body: form });
      try {
        return await res.json();
      } catch (e) {
        return { ok: false, msg: "Invalid JSON response" };
      }
    }
  
    // ------------------- User form submit (add/edit) -------------------
    userForm.addEventListener("submit", async (e) => {
      e.preventDefault();
    
      const name = (userName.value || "").trim();
      const phone = (userPhone.value || "").trim();
      const oldPhone = editingExisting ? activePhone : null;
    
      if (!name || !phone) { 
        alert("Name and mobile are required."); 
        return; 
      }
    
      // 🔥 Show loader + disable buttons
      showLoader("Saving user…");
      userSave.disabled = true;
      userCancel.disabled = true;
    
      try {
        const out = await saveUserToServer(name, phone, oldPhone);
        if (!out.ok) { 
          alert(out.msg || "Save failed"); 
          return; 
        }
    
        // update local peopleList and cache (append or update)
        if (oldPhone) {
          const idx = peopleList.findIndex(p => p.phone === oldPhone);
          if (idx !== -1) {
            peopleList[idx].name = name;
            if (oldPhone !== phone) {
              // rename phone locally
              await idbDeleteBlob(oldPhone).catch(()=>{});
              peopleList[idx].phone = phone;
              delete peopleList[idx].image_url;
            }
          }
        } else {
          // append at end
          peopleList.push({ name, phone });
        }
    
        savePeopleToCache(peopleList);
    
        alert("Saved ✔");
        closeUserModal();
        
        // refresh UI: re-render
        setTotalCount();
        //renderHomeCards();
        renderUploadCards();
        getImageObjectUrl(phone).catch(()=>{});
    
      } catch (error) {
        console.error(error);
        alert("Error saving user");
      } finally {
        // hide loader + re-enable buttons
        hideLoader();
        userSave.disabled = false;
        userCancel.disabled = false;
      }
    });
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showLoader("Checking...");
    
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
    
      if (!username || !password) {
        hideLoader();
        loginError.textContent = "Enter username & password";
        loginError.style.display = "block";
        return;
      }
    
      try {
        const r = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
    
        const j = await r.json();
        hideLoader();
    
        if (!j.ok) {
          loginError.textContent = j.msg || "Login failed";
          loginError.style.display = "block";
          return;
        }
    
        // Login success
        loginError.style.display = "none";
        localStorage.setItem("loggedUser", JSON.stringify(j.user));
        showView("upload");
    
      } catch (err) {
        hideLoader();
        loginError.textContent = "Network error";
        loginError.style.display = "block";
      }
    });
    
    
  
    // ------------------- File selection & cropper -------------------
    userFile.addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!/jpe?g/i.test(f.type)) { alert("Please choose a JPG image."); return; }
  
      if (!activePhone) {
        const phoneFromForm = (document.getElementById("userPhone").value || "").trim();
        if (!phoneFromForm) {
          alert("Enter mobile number in the add form before choosing image.");
          return;
        }
        activePhone = phoneFromForm;
      }
  
      pendingFile = f;
      openCropModal(f);
    });
  
    function openCropModal(file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        imgObj = new Image();
        imgObj.onload = () => {
          imgW = imgObj.naturalWidth;
          imgH = imgObj.naturalHeight;
          cropCanvas.width = Math.min(520, window.innerWidth - 120);
          cropCanvas.height = Math.round(cropCanvas.width * 0.9);
          panX = 0; panY = 0;
          zoomRange.value = 1;
          drawCrop();
          cropModal.style.display = "flex";
          document.body.classList.add("modal-open");
        };
        imgObj.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  
    function drawCrop() {
      const cw = cropCanvas.width, ch = cropCanvas.height;
      const zoom = parseFloat(zoomRange.value);
      cropCtx.clearRect(0, 0, cw, ch);
      const baseScale = Math.max(cw / imgW, ch / imgH);
      const scale = baseScale * zoom;
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const baseDx = (cw - drawW) / 2;
      const baseDy = (ch - drawH) / 2;
      const dx = baseDx + panX;
      const dy = baseDy + panY;
      cropCtx.drawImage(imgObj, dx, dy, drawW, drawH);
      cropCtx.strokeStyle = "rgba(255,255,255,0.95)";
      cropCtx.lineWidth = 2;
      cropCtx.strokeRect(1, 1, cw - 2, ch - 2);
    }
  
    cropCanvas.style.touchAction = "none";
    cropCanvas.addEventListener("pointerdown", (ev) => {
      isDragging = true;
      dragStartX = ev.clientX;
      dragStartY = ev.clientY;
      startPanX = panX;
      startPanY = panY;
      try { cropCanvas.setPointerCapture(ev.pointerId); } catch (_) {}
    });
    cropCanvas.addEventListener("pointermove", (ev) => {
      if (!isDragging) return;
      const dx = ev.clientX - dragStartX;
      const dy = ev.clientY - dragStartY;
      panX = startPanX + dx;
      panY = startPanY + dy;
      drawCrop();
    });
    cropCanvas.addEventListener("pointerup", (ev) => {
      isDragging = false;
      try { cropCanvas.releasePointerCapture(ev.pointerId); } catch (_) {}
    });
    cropCanvas.addEventListener("pointercancel", () => { isDragging = false; });
  
    zoomRange.addEventListener("input", () => drawCrop());
  
    cropCancel.addEventListener("click", () => {
      cropModal.style.display = "none";
      document.body.classList.remove("modal-open");
      pendingFile = null;
    });
    cropModal.addEventListener("click", (ev) => { if (ev.target === cropModal) { cropModal.style.display = "none"; document.body.classList.remove("modal-open"); pendingFile = null; } });
  
    // ---------- helper: compress dataURL (resize quality) ----------
    async function compressDataURL(dataUrl, quality = 0.8, maxW = 1024) {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const scale = (w > maxW) ? (maxW / w) : 1;
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          res(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = dataUrl;
      });
    }
  
    // ---------- Save cropped image ----------
    cropSave.addEventListener("click", async () => {
      if (!activePhone) { alert("Phone missing."); return; }
    
      // show loader + disable UI
      showLoader("Saving image…");
      setCropUIEnabled(false);
    
      try {
        // get cropped data URL
        let dataUrl = cropCanvas.toDataURL("image/jpeg", 0.92);
        // compress it (resize + quality)
        dataUrl = await compressDataURL(dataUrl, 0.7, 1024);
    
        // ensure user exists on server; if not, create minimal user
        const exists = peopleList.find(p => p.phone === activePhone);
        if (!exists) {
          const nameValue = (document.getElementById("userName").value || activePhone).trim();
          const out = await saveUserToServer(nameValue, activePhone, null);
          if (!out.ok) {
            alert("Failed to save user: " + (out.msg || ""));
            return;
          }
          await new Promise(r => setTimeout(r, 150));
          peopleList.push({ name: nameValue, phone: activePhone });
          savePeopleToCache(peopleList);
          setTotalCount();
          //renderHomeCards();
          renderUploadCards();
        }
    
        const nameForReq = (document.getElementById("userName").value).trim();
        const up = await uploadCroppedImage(activePhone, action, dataUrl, nameForReq);
    
        if (!up || !up.ok) {
          alert("Image save failed: " + ((up && up.msg) || "Unknown"));
          closeUserModal();
          cropModal.style.display = "none";
          document.body.classList.remove("modal-open");
          return;
        }
    
        if (up.path) {
          const idx = peopleList.findIndex(x => x.phone === activePhone);
          if (idx !== -1) {
            peopleList[idx].image_url = up.path;
          } else {
            peopleList.push({ name: nameForReq, phone: activePhone, image_url: up.path });
          }
          savePeopleToCache(peopleList);
    
          try {
            const resp = await fetch(up.path, { cache: "no-store" });
            if (resp.ok) {
              const blob = await resp.blob();
              await idbPutBlob(activePhone, blob).catch(()=>{});
            }
          } catch (e) { console.warn("fetch after upload failed", e); }
    
        } else {
          try {
            const resp = await fetch(`${API_BASE}/images/${activePhone}.jpg`, { cache: "no-store" });
            if (resp.ok) {
              const blob = await resp.blob();
              await idbPutBlob(activePhone, blob).catch(()=>{});
            }
          } catch (e) {}
        }
    
        cropModal.style.display = "none";
        closeUserModal();
        if (action === "Add User") alert("Profile saved ✔"); else alert("Image saved ✔");
    
        setTotalCount();
        //renderHomeCards();
        renderUploadCards();
    
      } catch (err) {
        console.error("cropSave error", err);
        alert("Save failed: " + (err.message || err));
    
      } finally {
        // ALWAYS hide loader + re-enable UI
        hideLoader();
        setCropUIEnabled(true);
      }
    });
    
  
    // ------------------- Login -------------------
    // loginForm.addEventListener("submit", (e) => {
    //   showLoader("Loading......");
    //   e.preventDefault();
    //   const u = (document.getElementById("username").value || "").trim();
    //   const p = (document.getElementById("password").value || "").trim();
    //   if (u === VALID_USER && p === VALID_PASS) {
    //     showView("upload");
    //     hideLoader();
    //     return;
    //   }
    //   loginError.textContent = "Wrong username or password";
    //   loginError.style.display = "block";
    // });
  
    document.getElementById("userPhone").addEventListener("input", function () {
      this.value = this.value.replace(/[^0-9]/g, "");
    });
  
    // ------------------- Refresh button -------------------
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        await doFullRefresh(true,true);
      });
    }
    function showLoader(text="Saving…") {
      const g = document.getElementById("globalLoader");
      if (!g) return;
      g.style.display = "flex";
      const t = g.querySelector(".loader-text");
      if (t) t.textContent = text;
    }
    
    function hideLoader() {
      const g = document.getElementById("globalLoader");
      if (!g) return;
      g.style.display = "none";
    }
    
    function setCropUIEnabled(enabled) {
      cropSave.disabled = !enabled;
      cropCancel.disabled = !enabled;
      zoomRange.disabled = !enabled;
    
      cropSave.textContent = enabled ? "Save Crop" : "Saving...";
    }
      // ------------------- Startup -------------------
    startupLoad();
  
    // Expose some functions for debugging (optional)
    window.poolampatti = {
      doFullRefresh, clearAllLocalCache: idbClearAll, getImageObjectUrl, savePeopleToCache
    };
  }); // end DOMContentLoaded
  
  
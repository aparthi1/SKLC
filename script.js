document.addEventListener("DOMContentLoaded", () => {

  //const API_BASE = "http://localhost:8080"; 
  const API_BASE = "https://sklc-api-dev.onrender.com"; 

  const views = {
    Table: document.getElementById("view-table"),
    login: document.getElementById("view-login"),
  };
  
 // login
 const loginForm = document.getElementById("loginForm");
 const loginError = document.getElementById("loginError");

try {
  if (typeof Swiper !== "undefined") {
    new Swiper(".mySwiper", {
      pagination: { el: ".swiper-pagination" },
      autoplay: { delay: 2500, disableOnInteraction: false },
      loop: true,
    });
  }
} catch (e) { console.warn("Swiper init failed", e); }

document.getElementById("filterIo").addEventListener("input", applyFilters);
document.getElementById("filterColour").addEventListener("input", applyFilters);
document.getElementById("filterSize").addEventListener("input", applyFilters);
document.getElementById("filterQty").addEventListener("input", applyFilters);

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

    const response = await fetch(`${API_BASE}/api/io`);
    const result = await response.json();
  
    if (result.ok) {
      bindTable(result.data);
      showView("Table");
      populateFilters(data);
    }
  } catch (err) {
    hideLoader();
    loginError.textContent = "Network error";
    loginError.style.display = "block";
  }
  document.getElementById("saveIO")
  .addEventListener("click", async () => {
  debugger
    const ioNumber =
      document.getElementById("ioNumber").value.trim();
  
    const colour =
      document.getElementById("colour").value;
  
    if (!ioNumber) {
      alert("Enter IO Number");
      return;
    }
  
    if (!colour) {
      alert("Select Colour");
      return;
    }
  
    const sizeRows =
      document.querySelectorAll(".size-row");
  
    const payload = [];
  
    let hasError = false;
  
    sizeRows.forEach(row => {
  
      const size =
        row.querySelector(".size").value;
  
      const qty =
        row.querySelector(".qty").value;
  
      if (!size || !qty) {
        hasError = true;
        return;
      }
  
      payload.push({
        IoNumber: ioNumber,
        Colour: colour,
        Size: size,
        Quantity: parseInt(qty)
      });
  
    });
  
    if (hasError) {
      alert("Please enter Size and Quantity for all rows");
      return;
    }
  
    if (payload.length === 0) {
      alert("Add at least one Size");
      return;
    }
  
    console.log("Payload:", payload);
  
    try {
  
      const response = await fetch(
        `${API_BASE}/api/ioInset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
  
      const result = await response.json();
  
      if (!result.ok) {
        alert(result.msg || "Save Failed");
        return;
      }
  
      alert("Saved Successfully");
  
      // Close Modal
      document.getElementById("ioModal").style.display = "none";
  
      // Clear Form
      document.getElementById("ioNumber").value = "";
      document.getElementById("colour").value = "";
  
      document.getElementById("sizeContainer").innerHTML = `
        <div class="size-row">
          <select class="size">
            <option value="">Select Size</option>
            <option>S</option>
            <option>M</option>
            <option>L</option>
            <option>XL</option>
            <option>XXL</option>
          </select>
  
          <input type="number"
                 class="qty"
                 placeholder="Quantity">
  
          <button type="button"
                  class="add-size">+</button>
        </div>
      `;
  
      // Reload Table
      const tableResponse =
        await fetch(`${API_BASE}/api/io`);
  
      const tableResult =
        await tableResponse.json();
  
      if (tableResult.ok) {
        bindTable(tableResult.data);
      }
  
    } catch (err) {
      debugger
      console.error(err);
      alert("Server Error");
    }
  
  });
});


// Functions 

function showLoader(text="Saving…") {
  const g = document.getElementById("globalLoader");
  if (!g) return;
  g.style.display = "flex";
  const t = g.querySelector(".loader-text");
  if (t) t.textContent = text;
}


let allData = [];
function bindTable(data) {
  const totals = {};
  const tbody = document.querySelector("#ioTable tbody");
  allData = data;
  data.forEach(row => {

    const date = row.created_at.split('T')[0];

    const key = `${date}_${row.IoNumber}_${row.Colour}`;

    totals[key] = (totals[key] || 0) + Number(row.Quantity || 0);
  });

  tbody.innerHTML = "";

  data.forEach((row, index) => {
    const date = new Date(row.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    const dateF = row.created_at.split('T')[0];
    const key = `${dateF}_${row.IoNumber}_${row.Colour}`;
    tbody.innerHTML += `
      <tr>
        <td>${index + 1}</td>
         <td>${date}</td>
        <td>${row.IoNumber}</td>
        <td>${row.Colour}</td>
        <td>${row.Size}</td>
        <td>${row.Quantity}</td>
        <td>${totals[key]}</td>
      </tr>
    `;
  });
}

function showView(name) {
  Object.values(views).forEach(v => v.style.display = "none");
  if (views[name]) views[name].style.display = "block";
}

function hideLoader() {
  const g = document.getElementById("globalLoader");
  if (!g) return;
  g.style.display = "none";
}

function applyFilters() {

  const io = document.getElementById("filterIo").value.toLowerCase();
  const colour = document.getElementById("filterColour").value.toLowerCase();
  const size = document.getElementById("filterSize").value.toLowerCase();
  const qty = document.getElementById("filterQty").value.toLowerCase();

  const filtered = allData.filter(row =>
    String(row.IoNumber || '').toLowerCase().includes(io) &&
    String(row.Colour || '').toLowerCase().includes(colour) &&
    String(row.Size || '').toLowerCase().includes(size) &&
    String(row.Quantity || '').toLowerCase().includes(qty)
  );

  bindFilteredTable(filtered);
}

function bindFilteredTable(data) {
  const totals = {};
  const tbody = document.querySelector("#ioTable tbody");
  tbody.innerHTML = "";
  
  data.forEach(row => {

    const dateF = row.created_at.split('T')[0];

    const key = `${dateF}_${row.IoNumber}_${row.Colour}`;

    totals[key] = (totals[key] || 0) + Number(row.Quantity || 0);
  });


  data.forEach((row, index) => {
    const date = new Date(row.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    const dateF = row.created_at.split('T')[0];
    const key = `${dateF}_${row.IoNumber}_${row.Colour}`;
    tbody.innerHTML += `
      <tr>
        <td>${index + 1}</td>
        <td>${date}</td>
        <td>${row.IoNumber}</td>
        <td>${row.Colour}</td>
        <td>${row.Size}</td>
        <td>${row.Quantity}</td>
         <td>${totals[key]}</td>
      </tr>
    `;
  });
}
function populateFilters(data) {

  const colourDropdown = document.getElementById("filterColour");
  const sizeDropdown = document.getElementById("filterSize");

  const colours = [...new Set(data.map(x => x.Colour).filter(Boolean))];
  const sizes = [...new Set(data.map(x => x.Size).filter(Boolean))];

  colourDropdown.innerHTML =
    '<option value="">All Colours</option>';

  sizeDropdown.innerHTML =
    '<option value="">All Sizes</option>';

  colours.sort().forEach(colour => {
    colourDropdown.innerHTML +=
      `<option value="${colour}">${colour}</option>`;
  });

  sizes.sort().forEach(size => {
    sizeDropdown.innerHTML +=
      `<option value="${size}">${size}</option>`;
  });
}
});

const modal = document.getElementById("ioModal");

document.getElementById("btnAddIO")
.addEventListener("click", () => {
  modal.style.display = "block";
});

document.querySelector(".close")
.addEventListener("click", () => {
  modal.style.display = "none";
});

document.addEventListener("click", function(e){

  if(e.target.classList.contains("add-size")){

    const row = document.createElement("div");

    row.className = "size-row";

    row.innerHTML = `
      <select class="size">
        <option value="">Select Size</option>
        <option>S</option>
        <option>M</option>
        <option>L</option>
        <option>XL</option>
        <option>XXL</option>
      </select>

      <input type="number"
             class="qty"
             placeholder="Quantity">

      <button type="button"
              class="remove-size">−</button>
    `;

    document
      .getElementById("sizeContainer")
      .appendChild(row);
  }

  if(e.target.classList.contains("remove-size")){
    e.target.closest(".size-row").remove();
  }


});


let allData = [];
let currentPage = 1;
const pageSize = 10;
let filteredData = [];

document.addEventListener("DOMContentLoaded", () => {

  //const API_BASE = "http://localhost:8080"; 
  const API_BASE = "https://sklc.onrender.com"; 

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
  showLoader("Io Fetching...");
  try {
    const r = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const j = await r.json();
   

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
      populateFilters(result.data);
    }
  } catch (err) {
    hideLoader();
    loginError.textContent = "Network error";
    loginError.style.display = "block";
  }finally{
    hideLoader();
  }

  function showView(name) {
    Object.values(views).forEach(v => v.style.display = "none");
    if (views[name]) views[name].style.display = "block";
  }
  document.getElementById("saveIO")
  .addEventListener("click", async () => {
    showLoader();
    const saveBtn = document.getElementById("saveIO");
    try{
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
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
  }catch(err){

    console.error(err);
    alert("Server Error");
 
 }
 finally{
  hideLoader();
  saveBtn.disabled = false;
  saveBtn.textContent = "Save";
 
 }
  
  });
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
const reportModal =
    document.getElementById("reportModal");

document
.getElementById("btnReport")
.addEventListener("click", () => {

    reportModal.style.display = "block";

});

document
.getElementById("closeReportModal")
.addEventListener("click", () => {

    reportModal.style.display = "none";

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

function bindTable(data) {

  allData = data;
  filteredData = data;
  currentPage = 1;

  renderTable();
  renderPagination();
}

function renderTable() {

  const tbody = document.querySelector("#ioTable tbody");

  const totals = {};

  filteredData.forEach(row => {

    const dateF = row.created_at.split("T")[0];

    const key = `${dateF}_${row.IoNumber}_${row.Colour}`;

    totals[key] = (totals[key] || 0) + Number(row.Quantity || 0);

  });

  tbody.innerHTML = "";

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const pageData = filteredData.slice(start, end);

  pageData.forEach((row, index) => {

    const date = new Date(row.created_at).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const dateF = row.created_at.split("T")[0];

    const key = `${dateF}_${row.IoNumber}_${row.Colour}`;

    tbody.innerHTML += `
      <tr>
        <td>${start + index + 1}</td>
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

function renderPagination() {
  const totalRecords = filteredData.length;

  const startRecord =
    totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  
  const endRecord =
    Math.min(currentPage * pageSize, totalRecords);
  
  document.getElementById("recordInfo").innerHTML =
    `Showing ${startRecord} - ${endRecord} of ${totalRecords} records`;

  const pagination =
    document.getElementById("pagination");

  const totalPages =
    Math.ceil(filteredData.length / pageSize);

  pagination.innerHTML = "";

  if (totalPages <= 1) return;

  // Previous Button
  pagination.innerHTML += `
    <button
      onclick="changePage(${currentPage - 1})"
      ${currentPage === 1 ? "disabled" : ""}>
      Prev
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {

    pagination.innerHTML += `
      <button
        class="${i === currentPage ? 'active' : ''}"
        onclick="changePage(${i})">
        ${i}
      </button>
    `;
  }

  // Next Button
  pagination.innerHTML += `
    <button
      onclick="changePage(${currentPage + 1})"
      ${currentPage === totalPages ? "disabled" : ""}>
      Next
    </button>
  `;
}



function hideLoader() {
  const g = document.getElementById("globalLoader");
  if (!g) return;
  g.style.display = "none";
}

function applyFilters() {

  const io =
    document.getElementById("filterIo").value.toLowerCase();

  const colour =
    document.getElementById("filterColour").value.toLowerCase();

  const size =
    document.getElementById("filterSize").value.toLowerCase();

  const qty =
    document.getElementById("filterQty").value.toLowerCase();

    filteredData = allData.filter(row =>
    String(row.IoNumber || '').toLowerCase().includes(io) &&
    String(row.Colour || '').toLowerCase().includes(colour) &&
    String(row.Size || '').toLowerCase().includes(size) &&
    String(row.Quantity || '').toLowerCase().includes(qty)
  );

  currentPage = 1;

  renderTable();
  renderPagination();
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

function changePage(page) {

  const totalPages =
    Math.ceil(filteredData.length / pageSize);

  if (page < 1 || page > totalPages)
    return;

  currentPage = page;

  renderTable();
  renderPagination();
}

// Normal Report
document
.getElementById("btnExport")
.addEventListener("click", () => {

    const currentDate =
        new Date().toISOString().split("T")[0];

    exportExcel(
        filteredData,
        "",
        currentDate
    );

});

// btnGenerateReport

document
.getElementById("btnGenerateReport")
.addEventListener("click", () => {

    const fromDate =
        document.getElementById("fromDate").value;

    const toDate =
        document.getElementById("toDate").value;

    if (!fromDate || !toDate) {

        alert("Select From Date and To Date");
        return;
    }

    const reportData = allData.filter(x => {

        const dataDate =
            x.created_at.split("T")[0];

        return (
            dataDate >= fromDate &&
            dataDate <= toDate
        );

    });

    if (reportData.length === 0) {

        alert("No Data Found");
        return;
    }

    reportModal.style.display = "none";

    exportExcel(
        reportData,
        fromDate,
        toDate
    );

});

async function exportExcel(
  reportData,
  fromDate = "",
    toDate = ""
) {

  const workbook =
      new ExcelJS.Workbook();

  const worksheet =
      workbook.addWorksheet("IO Report");

  worksheet.getColumn(1).width = 28;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 12;

  // Title

  worksheet.mergeCells("A1:E1");

  const titleCell =
      worksheet.getCell("A1");

  titleCell.value =
      "SRI KADESHWARA LAY CUTTING";

  titleCell.font = {
      bold: true,
      size: 18,
      color: { argb: "FFFF00" }
  };

  titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "008000" }
  };

  titleCell.alignment = {
      horizontal: "center",
      vertical: "middle"
  };

  worksheet.getRow(1).height = 30;

  // Generated On

  worksheet.mergeCells("A2:E2");

  worksheet.getCell("A2").value =
      "Generated On : " +
      new Date().toLocaleString(
          "en-GB",
          {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true
          }
      );

  worksheet.getCell("A2").alignment = {
      horizontal: "center"
  };

  // Report Period

  worksheet.mergeCells("A3:E3");

  worksheet.getCell("A3").value =
      `Report Period : ${fromDate} To ${toDate}`;

  worksheet.getCell("A3").font = {
      bold: true
  };

  worksheet.getCell("A3").alignment = {
      horizontal: "center"
  };

  // Header Row

  const headerRow =
      worksheet.addRow([
          "Date",
          "IO Number",
          "Colour",
          "Size",
          "Quantity"
      ]);

  headerRow.eachCell(cell => {

      cell.font = {
          bold: true,
          color: {
              argb: "FFFFFF"
          }
      };

      cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
              argb: "4472C4"
          }
      };

      cell.alignment = {
          horizontal: "center"
      };

      cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" }
      };

  });

  // Data

  reportData.forEach(x => {

      const row =
          worksheet.addRow([

              new Date(
                  x.created_at
              ).toLocaleString(
                  "en-GB",
                  {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true
                  }
              ),

              x.IoNumber,
              x.Colour,
              x.Size,
              Number(x.Quantity)

          ]);

      row.eachCell(cell => {

          cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
              bottom: { style: "thin" }
          };

          cell.alignment = {
              horizontal: "center"
          };

      });

  });

  // Grand Total

  const grandTotal =
      reportData.reduce(
          (sum, x) =>
              sum +
              Number(
                  x.Quantity || 0
              ),
          0
      );

  const totalRow =
      worksheet.addRow([
          "",
          "",
          "",
          "TOTAL",
          grandTotal
      ]);

  totalRow.eachCell(cell => {

      cell.font = {
          bold: true
      };

      cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
              argb: "FFD966"
          }
      };

      cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" }
      };

      cell.alignment = {
          horizontal: "center"
      };

  });

  // Download

  const buffer =
      await workbook.xlsx.writeBuffer();

  const blob =
      new Blob(
          [buffer],
          {
              type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
      );

  const link =
      document.createElement("a");

  link.href =
      URL.createObjectURL(blob);

  link.download =
      `SKLC_Report_${fromDate}_To_${toDate}.xlsx`;

  link.click();

  URL.revokeObjectURL(
      link.href
  );
}
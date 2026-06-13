// CẤU HÌNH API KẾT NỐI VỚI GOOGLE SHEETS
const API_URL = "https://script.google.com/macros/s/AKfycby5FSomcC3sDICd2WYmz6mDVT3p6kdgoDvECo22DzrWDNdeTpphfDDMA_LYjEXD5n-z/exec";

// Hàm gọi API chuẩn hóa để dùng cho mọi request
async function callGoogleAPI(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, ...payload }),
            // Headers thiết lập dạng plain text để tránh bị trình duyệt chặn CORS preflight
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.status === "error") throw new Error(result.message);
        return result.data;
    } catch (error) {
        console.error("Lỗi gọi API:", error);
        throw error;
    }
}

let CURRENT_STAFF = "";
let blockCounter = 0;

const CONFIG_SERVICES = {
    "CHUẨN HÓA, XÁC THỰC TTTB": [
        { sheetCol: "ma_gioi_thieu", label: "Mã giới thiệu", type: "text", placeholder: "Nhập mã...", required: false },
        { sheetCol: "ghi_chu", label: "Ghi chú", type: "text", placeholder: "Nhập ghi chú...", required: false }
    ],
    "NẠP TIỀN DI ĐỘNG": [
        { sheetCol: "gia_tien", label: "Số tiền nạp", type: "text", placeholder: "VD: 100.000", isCurrency: true },
        { sheetCol: "ghi_chu", label: "Ghi chú", type: "text", placeholder: "Nhập ghi chú...", required: false }
    ],
    "ĐĂNG KÝ GÓI CƯỚC DI ĐỘNG": [
        { sheetCol: "ten_goi", label: "Tên gói cước", type: "text", placeholder: "VD: MXH120..." },
        { sheetCol: "gia_tien", label: "Giá tiền gói", type: "text", placeholder: "VD: 120.000", isCurrency: true },
        { sheetCol: "ma_gioi_thieu", label: "Mã giới thiệu", type: "text", placeholder: "Nhập mã...", required: false },
        { sheetCol: "ghi_chu", label: "Ghi chú", type: "text", placeholder: "Nhập ghi chú...", required: false }
    ],
    "BÁN SIM": [
        { sheetCol: "gia_tien", label: "Giá tiền sim", type: "text", placeholder: "Nhập giá tiền...", isCurrency: true },
        { sheetCol: "ma_gioi_thieu", label: "Mã giới thiệu", type: "text", placeholder: "Nhập mã giới thiệu...", required: false }
    ]
};

window.onload = function () {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        showMainApp(savedUser);
    } else {
        initForm();
    }
};

async function doLogin() {
    const inputId = document.getElementById('staff-id').value.trim().toUpperCase();
    const pass = document.getElementById('password').value;

    if (inputId === "") return alert("Vui lòng điền Mã nhân viên để bắt đầu!");
    if (pass === "") return alert("Vui lòng điền Mật khẩu!");

    const btn = document.getElementById('btn-login');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang xác thực...';

    try {
        const res = await callGoogleAPI('checkLogin', { staffId: inputId, pass: pass });

        btn.disabled = false;
        btn.innerHTML = originalText;

        if (res.success) {
            localStorage.setItem('currentUser', res.staffId);
            showMainApp(res.staffId);
        } else {
            alert(res.message);
        }
    } catch (error) {
        alert("Lỗi kết nối đến máy chủ. Vui lòng thử lại!");
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function logOut() {
    if (confirm("Bạn có chắc chắn muốn đăng xuất ca làm việc?")) {
        localStorage.removeItem('currentUser');
        location.reload();
    }
}

function showMainApp(staffId) {
    CURRENT_STAFF = staffId;
    document.getElementById('welcome-msg').innerText = CURRENT_STAFF;
    document.body.style.backgroundColor = "#f1f5f9";
    document.getElementById('login-screen').style.display = "none";
    document.getElementById('main-app').style.display = "block";
    initForm();
    loadHistoryFromServer(staffId);
}

async function loadHistoryFromServer(staffId) {
    const tbody = document.getElementById("history-table");
    tbody.innerHTML = '<tr><td colspan="7" class="p-16 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-4xl mb-3"></i><br>Đang tải dữ liệu ca làm việc...</td></tr>';

    try {
        const historyData = await callGoogleAPI('getRecentHistory', { staffId: staffId });
        renderHistoryData(historyData);
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-16 text-center text-red-500">Lỗi tải dữ liệu. Vui lòng tải lại trang.</td></tr>';
    }
}

function renderHistoryData(data) {
    const tbody = document.getElementById("history-table");
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr class="empty-msg"><td colspan="7" class="p-16 text-center text-slate-400 border-b-0"><div class="flex flex-col items-center justify-center"><i class="fa-regular fa-folder-open text-4xl mb-3 text-slate-300"></i><p>Chưa có giao dịch nào được ghi nhận.</p></div></td></tr>';
        return;
    }

    let groups = {};
    let orderKeys = [];

    data.forEach(item => {
        let k = item.orderId || ('legacy_' + Math.random().toString());
        if (!groups[k]) {
            groups[k] = [];
            orderKeys.push(k);
        }
        groups[k].unshift(item);
    });

    orderKeys.reverse().forEach(k => {
        addOrderToTable(groups[k], k, true);
    });
}

function initForm() {
    document.getElementById("services-wrapper").innerHTML = "";
    blockCounter = 0;
    addServiceBlock();
}

function formatCurrencyInput(e) {
    let val = e.target.value.replace(/\D/g, '');
    if (val !== '') {
        e.target.value = Number(val).toLocaleString('vi-VN');
    } else {
        e.target.value = '';
    }
}

function getRawNumber(str) { return str ? str.replace(/\D/g, '') : ""; }

function updateServiceLabels() {
    const blocks = document.querySelectorAll('.service-block');
    blocks.forEach((block, index) => {
        const label = block.querySelector('.service-label');
        let deleteBtn = block.querySelector('.delete-btn');
        if (label) label.innerHTML = `Loại dịch vụ ${index + 1} <span class="text-red-500">*</span>`;
        if (index === 0) {
            if (deleteBtn) deleteBtn.remove();
        } else {
            if (!deleteBtn) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'delete-btn absolute top-3 right-3 text-slate-400 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors';
                btn.title = 'Xóa dịch vụ này';
                btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                btn.onclick = function () {
                    block.remove();
                    updateServiceLabels();
                    checkGlobalRules();
                };
                block.insertBefore(btn, block.firstChild);
            }
        }
    });
}

function addServiceBlock() {
    blockCounter++;
    const blockId = 'service-block-' + blockCounter;
    const optionsHtml = Object.keys(CONFIG_SERVICES).map(name => `<option value="${name}">${name}</option>`).join('');
    const html = `
    <div id="${blockId}" class="service-block relative bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label class="service-label block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide"></label>
        <select class="service-select w-full p-3 border border-slate-300 rounded-lg text-sm outline-none input-focus font-bold text-slate-800 bg-white appearance-none cursor-pointer" onchange="renderFields('${blockId}')">
            <option value="" class="font-normal text-slate-500">-- Bấm chọn dịch vụ --</option>
            ${optionsHtml}
        </select>
        <div class="dynamic-area bg-white border border-slate-200 p-4 rounded-lg space-y-4 hidden mt-3 shadow-sm">
            <div class="fields-container space-y-4"></div>
        </div>
    </div>
    `;
    document.getElementById('services-wrapper').insertAdjacentHTML('beforeend', html);
    updateServiceLabels();
    checkGlobalRules();
}

function renderFields(blockId) {
    const block = document.getElementById(blockId);
    const serviceName = block.querySelector('.service-select').value;
    const dynamicArea = block.querySelector('.dynamic-area');
    const fieldsContainer = block.querySelector('.fields-container');

    fieldsContainer.innerHTML = '';
    if (serviceName && CONFIG_SERVICES[serviceName]) {
        dynamicArea.style.display = 'block';
        CONFIG_SERVICES[serviceName].forEach(field => {
            const isReqText = field.required === false ? '<span class="text-slate-400 font-normal normal-case text-[10px] ml-1">(Không bắt buộc)</span>' : '<span class="text-red-500">*</span>';
            const inputClassExtras = field.isCurrency ? 'pr-12 text-right font-bold' : 'font-medium';
            const currencySpan = field.isCurrency ? `<span class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-[10px] font-bold">VND</span>` : '';
            const onInputEvt = field.isCurrency ? `oninput="formatCurrencyInput(event)"` : '';

            fieldsContainer.insertAdjacentHTML('beforeend', `
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">${field.label} ${isReqText}</label>
                <div class="relative">
                <input type="${field.type}" data-col="${field.sheetCol}" data-required="${field.required !== false}" class="dynamic-input w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none input-focus bg-slate-50 focus:bg-white transition-colors ${inputClassExtras}" placeholder="${field.placeholder}" ${onInputEvt}>
                ${currencySpan}
                </div>
            </div>
        `);
        });
    } else {
        dynamicArea.style.display = 'none';
    }
    checkGlobalRules();
}

function checkGlobalRules() {
    let hasDangKyGoi = false;
    const selects = document.querySelectorAll('.service-select');
    selects.forEach(select => {
        if (select.value === "ĐĂNG KÝ GÓI CƯỚC DI ĐỘNG") hasDangKyGoi = true;
    });

    const firstService = selects.length > 0 ? selects[0].value : "";
    const lastService = selects.length > 0 ? selects[selects.length - 1].value : "";
    const giaThuInput = document.getElementById("gia-thu");

    if (firstService === "BÁN SIM" && lastService === "ĐĂNG KÝ GÓI CƯỚC DI ĐỘNG") {
        giaThuInput.disabled = false;
        giaThuInput.classList.remove("bg-slate-200", "cursor-not-allowed", "opacity-50");
    } else if (hasDangKyGoi) {
        giaThuInput.disabled = true;
        giaThuInput.value = "";
        giaThuInput.classList.add("bg-slate-200", "cursor-not-allowed", "opacity-50");
    } else {
        giaThuInput.disabled = false;
        giaThuInput.classList.remove("bg-slate-200", "cursor-not-allowed", "opacity-50");
    }
}

async function sendDataToSheets() {
    const phone = document.getElementById('phone').value.trim();
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) return alert("Số điện thoại không hợp lệ!\nVui lòng nhập đúng 10 số, bắt đầu bằng số 0.");

    const blocks = document.querySelectorAll('.service-block');
    if (blocks.length === 0) return;

    for (let i = 0; i < blocks.length; i++) {
        const sName = blocks[i].querySelector('.service-select').value;
        if (!sName) return alert(`Bạn chưa chọn Loại dịch vụ ở khối thứ ${i + 1}!`);

        const inputs = blocks[i].querySelectorAll('.dynamic-input');
        for (let j = 0; j < inputs.length; j++) {
            const isRequired = inputs[j].getAttribute("data-required") === "true";
            if (isRequired && inputs[j].value.trim() === "") return alert(`Vui lòng điền đủ các thông tin bắt buộc cho dịch vụ "${sName}"!`);
        }
    }

    const submitBtn = document.getElementById('btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-70", "cursor-not-allowed");
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> ĐANG GHI NHẬN...';

    let dataToUpload = [];
    const orderId = Date.now().toString();

    blocks.forEach((block, index) => {
        const serviceName = block.querySelector('.service-select').value;
        let packageData = {
            orderId: orderId,
            phone: phone,
            network: document.getElementById('network').value,
            service: serviceName,
            ma_gioi_thieu: "", ten_goi: "", gia_tien: "", ghi_chu: "",
            gia_thu: index === 0 ? getRawNumber(document.getElementById('gia-thu').value) : "",
            method: index === 0 ? document.getElementById('method').value : "",
            profit: index === 0 ? getRawNumber(document.getElementById('profit').value) : "",
            staffId: CURRENT_STAFF
        };

        const inputs = block.querySelectorAll('.dynamic-input');
        inputs.forEach(input => {
            let val = input.value;
            if (input.hasAttribute('oninput')) val = getRawNumber(val);
            packageData[input.getAttribute("data-col")] = val;
        });
        dataToUpload.push(packageData);
    });

    let completed = 0;
    let totalToUpload = blocks.length;

    for (let dataObj of dataToUpload) {
        try {
            await callGoogleAPI('addData', { dataObj: dataObj });
            completed++;
            if (completed === totalToUpload) {
                addOrderToTable(dataToUpload, orderId, false);
                finishSubmit(submitBtn, originalText);
            }
        } catch (error) {
            alert("Có lỗi khi ghi nhận dữ liệu: " + error.message);
            finishSubmit(submitBtn, originalText);
            break;
        }
    }
}

function finishSubmit(btn, originalText) {
    btn.disabled = false;
    btn.classList.remove("opacity-70", "cursor-not-allowed");
    btn.innerHTML = originalText;
    document.getElementById('phone').value = "";
    document.getElementById('gia-thu').value = "";
    document.getElementById('profit').value = "";
    initForm();
}

function addOrderToTable(orderArray, orderId, isFromServer = false) {
    const tbody = document.getElementById("history-table");
    if (tbody.querySelector('.empty-msg')) tbody.innerHTML = "";

    let timeDisplay = "";
    let rawTimeStr = (isFromServer && orderArray[0].timeStr) ? orderArray[0].timeStr : null;

    // Chuyển đổi chuỗi thời gian từ Server hoặc lấy thời gian hiện tại
    let dateObj = rawTimeStr ? new Date(rawTimeStr) : new Date();

    // Kiểm tra xem đối tượng Date có hợp lệ không (convert thành công)
    if (!isNaN(dateObj.getTime())) {
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');

        // Định dạng lại theo đúng HTML mong muốn
        timeDisplay = `<div class="font-bold text-slate-700">${dd}/${mm}/${yyyy}</div><div class="text-[10px] text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> ${hh}:${min}</div>`;
    } else {
        // Fallback dự phòng nếu dữ liệu trên Sheets đang lưu dạng text cũ "DD/MM/YYYY HH:MM"
        if (rawTimeStr && rawTimeStr.includes(" ")) {
            let tParts = rawTimeStr.split(" ");
            timeDisplay = `<div class="font-bold text-slate-700">${tParts[0]}</div><div class="text-[10px] text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> ${tParts[1]}</div>`;
        } else {
            timeDisplay = rawTimeStr; // Hiển thị nguyên gốc nếu không nhận diện được
        }
    }

    let html = "";
    const rowSpan = orderArray.length;

    orderArray.forEach((data, index) => {
        let serviceStyle = "bg-blue-100 text-blue-700";
        if (data.service.includes("SIM")) serviceStyle = "bg-green-100 text-green-700";
        if (data.service.includes("NẠP")) serviceStyle = "bg-amber-100 text-amber-800";

        const methodStyle = data.method === "CHUYỂN KHOẢN" ? "bg-emerald-100 text-emerald-700" : (data.method === "TIỀN MẶT" ? "bg-slate-200 text-slate-700" : "");
        const isLastRow = index === orderArray.length - 1;

        let networkColorClass = "text-red-500";
        if (data.network === "VINAPHONE") networkColorClass = "text-blue-600";
        else if (data.network === "MOBIFONE") networkColorClass = "text-blue-800";
        else if (data.network === "VIETNAMOBILE") networkColorClass = "text-orange-500";

        const isDeleted = orderArray[0].isDeleted;
        const trClasses = isDeleted
            ? `order-row-${orderId} row-deleted`
            : `order-row-${orderId} hover:bg-slate-50 transition-colors`;

        const actionBtnHtml = isDeleted
            ? `<i class="fa-solid fa-ban text-slate-400"></i>`
            : `<button onclick="handleDeleteOrder('${orderId}')" class="text-slate-400 transition-colors bg-slate-50 w-8 h-8 rounded-lg flex items-center justify-center mx-auto hover:text-red-500 hover:bg-red-50 cursor-pointer" title="Hủy đơn hàng"><i class="fa-solid fa-trash-can text-sm"></i></button>`;

        html += `
    <tr class="${trClasses}">
        ${index === 0 ? `
        <td class="p-4 text-xs align-top bg-white border-b border-b-slate-200" rowspan="${rowSpan}">${timeDisplay}</td>
        <td class="p-4 align-top bg-white border-b border-b-slate-200" rowspan="${rowSpan}">
        <div class="font-bold text-slate-900 text-[13px]">${data.phone}</div>
        <div class="text-[10px] ${networkColorClass} font-bold tracking-widest mt-0.5">${data.network}</div>
        </td>
        ` : ''}
        
        <td class="p-4 bg-white border-b ${isLastRow ? 'border-b-slate-200' : 'border-b-slate-100'}">
        <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${serviceStyle}">${data.service}</span>
        </td>
        
        ${index === 0 ? `
        <td class="p-4 text-right font-bold text-slate-800 align-top bg-white border-b border-b-slate-200" rowspan="${rowSpan}">
        ${data.gia_thu ? Number(data.gia_thu).toLocaleString('vi-VN') : '-'}
        </td>
        <td class="p-4 text-right font-bold text-emerald-600 align-top bg-white border-b border-b-slate-200" rowspan="${rowSpan}">
        ${data.profit ? Number(data.profit).toLocaleString('vi-VN') : '-'}
        </td>
        <td class="p-4 text-center align-top bg-white border-b border-b-slate-200" rowspan="${rowSpan}">
        ${data.method ? `<span class="px-2.5 py-1 rounded-md text-[10px] font-bold ${methodStyle}">${data.method}</span>` : '-'}
        </td>
        <td class="p-4 text-center align-top bg-white border-b border-b-slate-200" rowspan="${rowSpan}">
        ${actionBtnHtml}
        </td>
        ` : ''}
    </tr>
    `;
    });

    tbody.insertAdjacentHTML('afterbegin', html);
}

async function handleDeleteOrder(orderId) {
    if (!confirm("Xác nhận hủy TOÀN BỘ đơn hàng này trên Google Sheets?")) return;

    const rows = document.querySelectorAll(`.order-row-${orderId}`);

    rows.forEach(row => {
        row.classList.add("row-deleted");
        const btn = row.querySelector('button');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-slate-400"></i>';
            btn.onclick = null;
        }
    });

    try {
        const success = await callGoogleAPI('deleteOrderInSheet', { orderId: orderId });
        if (success) {
            rows.forEach(row => {
                const btn = row.querySelector('.fa-spinner');
                if (btn) btn.parentElement.innerHTML = '<i class="fa-solid fa-ban text-slate-400"></i>';
            });
        } else {
            alert("Có lỗi xảy ra, không thể gạch ngang dữ liệu trên trang tính!");
        }
    } catch (error) {
        alert("Có lỗi kết nối khi xóa dữ liệu!");
    }
}
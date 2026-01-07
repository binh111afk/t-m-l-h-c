/* --- FILE: pldc.js (Dùng chung cho tất cả) --- */

let questionBank = [];

// 1. TẢI CÂU HỎI
async function loadQuestions() {
    try {
        // Đảm bảo đường dẫn file json đúng
        const response = await fetch('./question.json'); 
        questionBank = await response.json();
        
        // Gán ID để quản lý
        questionBank.forEach((q, index) => { q.id = index; });

        console.log("Đã tải xong database: " + questionBank.length + " câu.");
        
        // Bắt đầu vẽ giao diện
        renderQuiz();
        renderQuestionMap();
        
    } catch (error) {
        console.error("Lỗi:", error);
        alert("Lỗi tải dữ liệu! Hãy kiểm tra file question.json và chạy Live Server.");
    }
}

// Ma trận đề thi tổng hợp (50 câu)
const matrix = {
    1: { NB: 1, TH: 3, VD: 0 },
    2: { NB: 1, TH: 3, VD: 1 },
    3: { NB: 2, TH: 1, VD: 0 },
    4: { NB: 2, TH: 7, VD: 7 },
    5: { NB: 1, TH: 2, VD: 2 },
    6: { NB: 1, TH: 2, VD: 1 },
    7: { NB: 1, TH: 3, VD: 6 },
    8: { NB: 2, TH: 1, VD: 0 }
};

// Hàm trộn mảng
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- 2. LOGIC LẤY CÂU HỎI THÔNG MINH (ĐA NĂNG) ---
function getExamQuestions() {
    let examQuestions = [];
    
    // KIỂM TRA: File HTML hiện tại có yêu cầu chương cụ thể không?
    // (JS sẽ đọc thuộc tính data-chapter trong thẻ <body>)
    const specificChapter = document.body.getAttribute('data-chapter');

    if (specificChapter) {
        // === TRƯỜNG HỢP 1: LUYỆN TẬP RIÊNG CHƯƠNG ===
        const chapNum = parseInt(specificChapter);
        console.log(`>>> Chế độ: Luyện tập riêng Chương ${chapNum}`);

        // Lọc tất cả câu hỏi của chương đó
        let pool = questionBank.filter(q => (q.chapter == chapNum || q.c == chapNum));
        
        // Trộn và lấy 25 câu
        shuffle(pool);
        examQuestions = pool.slice(0, 25);
        
        // Sửa lại tiêu đề web cho phù hợp
        updateUIForChapterMode(chapNum, examQuestions.length);

    } else {
        // === TRƯỜNG HỢP 2: THI THỬ TỔNG HỢP (Mặc định) ===
        console.log(">>> Chế độ: Thi thử tổng hợp (Full Matrix)");
        
        // Logic lấy theo ma trận (như cũ)
        const lastExamIds = JSON.parse(localStorage.getItem('lastExamIds')) || [];
        
        for (let chap = 1; chap <= 8; chap++) {
            if (!matrix[chap]) continue; 
            ['NB', 'TH', 'VD'].forEach(level => {
                const countNeeded = matrix[chap][level];
                if (countNeeded > 0) {
                    const pool = questionBank.filter(q => 
                        (q.chapter == chap || q.c == chap) && 
                        (q.level == level || q.l == level)
                    );
                    if (pool.length > 0) {
                        const fresh = pool.filter(q => !lastExamIds.includes(q.id));
                        const used = pool.filter(q => lastExamIds.includes(q.id));
                        shuffle(fresh); shuffle(used);
                        
                        let slot = (fresh.length >= countNeeded) 
                            ? fresh.slice(0, countNeeded) 
                            : fresh.concat(used.slice(0, countNeeded - fresh.length));
                        examQuestions = examQuestions.concat(slot);
                    }
                }
            });
        }
        // Lưu lịch sử để lần sau đỡ trùng
        localStorage.setItem('lastExamIds', JSON.stringify(examQuestions.map(q => q.id)));
        shuffle(examQuestions);
    }

    return examQuestions;
}

// Hàm cập nhật giao diện khi ở chế độ luyện chương
function updateUIForChapterMode(chapNum, count) {
    // Đổi tiêu đề H1
    const h1 = document.querySelector('h1');
    if(h1) h1.innerHTML = `Luyện Tập Chương ${chapNum}`;

    // Đổi khung thông tin
    const infoBox = document.querySelector('.matrix-info');
    if(infoBox) {
        infoBox.innerHTML = `
            <div style="text-align: center;
    color: #d32f2f;
    text-shadow: 1px 1px 0px #ffd700;
    font-family: 'Dancing Script', cursive; font-size: 2em;">
                <h3>LUYỆN TẬP THEO CHƯƠNG: CHƯƠNG ${chapNum}</h3>
                <p>Số lượng: <b>${count} câu</b></p>
            </div>
        `;
    }
}


let currentExam = [];

function renderQuiz() {
    const quizArea = document.getElementById('quiz-area');
    quizArea.innerHTML = '';
    
    currentExam = getExamQuestions(); // Gọi hàm thông minh ở trên
    
    if (currentExam.length === 0) {
        quizArea.innerHTML = '<p style="text-align:center;">Không tìm thấy câu hỏi phù hợp!</p>';
        return;
    }

    currentExam.forEach((q, index) => {
        // Tạo thẻ câu hỏi
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `q-card-${index}`;

        // Chuẩn hóa dữ liệu
        const chap = q.chapter || q.c;
        const lv = q.level || q.l;
        const content = q.question || q.q;
        const opts = q.options || q.a;
        const explain = q.explanation || q.explain;
        const correct = (q.answer !== undefined) ? q.answer : q.correct;

        // Tạo các option
        let htmlOpts = '';
        opts.forEach((o, i) => {
            const letter = String.fromCharCode(65 + i);
            htmlOpts += `
                <label id="lbl-${index}-${i}">
                    <input type="radio" name="q-${index}" value="${i}" 
                           onchange="checkAnswer(${index}, ${i}, ${correct})">
                    <span class="btn-letter">${letter}</span>
                    <span class="answer-text">${o}</span>
                </label>
            `;
        });

        card.innerHTML = `
            <div>
                <span class="meta-badge badge-c">Chương ${chap}</span>
                <span class="meta-badge badge-l">${lv}</span>
            </div>
            <div class="question-title">Câu ${index + 1}: ${content}</div>
            <div class="options">${htmlOpts}</div>
            <div class="explanation" id="explain-${index}">
                <strong>Giải thích:</strong> ${explain}
            </div>
        `;
        quizArea.appendChild(card);
    });
}

// Hàm chấm điểm ngay lập tức (Instant Check)
function checkAnswer(idx, userPick, correctPick) {
    // Khóa câu hỏi
    const inputs = document.getElementsByName(`q-${idx}`);
    inputs.forEach(i => i.disabled = true);

    // Lấy label
    const userLbl = document.getElementById(`lbl-${idx}-${userPick}`);
    const correctLbl = document.getElementById(`lbl-${idx}-${correctPick}`);
    const explainDiv = document.getElementById(`explain-${idx}`);
    const mapItem = document.getElementById(`map-${idx}`);

    const userChar = String.fromCharCode(65 + userPick);
    const correctChar = String.fromCharCode(65 + correctPick);

    let msg = "";

    if (userPick === correctPick) {
        // ĐÚNG
        userLbl.classList.add('correct-answer');
        if(mapItem) mapItem.classList.add('correct');
        msg = `<div style="color:#155724; font-weight:bold; margin-bottom:5px;">✅ Bạn chọn: ${userChar} (Chính xác)</div>`;
    } else {
        // SAI
        userLbl.classList.add('wrong-answer');
        correctLbl.classList.add('correct-answer');
        if(mapItem) mapItem.classList.add('wrong');
        msg = `<div style="color:#721c24; font-weight:bold; margin-bottom:5px;">❌ Bạn chọn: ${userChar} | 👉 Đáp án: ${correctChar}</div>`;
    }

    // Hiện giải thích
    if(explainDiv) {
        explainDiv.innerHTML = msg + explainDiv.innerHTML;
        explainDiv.style.display = 'block';
    }
    
    // Update tiến độ
    updateProgress();
}

function updateProgress() {
    const done = document.querySelectorAll('input[type="radio"]:checked').length;
    const total = currentExam.length;
    const bar = document.getElementById('progress-bar');
    if(bar) bar.style.width = (done/total*100) + "%";
}

// Nộp bài
function submitQuiz() {
    let score = 0;
    let unAnswered = 0;
    
    currentExam.forEach((q, idx) => {
        const picked = document.querySelector(`input[name="q-${idx}"]:checked`);
        const correct = (q.answer !== undefined) ? q.answer : q.correct;
        
        // Nếu chưa làm thì hiện đáp án
        if (!picked) {
            unAnswered++;
            const correctLbl = document.getElementById(`lbl-${idx}-${correct}`);
            if(correctLbl) correctLbl.classList.add('correct-answer');
            
            const explainDiv = document.getElementById(`explain-${idx}`);
            if(explainDiv) {
                explainDiv.style.display = 'block';
                // Hiện text báo chưa làm
                if(!explainDiv.innerHTML.includes("Bạn chưa chọn")) {
                     const correctChar = String.fromCharCode(65 + correct);
                     explainDiv.innerHTML = `<div style="color:#856404; font-weight:bold;">⚠️ Bạn chưa chọn | 👉 Đáp án: ${correctChar}</div>` + explainDiv.innerHTML;
                }
            }
        } else {
            if(parseInt(picked.value) === correct) score++;
        }
        
        // Khóa tất cả input (phòng trường hợp sót)
        document.getElementsByName(`q-${idx}`).forEach(i => i.disabled = true);
    });

    // Hiện bảng điểm
    const resArea = document.getElementById('result-area');
    const scoreDiv = document.getElementById('score');
    resArea.style.display = 'block';
    scoreDiv.innerHTML = `Kết quả: <span style="color:red">${score}</span> / ${currentExam.length} câu đúng.`;
    
    document.getElementById('submit-btn').style.display = 'none';
    resArea.scrollIntoView({behavior: "smooth"});
}

// Vẽ Map câu hỏi
function renderQuestionMap() {
    const map = document.getElementById('map-grid');
    if(!map) return;
    map.innerHTML = '';
    currentExam.forEach((_, i) => {
        const a = document.createElement('a');
        a.className = 'map-item';
        a.id = `map-${i}`;
        a.innerText = i + 1;
        a.onclick = () => {
            document.getElementById(`q-card-${i}`).scrollIntoView({behavior:"smooth", block:"center"});
        };
        map.appendChild(a);
    });
}

// --- 4. POPUP & UTILS ---

function confirmSubmit() {
    const done = document.querySelectorAll('input[type="radio"]:checked').length;
    const total = currentExam.length;
    const left = total - done;
    let msg = left > 0 ? `⚠️ Còn <b>${left}</b> câu chưa làm!` : "Sẵn sàng nộp bài chưa?";
    showTetModal(msg, submitQuiz);
}

function confirmRestart() {
    showTetModal("Làm đề mới sẽ xóa kết quả hiện tại!", () => location.reload());
}

function showTetModal(msg, callback) {
    const m = document.getElementById('tet-modal');
    document.getElementById('modal-message').innerHTML = msg;
    m.style.display = 'flex';
    
    const btn = document.getElementById('btn-confirm-action');
    const newBtn = btn.cloneNode(true); // Xóa event cũ
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.onclick = () => { callback(); closeModal(); };
}

function closeModal() {
    document.getElementById('tet-modal').style.display = 'none';
}

const backToTopBtn = document.getElementById("btn-back-to-top");
window.onscroll = function() {
    if(backToTopBtn) backToTopBtn.style.display = (window.scrollY > 300) ? 'block' : 'none';
};
function scrollToTop() { window.scrollTo({top:0, behavior:'smooth'}); }

// Chặn chuột phải, F12
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = e => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 73)) return false; };

// Hoa rơi
document.addEventListener('DOMContentLoaded', () => {
    const imgs = ['./img/hoadao.png', './img/luckymoney.png'];
    setInterval(() => {
        const img = document.createElement('img');
        img.src = imgs[Math.floor(Math.random()*imgs.length)];
        img.className = 'falling-flower';
        img.style.left = Math.random()*100 + 'vw';
        img.style.width = (Math.random()*20 + 20) + 'px';
        img.style.animationDuration = (Math.random()*3 + 3) + 's';
        document.body.appendChild(img);
        setTimeout(() => img.remove(), 6000);
    }, 500);
});

// KHỞI CHẠY
loadQuestions();
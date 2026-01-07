let questionBank = [];

async function loadQuestions() {
    try {
        // Gọi file json
        const response = await fetch('./question.json');
        questionBank = await response.json();
        questionBank.forEach((q, index) => {
            q.id = index;
        });
        console.log("Đã tải xong " + questionBank.length + " câu hỏi.");
        renderQuiz();
        renderQuestionMap();
    } catch (error) {
        console.error("Lỗi không tải được câu hỏi:", error);
        alert("Lỗi: Không thể tải file questions.json. Hãy chắc chắn bạn đang chạy trên Live Server!");
    }
}

questionBank.forEach((q, index) => {
    q.id = index;
});

// Cấu trúc Matrix đề thi
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

// Hàm xáo trộn mảng (Shuffle)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Hàm lấy câu hỏi theo Matrix (ĐÃ SỬA LỖI LẶP & THỨ TỰ)
// Hàm lấy câu hỏi theo Matrix (Phiên bản chống trùng lặp)
function getExamQuestions() {
    let examQuestions = [];

    // 1. Lấy danh sách ID các câu hỏi đã thi lần trước từ LocalStorage
    const lastExamIds = JSON.parse(localStorage.getItem('lastExamIds')) || [];
    let currentExamIds = [];

    // 2. Duyệt qua từng chương và mức độ
    for (let chap = 1; chap <= 8; chap++) {
        ['NB', 'TH', 'VD'].forEach(level => {
            const countNeeded = matrix[chap][level];

            if (countNeeded > 0) {
                // Lọc tất cả câu hỏi thuộc chương và mức độ này
                const pool = questionBank.filter(q =>
                    (q.chapter == chap || q.c == chap) &&
                    (q.level == level || q.l == level)
                );

                if (pool.length > 0) {
                    // Tách thành 2 nhóm: 
                    // Nhóm A: Chưa thi lần trước (Ưu tiên)
                    // Nhóm B: Đã thi lần trước (Dự phòng)
                    const freshQuestions = pool.filter(q => !lastExamIds.includes(q.id));
                    const usedQuestions = pool.filter(q => lastExamIds.includes(q.id));

                    // Trộn ngẫu nhiên cả 2 nhóm
                    shuffle(freshQuestions);
                    shuffle(usedQuestions);

                    // Logic lấy câu hỏi: Lấy hết nhóm A, nếu thiếu thì lấy thêm từ nhóm B
                    let selectedForSlot = [];

                    if (freshQuestions.length >= countNeeded) {
                        // Nếu đủ câu mới thì lấy toàn bộ từ câu mới
                        selectedForSlot = freshQuestions.slice(0, countNeeded);
                    } else {
                        // Nếu thiếu, lấy hết câu mới + bù thêm câu cũ
                        selectedForSlot = freshQuestions.concat(usedQuestions.slice(0, countNeeded - freshQuestions.length));
                    }

                    examQuestions = examQuestions.concat(selectedForSlot);
                }
            }
        });
    }

    // 3. Lưu danh sách ID của đề thi hiện tại vào LocalStorage để dùng cho lần sau
    currentExamIds = examQuestions.map(q => q.id);
    localStorage.setItem('lastExamIds', JSON.stringify(currentExamIds));

    // 4. Trộn lại toàn bộ đề thi
    return shuffle(examQuestions);
}
// Render câu hỏi ra màn hình
let currentExam = [];

function renderQuiz() {
    const quizArea = document.getElementById('quiz-area');
    quizArea.innerHTML = '';

    // Lấy đề thi đã trộn
    currentExam = getExamQuestions();

    if (currentExam.length === 0) {
        quizArea.innerHTML = '<p style="text-align:center;">Chưa có dữ liệu câu hỏi. Vui lòng kiểm tra biến questionBank.</p>';
        return;
    }

    currentExam.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';

        // Chuẩn hóa dữ liệu từ 2 định dạng cũ/mới
        const chapVal = q.chapter || q.c;
        const levelVal = q.level || q.l;
        const questionText = q.question || q.q;
        const answers = q.options || q.a; // options (cũ) hoặc a (mới)
        const explainText = q.explanation || q.explain;
        const correctVal = (q.answer !== undefined) ? q.answer : q.correct;

        // Tạo HTML cho các đáp án
        let optionsHtml = '';
        answers.forEach((opt, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex);

            optionsHtml += `
                <label id="label-${index}-${optIndex}">
                <input type="radio" name="q${index}" value="${optIndex}" onchange="checkAnswer(${index}, ${optIndex}, ${correctVal})">
            
                <span class="btn-letter">${letter}</span>
            
                <span class="answer-text">${opt}</span>
                </label>
            `;
        });

        card.innerHTML = `
            <div>
                <span class="meta-badge badge-c">Chương ${chapVal}</span>
                <span class="meta-badge badge-l">${levelVal}</span>
            </div>
            <div class="question-title">Câu ${index + 1}: ${questionText}</div>
            <div class="options">${optionsHtml}</div>
            <div class="explanation" id="explain-${index}">
                <strong>Giải thích:</strong> ${explainText}
            </div>
        `;
        quizArea.appendChild(card);
    });
}

// Hàm kiểm tra đáp án NGAY LẬP TỨC (Chế độ luyện tập)
function checkAnswer(qIndex, selected, correct) {
    // 1. Khóa tất cả các lựa chọn của câu này lại (Không cho chọn lại)
    const allInputs = document.querySelectorAll(`input[name="q${qIndex}"]`);
    allInputs.forEach(input => input.disabled = true);

    // 2. Lấy các phần tử giao diện cần xử lý
    const selectedLabel = document.getElementById(`label-${qIndex}-${selected}`);
    const correctLabel = document.getElementById(`label-${qIndex}-${correct}`);
    const mapItem = document.getElementById(`map-item-${qIndex}`);
    const explainBox = document.getElementById(`explain-${qIndex}`);

    // 3. Chuẩn bị nội dung hiển thị
    const correctLetter = String.fromCharCode(65 + correct);
    const userLetter = String.fromCharCode(65 + selected);
    let resultText = '';

    // 4. Kiểm tra Đúng / Sai
    if (selected === correct) {
        // --- TRƯỜNG HỢP ĐÚNG ---
        // Tô xanh ô đáp án chọn
        selectedLabel.classList.add('correct-answer');

        // Cập nhật bảng câu hỏi trên đầu: Màu Xanh Lá
        if (mapItem) {
            mapItem.classList.remove('done'); // Xóa màu xanh dương cũ (nếu có)
            mapItem.classList.add('correct');
        }

        // Tạo thông báo
        resultText = `<div style="color: #155724; margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed #c3e6cb; padding-bottom: 5px;">
                        ✅ Bạn chọn: ${userLetter} (Chính xác)
                      </div>`;
    } else {
        // --- TRƯỜNG HỢP SAI ---
        // Tô đỏ ô chọn sai, tô xanh ô đúng
        selectedLabel.classList.add('wrong-answer');
        correctLabel.classList.add('correct-answer');

        // Cập nhật bảng câu hỏi trên đầu: Màu Đỏ
        if (mapItem) {
            mapItem.classList.remove('done');
            mapItem.classList.add('wrong');
        }

        // Tạo thông báo
        resultText = `<div style="margin-bottom: 8px; border-bottom: 1px dashed #f5c6cb; padding-bottom: 5px;">
                        <span style="color: #721c24; font-weight: bold;">❌ Bạn chọn: ${userLetter}</span> 
                        <span style="margin: 0 10px;">👉</span> 
                        <span style="color: #155724; font-weight: bold;">Đáp án đúng: ${correctLetter}</span>
                      </div>`;
    }

    // 5. Hiện khung giải thích ngay lập tức
    if (explainBox) {
        // Chèn kết quả vào đầu khung giải thích để người dùng thấy ngay
        explainBox.innerHTML = resultText + explainBox.innerHTML;
        explainBox.style.display = 'block';
        explainBox.style.animation = 'fadeIn 0.5s';
    }

    // 6. Cập nhật thanh tiến độ (Progress Bar)
    const answeredCount = document.querySelectorAll('input[type="radio"]:checked').length;
    const totalQuestions = currentExam.length;
    const percent = (answeredCount / totalQuestions) * 100;
    document.getElementById('progress-bar').style.width = percent + '%';
}
// Nộp bài (Tính điểm tổng)
// Hàm Nộp bài (Đã xóa dòng chặn đồng hồ)
function submitQuiz() {
    let score = 0;
    const total = currentExam.length;
    let unAnswered = 0;

    // Lặp qua từng câu hỏi
    currentExam.forEach((q, index) => {
        const correctVal = (q.answer !== undefined) ? q.answer : q.correct;
        const selectedInput = document.querySelector(`input[name="q${index}"]:checked`);
        const explainBox = document.getElementById(`explain-${index}`);

        const correctLetter = String.fromCharCode(65 + correctVal);
        let userLetter = '';
        let resultText = '';

        // 1. Khóa tất cả các nút lại
        const allInputs = document.querySelectorAll(`input[name="q${index}"]`);
        allInputs.forEach(input => input.disabled = true);

        // 2. Xử lý logic Đúng/Sai
        if (selectedInput) {
            const selectedVal = parseInt(selectedInput.value);
            userLetter = String.fromCharCode(65 + selectedVal);

            const selectedLabel = document.getElementById(`label-${index}-${selectedVal}`);
            const correctLabel = document.getElementById(`label-${index}-${correctVal}`);

            if (selectedVal === correctVal) {
                score++;
                if (selectedLabel) selectedLabel.classList.add('correct-answer');
                resultText = `<div style="color: #155724; margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed #c3e6cb; padding-bottom: 5px;">
                                ✅ Bạn chọn: ${userLetter} (Chính xác)
                              </div>`;
            } else {
                if (selectedLabel) selectedLabel.classList.add('wrong-answer');
                if (correctLabel) correctLabel.classList.add('correct-answer');
                resultText = `<div style="margin-bottom: 8px; border-bottom: 1px dashed #f5c6cb; padding-bottom: 5px;">
                                <span style="color: #721c24; font-weight: bold;">❌ Bạn chọn: ${userLetter}</span> 
                                <span style="margin: 0 10px;">✅</span> 
                                <span style="color: #155724; font-weight: bold;">Đáp án đúng: ${correctLetter}</span>
                              </div>`;
            }
        } else {
            unAnswered++;
            const correctLabel = document.getElementById(`label-${index}-${correctVal}`);
            if (correctLabel) correctLabel.classList.add('correct-answer');
            resultText = `<div style="margin-bottom: 8px; border-bottom: 1px dashed #ffeeba; padding-bottom: 5px;">
                            <span style="color: #856404; font-weight: bold;">⚠️ Bạn chưa chọn</span> 
                            <span style="margin: 0 10px;">✅</span> 
                            <span style="color: #155724; font-weight: bold;">Đáp án đúng: ${correctLetter}</span>
                          </div>`;
        }

        // 3. Hiện giải thích
        if (explainBox) {
            if (!explainBox.innerHTML.includes('Bạn chọn:')) {
                explainBox.innerHTML = resultText + explainBox.innerHTML;
            }
            explainBox.style.display = 'block';
            explainBox.style.animation = 'fadeIn 0.5s';
        }
    });

    // 4. Hiện bảng điểm
    const resultArea = document.getElementById('result-area');
    const scoreBoard = document.getElementById('score');

    resultArea.style.display = 'block';
    let msg = `Kết quả: <span style="color: #d32f2f; font-size: 1.2em;">${score}</span> / ${total} câu đúng.`;
    if (unAnswered > 0) msg += `<br><span style="font-size: 0.9em; color: #555;">(Bạn chưa làm ${unAnswered} câu)</span>`;

    scoreBoard.innerHTML = msg;
    document.getElementById('submit-btn').style.display = 'none';
    resultArea.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function () {
    const flowerImages = [
        './img/hoadao.png',
        './img/luckymoney.png'
    ];

    const spawnRate = 300; // Tốc độ tạo hoa (càng nhỏ hoa càng dày)

    function createFlower() {
        const flower = document.createElement('img');
        flower.src = flowerImages[Math.floor(Math.random() * flowerImages.length)];
        flower.classList.add('falling-flower');
        flower.style.left = (Math.random() * 110 - 10) + 'vw';
        const width = Math.random() * 30 + 20;
        flower.style.width = width + 'px';
        flower.style.height = 'auto';
        const duration = Math.random() * 5 + 4;
        flower.style.animationDuration = duration + 's';
        document.body.appendChild(flower);
        setTimeout(() => {
            flower.remove();
        }, duration * 1000);
    }

    setInterval(createFlower, spawnRate);
});

function renderQuestionMap() {
    const mapGrid = document.getElementById('map-grid');
    mapGrid.innerHTML = ''; // Reset

    currentExam.forEach((q, index) => {
        // Tạo ô số
        const item = document.createElement('a');
        item.className = 'map-item';
        item.id = `map-item-${index}`;
        item.innerText = index + 1;

        // Bấm vào thì cuộn đến câu đó
        item.onclick = function () {
            // Tìm thẻ câu hỏi tương ứng để cuộn tới
            // Lưu ý: Bạn cần thêm id="question-card-${index}" vào thẻ div .question-card trong hàm renderQuiz nhé!
            const card = document.querySelectorAll('.question-card')[index];
            if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        };

        mapGrid.appendChild(item);
    });
}

// Gọi hàm này ngay sau khi renderQuiz()
loadQuestions();

const backToTopBtn = document.getElementById("btn-back-to-top");

window.onscroll = function () {
    scrollFunction();
};

function scrollFunction() {
    // Khi cuộn xuống 300px thì hiện nút
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
        backToTopBtn.style.display = "block";
    } else {
        backToTopBtn.style.display = "none";
    }
}

// Hàm cuộn lên đầu trang mượt mà
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function showTetModal(message, actionCallback) {
    const modal = document.getElementById('tet-modal');
    const msgBox = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('btn-confirm-action');

    // Gán nội dung
    msgBox.innerHTML = message;
    modal.style.display = 'flex'; // Hiện popup

    // Gán hành động cho nút "Chốt đơn"
    confirmBtn.onclick = function () {
        actionCallback(); // Chạy hàm được truyền vào
        closeModal();     // Đóng popup
    };
}

// Hàm đóng Popup
function closeModal() {
    document.getElementById('tet-modal').style.display = 'none';
}

// --- SỬA LẠI CÁCH GỌI NÚT NỘP BÀI VÀ LÀM LẠI ---

// 1. Hàm xác nhận nộp bài (Gắn vào nút Nộp bài)
function confirmSubmit() {
    // Đếm số câu chưa làm để dọa nhẹ
    const answeredCount = document.querySelectorAll('input[type="radio"]:checked').length;
    const total = currentExam.length;
    const unAnswered = total - answeredCount;

    let msg = "Bạn có chắc chắn muốn nộp bài không?";
    if (unAnswered > 0) {
        msg = `⚠️ Bạn còn <b>${unAnswered}</b> câu chưa làm!<br>Nhanh cái tay lên!`;
    } else {
        msg = "Bạn đã làm hết các câu hỏi.<br>Bạn có muốn xem điểm không?";
    }

    // Gọi Popup Tết thay vì confirm mặc định
    showTetModal(msg, function () {
        submitQuiz(); // Nếu đồng ý thì mới chạy hàm nộp bài gốc
    });
}

// 2. Hàm xác nhận làm đề mới (Gắn vào nút Làm đề mới)
function confirmRestart() {
    showTetModal("Bạn muốn tạo đề thi mới?", function () {
        location.reload();
    });
}

document.addEventListener('contextmenu', event => event.preventDefault());

// Chặn phím F12 (Inspect)
document.onkeydown = function (e) {
    if (event.keyCode == 123) { // F12
        return false;
    }
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { // Ctrl+Shift+I
        return false;
    }
}
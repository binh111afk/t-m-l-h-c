class QuizManager {
    constructor() {
        this.questionBank = [];
        this.currentExam = [];
        this.questionInputs = {};
        this.examConfig = {
            totalChapterQuestions: 25,
            matrix: {
                1: { NB: 1, TH: 3, VD: 0 },
                2: { NB: 1, TH: 3, VD: 1 },
                3: { NB: 2, TH: 1, VD: 0 },
                4: { NB: 2, TH: 7, VD: 3 },
                5: { NB: 1, TH: 2, VD: 2 },
                6: { NB: 1, TH: 2, VD: 3 },
                7: { NB: 3, TH: 3, VD: 6 },
                8: { NB: 2, TH: 1, VD: 0 }
            }
        };
        
        // Bind methods để sử dụng trong event listeners
        this.handleAnswerChange = this.handleAnswerChange.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Giữ lại các hàm toàn cục để HTML gọi
        window.confirmSubmit = () => this.confirmSubmit();
        window.closeResultModal = () => this.closeResultModal();
        window.closeModal = () => this.closeModal();
        window.scrollToTop = () => this.scrollToTop();
    }

    // ==================== KHỞI TẠO ====================
    async init() {
        try {
            await this.loadQuestions();
            this.currentExam = this.getExamQuestions();
            this.renderQuiz();
            this.renderQuestionMap();
            this.setupEventListeners();
            this.setupAccessibility();
            this.setupSecurity();
        } catch (error) {
            this.showError(error);
        }
    }

    // ==================== TẢI DỮ LIỆU ====================
    async loadQuestions() {
        try {
            // Tạo một con số ngẫu nhiên dựa trên thời gian hiện tại
            const timestamp = new Date().getTime();
            
            // Gắn ?v=... vào sau đường dẫn để ép trình duyệt tải mới
            const response = await fetch(`./question.json?v=${timestamp}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Không thể tải file question.json`);
            }
            
            this.questionBank = await response.json();
            this.questionBank.forEach((q, index) => { 
                q.id = index; 
            });
            
            console.log(`Đã tải ${this.questionBank.length} câu hỏi (No-Cache Mode)`);
        } catch (error) {
            // Ném lỗi ra để hàm init() bắt được và hiển thị giao diện lỗi
            throw error;
        }
    }

    // ==================== LẤY ĐỀ THI ====================
    getExamQuestions() {
        const specificChapter = document.body.getAttribute('data-chapter');
        
        if (specificChapter) {
            return this.getChapterQuestions(parseInt(specificChapter));
        }
        
        return this.getFullExamQuestions();
    }

    // --- 1. SỬA HÀM LẤY CÂU HỎI THEO CHƯƠNG ---
    // ==================== LẤY CÂU HỎI (ĐÃ FIX LỖI TRỘN) ====================

    // 1. Hàm lấy câu hỏi theo chương
    getChapterQuestions(chapter) {
        console.log(`>>> Chế độ: Luyện tập riêng Chương ${chapter}`);
        
        let pool = this.questionBank.filter(q => 
            (q.chapter == chapter || q.c == chapter)
        );
        
        if (pool.length === 0) return [];
        
        // --- SỬA LỖI TẠI ĐÂY: Gán kết quả đã trộn vào biến pool ---
        pool = this.shuffle(pool); 
        
        // Bây giờ pool đã được xáo trộn, cắt lấy 25 câu
        const selected = pool.slice(0, this.examConfig.totalChapterQuestions);
        
        this.updateChapterUI(chapter, selected.length);
        this.updateHistory(selected);
        
        return selected;
    }

    // 2. Hàm lấy câu hỏi tổng hợp
    getFullExamQuestions() {
        console.log(">>> Chế độ: Thi thử tổng hợp");
        let examQuestions = [];
        
        for (let chapter = 1; chapter <= 8; chapter++) {
            if (!this.examConfig.matrix[chapter]) continue;
            
            for (const level of ['NB', 'TH', 'VD']) {
                const countNeeded = this.examConfig.matrix[chapter][level];
                if (countNeeded <= 0) continue;
                
                let pool = this.questionBank.filter(q =>
                    (q.chapter == chapter || q.c == chapter) &&
                    (q.level == level || q.l == level)
                );
                
                if (pool.length === 0) continue;
                
                // --- SỬA LỖI TẠI ĐÂY ---
                pool = this.shuffle(pool); // Trộn xong phải lưu lại vào pool
                const selected = pool.slice(0, countNeeded); // Lấy ngẫu nhiên
                
                examQuestions.push(...selected);
            }
        }
        
        // Trộn lần cuối danh sách đề thi tổng
        examQuestions = this.shuffle(examQuestions); // SỬA LỖI TẠI ĐÂY
        this.updateHistory(examQuestions);
        
        return examQuestions;
    }

    selectQuestionsFromPool(pool, history, count) {
        const fresh = pool.filter(q => !history.includes(q.id));
        const used = pool.filter(q => history.includes(q.id));
        
        this.shuffle(fresh);
        this.shuffle(used);
        
        if (fresh.length >= count) {
            return fresh.slice(0, count);
        }
        
        return fresh.concat(used.slice(0, count - fresh.length));
    }

    // ==================== QUẢN LÝ LỊCH SỬ ====================
    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('lastExamIds')) || [];
        } catch {
            return [];
        }
    }

    updateHistory(questions) {
        if (questions.length === 0) return;
        
        const newIds = questions.map(q => q.id);
        const currentHistory = this.getHistory();
        const updatedHistory = [...new Set([...currentHistory, ...newIds])];
        
        if (updatedHistory.length >= this.questionBank.length * 0.8) {
            console.log("Reset lịch sử để tránh lặp");
            localStorage.setItem('lastExamIds', JSON.stringify(newIds));
            return;
        }
        
        localStorage.setItem('lastExamIds', JSON.stringify(updatedHistory));
        console.log(`Lịch sử: ${updatedHistory.length}/${this.questionBank.length} câu`);
    }

    // ==================== RENDER GIAO DIỆN ====================
    renderQuiz() {
        const quizArea = document.getElementById('quiz-area');
        if (!quizArea) return;
        
        quizArea.innerHTML = '';
        
        if (this.currentExam.length === 0) {
            quizArea.innerHTML = '<p class="error-message">Không tìm thấy câu hỏi phù hợp!</p>';
            return;
        }
        
        this.currentExam.forEach((question, index) => {
            this.prepareQuestionData(question);
            const card = this.createQuestionCard(question, index);
            quizArea.appendChild(card);
        });
        
        this.updateProgress();
    }

    prepareQuestionData(question) {
        question.options = question.options || question.a || [];
        question.correctAnswer = question.answer !== undefined ? question.answer : question.correct;
        question.chapter = question.chapter || question.c;
        question.level = question.level || question.l;
        question.content = question.question || question.q;
        question.explanation = question.explanation || question.explain || '';
        
        const shuffled = this.shuffleAnswers(question.options, question.correctAnswer);
        question.options = shuffled.options;
        question.correctAnswer = shuffled.correctIndex;
    }

    shuffleAnswers(options, correctIndex) {
        const temp = options.map((text, index) => ({
            text,
            isCorrect: index === correctIndex
        }));
        
        this.shuffle(temp);
        
        const newOptions = temp.map(item => item.text);
        const newCorrectIndex = temp.findIndex(item => item.isCorrect);
        
        return { options: newOptions, correctIndex: newCorrectIndex };
    }

    createQuestionCard(question, index) {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `q-card-${index}`;
        card.dataset.questionIndex = index;
        
        const optionsHTML = question.options.map((opt, i) => `
            <label id="lbl-${index}-${i}">
                <input type="radio" name="q-${index}" value="${i}" 
                       data-question-index="${index}" 
                       data-option-index="${i}">
                <span class="btn-letter">${String.fromCharCode(65 + i)}</span>
                <span class="answer-text">${opt}</span>
            </label>
        `).join('');
        
        card.innerHTML = `
            <div class="question-header">
                <span class="meta-badge badge-c">Chương ${question.chapter}</span>
                <span class="meta-badge badge-l">${question.level}</span>
            </div>
            <div class="question-title">Câu ${index + 1}: ${question.content}</div>
            <div class="options">${optionsHTML}</div>
            <div class="explanation" id="explain-${index}">
                <strong>Giải thích:</strong> ${question.explanation}
            </div>
        `;
        
        this.questionInputs[index] = card.querySelectorAll(`input[name="q-${index}"]`);
        
        return card;
    }

    updateChapterUI(chapter, count) {
        const h1 = document.querySelector('h1');
        const infoBox = document.querySelector('.matrix-info');
        
        if (h1) h1.textContent = `Luyện Tập Chương ${chapter}`;
        
        if (infoBox) {
            infoBox.innerHTML = `
                <div class="chapter-info">
                    <h3>LUYỆN TẬP THEO CHƯƠNG: CHƯƠNG ${chapter}</h3>
                    <p>Số lượng: <b>${count} câu</b></p>
                </div>
            `;
        }
    }

    renderQuestionMap() {
        const map = document.getElementById('map-grid');
        if (!map) return;
        
        map.innerHTML = '';
        
        this.currentExam.forEach((_, index) => {
            const item = document.createElement('button');
            item.className = 'map-item';
            item.id = `map-${index}`;
            item.textContent = index + 1;
            item.setAttribute('aria-label', `Nhảy tới câu ${index + 1}`);
            item.dataset.questionIndex = index;
            
            item.addEventListener('click', () => {
                this.scrollToQuestion(index);
            });
            
            map.appendChild(item);
        });
    }

    // ==================== EVENT HANDLERS ====================
    handleAnswerChange(event) {
        const target = event.target;
        
        if (target.matches('input[type="radio"]')) {
            const questionIndex = parseInt(target.dataset.questionIndex);
            const optionIndex = parseInt(target.dataset.optionIndex);
            
            if (!isNaN(questionIndex) && !isNaN(optionIndex)) {
                this.checkAnswer(questionIndex, optionIndex);
            }
        }
    }

    handleScroll() {
        const backToTopBtn = document.getElementById("btn-back-to-top");
        if (backToTopBtn) {
            backToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
        }
    }

    handleKeyDown(event) {
        // Chặn DevTools
        if (event.keyCode === 123 || 
            (event.ctrlKey && event.shiftKey && event.keyCode === 73) ||
            (event.ctrlKey && event.shiftKey && event.keyCode === 74) ||
            (event.ctrlKey && event.keyCode === 85)) {
            event.preventDefault();
            return false;
        }
        
        // Esc để đóng modal
        if (event.key === 'Escape') {
            this.closeModal();
            this.closeResultModal();
        }
    }

    // ==================== XỬ LÝ TRẢ LỜI ====================
    checkAnswer(index, userPick) {
        const question = this.currentExam[index];
        const correctPick = question.correctAnswer;
        
        this.disableQuestion(index);
        this.showAnswerFeedback(index, userPick, correctPick);
        this.updateProgress();
        this.updateQuestionMap(index, userPick === correctPick);
    }

    disableQuestion(index) {
        if (this.questionInputs[index]) {
            this.questionInputs[index].forEach(input => {
                input.disabled = true;
                input.parentElement.style.cursor = 'default';
            });
        }
    }

    showAnswerFeedback(index, userPick, correctPick) {
        const userLabel = document.getElementById(`lbl-${index}-${userPick}`);
        const correctLabel = document.getElementById(`lbl-${index}-${correctPick}`);
        const explainDiv = document.getElementById(`explain-${index}`);
        
        if (!userLabel || !correctLabel || !explainDiv) return;
        
        const userChar = String.fromCharCode(65 + userPick);
        const correctChar = String.fromCharCode(65 + correctPick);
        
        let message = '';
        
        if (userPick === correctPick) {
            userLabel.classList.add('correct-answer');
            message = `<div class="feedback-correct">✅ Bạn chọn: ${userChar} (Chính xác)</div>`;
        } else {
            userLabel.classList.add('wrong-answer');
            correctLabel.classList.add('correct-answer');
            message = `<div class="feedback-wrong">❌ Bạn chọn: ${userChar} | 👉 Đáp án: ${correctChar}</div>`;
        }
        
        explainDiv.innerHTML = message + explainDiv.innerHTML;
        explainDiv.style.display = 'block';
    }

    updateQuestionMap(index, isCorrect) {
        const mapItem = document.getElementById(`map-${index}`);
        if (mapItem) {
            mapItem.classList.add(isCorrect ? 'correct' : 'wrong');
        }
    }

    updateProgress() {
        const done = document.querySelectorAll('input[type="radio"]:checked').length;
        const total = this.currentExam.length;
        const bar = document.getElementById('progress-bar');
        
        if (bar) {
            bar.style.width = `${(done / total) * 100}%`;
            bar.setAttribute('aria-valuenow', done);
            bar.setAttribute('aria-valuemax', total);
        }
    }

    // ==================== NỘP BÀI ====================
    confirmSubmit() {
        const done = document.querySelectorAll('input[type="radio"]:checked').length;
        const total = this.currentExam.length;
        const left = total - done;
        
        let message = left > 0 
            ? `⚠️ Bạn còn <b>${left}</b> câu chưa làm! <br> 😏 Không biết thì chọn đại đi fen 😏`
            : "Có chắc muốn nộp bài không fen?";
        
        this.showConfirmation(message, () => this.submitQuiz());
    }

    submitQuiz() {
        if (this.currentExam.length === 0) return;
        
        let score = 0;
        let unanswered = 0;
        
        this.currentExam.forEach((question, index) => {
            const picked = document.querySelector(`input[name="q-${index}"]:checked`);
            const correctAnswer = question.correctAnswer;
            
            if (!picked) {
                unanswered++;
                this.showUnansweredAnswer(index, correctAnswer);
            } else if (parseInt(picked.value) === correctAnswer) {
                score++;
            }
            
            this.disableQuestion(index);
        });
        
        this.hideSubmitButton();
        this.showResult(score, this.currentExam.length, unanswered);
    }

    showUnansweredAnswer(index, correctAnswer) {
        const correctLabel = document.getElementById(`lbl-${index}-${correctAnswer}`);
        const explainDiv = document.getElementById(`explain-${index}`);
        
        if (!correctLabel || !explainDiv) return;
        
        // 1. Highlight đáp án đúng trên giao diện
        correctLabel.classList.add('correct-answer');
        
        // 2. Lấy dữ liệu gốc từ bộ đề (để tránh lỗi nối chuỗi lung tung)
        const questionData = this.currentExam[index];
        const correctChar = String.fromCharCode(65 + correctAnswer);
        
        // 3. Viết lại nội dung giải thích (Bao gồm cảnh báo + Nội dung gốc)
        explainDiv.innerHTML = `
            <div class="feedback-unanswered">
                ⚠️ Chưa làm | 👉 Đáp án: ${correctChar}
            </div>
            <div style="margin-top: 5px;">
                <strong>Giải thích:</strong> ${questionData.explanation || "Không có giải thích chi tiết cho câu này."}
            </div>
        `;
        
        // 4. QUAN TRỌNG: Bắt buộc hiện khung giải thích
        explainDiv.style.display = 'block';
        
        // 5. Thêm hiệu ứng rung nhẹ để người dùng chú ý
        explainDiv.style.animation = 'fadeIn 0.5s ease';
    }

    hideSubmitButton() {
        const btn = document.getElementById('submit-btn');
        if (btn) btn.style.display = 'none';
        
        // Hiện nút làm đề mới
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.style.display = 'block';
    }

    showResult(score, total, unanswered) {
        const modal = document.getElementById('result-modal');
        const scoreEl = document.getElementById('popup-score');
        const totalEl = document.getElementById('popup-total');
        const msgEl = document.getElementById('popup-message');
        
        if (!modal || !scoreEl || !totalEl || !msgEl) return;
        
        scoreEl.textContent = score;
        totalEl.textContent = total;
        
        const percent = (score / total) * 100;
        msgEl.textContent = this.getResultMessage(percent);
        
        modal.style.display = 'flex';
        
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 500);
    }

    getResultMessage(percent) {
        if (percent === 100) return "😏 Chưa tài đâu";
        if (percent >= 80) return "Cũng tạm tạm 🧧";
        if (percent >= 50) return "Non vê lờ ! Học lại đi bé! 😅";
        return "Học hành gì mà không trên trung bình nổi nữa trời!";
    }

    confirmRestart() {
        this.showConfirmation("Làm đề mới sẽ xóa kết quả hiện tại!", () => {
            location.reload();
        });
    }

    // ==================== MODAL FUNCTIONS ====================
    showConfirmation(message, callback) {
        const modal = document.getElementById('tet-modal');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('btn-confirm-action');
        
        if (!modal || !messageEl || !confirmBtn) return;
        
        messageEl.innerHTML = message;
        modal.style.display = 'flex';
        
        // Xóa event cũ và gắn event mới
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        
        newBtn.onclick = () => {
            callback();
            this.closeModal();
        };
    }

    closeModal() {
        const modal = document.getElementById('tet-modal');
        if (modal) modal.style.display = 'none';
    }

    closeResultModal() {
        const modal = document.getElementById('result-modal');
        if (modal) modal.style.display = 'none';
    }

    // ==================== UTILITIES ====================
    shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    scrollToQuestion(index) {
        const element = document.getElementById(`q-card-${index}`);
        if (element) {
            element.scrollIntoView({ 
                behavior: "smooth", 
                block: "center" 
            });
            element.classList.add('highlighted');
            setTimeout(() => element.classList.remove('highlighted'), 2000);
        }
    }

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==================== SETUP ====================
    setupEventListeners() {
        // Event Delegation cho việc chọn đáp án
        const quizArea = document.getElementById('quiz-area');
        if (quizArea) {
            quizArea.addEventListener('change', this.handleAnswerChange);
        }
        
        // Scroll event
        window.addEventListener('scroll', this.handleScroll);
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Hoa rơi
        this.setupFallingFlowers();
        
        // Nút làm đề mới (xử lý riêng vì HTML đang dùng onclick="location.reload()")
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            // Giữ lại onclick từ HTML (location.reload())
            // Không cần thêm event listener khác
        }
    }

    setupAccessibility() {
        // Thêm role và aria attributes
        const quizArea = document.getElementById('quiz-area');
        if (quizArea) {
            quizArea.setAttribute('role', 'region');
            quizArea.setAttribute('aria-label', 'Khu vực làm bài trắc nghiệm');
        }
    }

    setupSecurity() {
        // 1. Chặn chuột phải
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showToast('🚫 Không được nhấn chuột phải để xài Dev tools đâu pé ơi!', 'warning');
        });
    }

    setupFallingFlowers() {
        const imgs = ['./img/hoadao.png', './img/luckymoney.png'];
        let lastTime = 0;
        
        const createFlower = (timestamp) => {
            if (timestamp - lastTime > 500) {
                lastTime = timestamp;
                
                const img = document.createElement('img');
                img.src = imgs[Math.floor(Math.random() * imgs.length)];
                img.className = 'falling-flower';
                img.alt = 'Hoa rơi trang trí';
                img.style.left = `${Math.random() * 100}vw`;
                img.style.width = `${Math.random() * 20 + 20}px`;
                img.style.animationDuration = `${Math.random() * 3 + 3}s`;
                
                document.body.appendChild(img);
                
                setTimeout(() => {
                    if (img.parentNode) {
                        img.parentNode.removeChild(img);
                    }
                }, 6000);
            }
            
            requestAnimationFrame(createFlower);
        };
        
        requestAnimationFrame(createFlower);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    showError(error) {
        console.error("Lỗi:", error);
        
        const errorHTML = `
            <div class="error-container">
                <h2>⚠️ Lỗi tải dữ liệu</h2>
                <p>${error.message}</p>
                <button class="retry-btn" onclick="location.reload()">
                    Thử lại
                </button>
                <p><small>Kiểm tra file question.json và chạy Live Server</small></p>
            </div>
        `;
        
        const quizArea = document.getElementById('quiz-area');
        if (quizArea) {
            quizArea.innerHTML = errorHTML;
        } else {
            document.body.innerHTML = errorHTML;
        }
    }

    // ==================== CLEANUP ====================
    destroy() {
        // Dọn dẹp event listeners
        const quizArea = document.getElementById('quiz-area');
        if (quizArea) {
            quizArea.removeEventListener('change', this.handleAnswerChange);
        }
        
        window.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Dọn dẹp các falling flowers
        const flowers = document.querySelectorAll('.falling-flower');
        flowers.forEach(flower => {
            if (flower.parentNode) {
                flower.parentNode.removeChild(flower);
            }
        });
        
        // Xóa các hàm toàn cục
        delete window.confirmSubmit;
        delete window.closeResultModal;
        delete window.closeModal;
        delete window.scrollToTop;
    }
}

// ==================== KHỞI CHẠY ====================
// Tạo instance và gán vào biến toàn cục
const myApp = new QuizManager();

// Khởi động khi DOM sẵn sàng
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("Khởi động QuizManager...");
        myApp.init();
    });
} else {
    console.log("DOM đã sẵn sàng, khởi động QuizManager...");
    myApp.init();
}

// Export ra window để có thể debug từ console
window.myApp = myApp;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_EXTRACTION") {
        console.log("popup.js로부터 분석 요청을 받음 - 스크립트 주입 시작");
        injectScript();
        sendResponse({ status: "스크립트 주입 및 내용 추출 시작" });
    }
    return true;
});

function injectScript() {
    // script 요소 생성
    const scriptElement = document.createElement("script");

    // 인라인 댜신 익스텐션 내부 파일 URL 주입해버리자
    scriptElement.src = chrome.runtime.getURL("inject.js");

    // 스크립트 실행 됐겠지? 그럼 깔끔하게 시행된 스크립트는 지워버리자
    scriptElement.onload = function () {
        this.remove();
    };

    (document.head || document.documentElement).appendChild(scriptElement);
}

let chatHistory = [];
let isRecording = false;

// 전송 버튼 클릭 이벤트
async function sendButtonEvent() {
    const textInput = document.getElementById("chat-input").value;
    let audioBase64 = null;
    let sttText = "";

    if (textInput.trim() === "" && !isRecording) {
        alert("입력된 텍스트가 없거나 마이크가 켜져있지 않습니다.");
        return;
    }

    if (isRecording) {
        [sttText, audioBase64] = await stopRecording();
    } else {
        sttText = textInput;
    }

    chatHistory.push({ role: "user", content: sttText });

    const requestBody = {
        messages: chatHistory,
        audio_b64: audioBase64,
    };

    try {
        showReviewUI();
        appendMessageToUI("user", sttText);
        const loadingBubble = appendMessageToUI("assistant", "Kanana-o가 코드를 분석하고 있습니다...\n잠시만 기다려주세요!");

        const response = await fetch("http://localhost:8000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (result.status === "success") {
            loadingBubble.innerHTML = parseMarkdownToHTML(result.review);
            chatHistory.push({ role: "assistant", content: result.review });
        } else {
            loadingBubble.innerHTML = parseMarkdownToHTML(result.message);
            chatHistory.push({ role: "assistant", content: result.message });
        }
    } catch (error) {
        console.error(error);
        alert(
            "서버와 통신하는 데 실패했습니다. 파이썬 서버가 켜져 있는지 확인해주세요.",
        );
    }
}

window.addEventListener("message", async (event) => {
    // 우리가 보낸 특정 타입의 메시지만 걸러서 받음
    if (
        event.source === window &&
        event.data.type === "KANANA_EXTRACTED_DATA"
    ) {
        console.log(
            "✅ content.js가 데이터를 성공적으로 넘겨받았습니다:",
            event.data.code,
        );

        // TODO: 여기서 백그라운드 스크립트(서버 통신용)로 데이터를 넘겨주게 됨
        try {
            showReviewUI();
            appendMessageToUI("user", event.data.code);
            const loadingBubble = appendMessageToUI("assistant", "Kanana-o가 코드를 분석하고 있습니다...\n잠시만 기다려주세요!");

            chatHistory.push({
                role: "user",
                content: event.data.code,
            });

            const response = await fetch("http://localhost:8000/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ messages: chatHistory }),
            });

            const result = await response.json();
            if (result.status === "success") {
                loadingBubble.innerHTML = parseMarkdownToHTML(result.review);
                chatHistory.push({ role: "assistant", content: result.review });
            } else {
                loadingBubble.innerHTML = parseMarkdownToHTML(result.message);
                chatHistory.push({
                    role: "assistant",
                    content: result.message,
                });
            }
            // console.log("응답 성공: ", result);
            // alert("서버 통신 성공");
        } catch (error) {
            console.error(error);
            alert(
                "서버와 통신하는 데 실패했습니다. 파이썬 서버가 켜져 있는지 확인해주세요.",
            );
        }
    }
});

function parseMarkdownToHTML(text) {
    const codeBlocks = [];

    // 1. 코드 블록 숨기기 (멀티라인 대응 및 언어 태그 추출)
    // 패턴: ```(언어)?\n(코드내용)```
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push({ lang, code: code.trim() });
        return `__CODE_BLOCK_${index}__`;
    });

    // 2. 헤더 파싱 (큰 것부터 파싱하는 것이 안전함)
    html = html.replace(
        /^# (.+)$/gm,
        '<h1 style="margin: 20px 0 10px 0; color: #ff2d92;">$1</h1>',
    );
    html = html.replace(
        /^## (.+)$/gm,
        '<h2 style="margin: 18px 0 8px 0; color: #ff2d92;">$2</h2>',
    );
    html = html.replace(
        /^### (.+)$/gm,
        '<h3 style="margin: 15px 0 5px 0; color: #ff2d92;">$3</h3>',
    );

    // 3. 인라인 코드 변환
    html = html.replace(
        /`([^`]+)`/g,
        '<code style="background-color: #fff0f5; color: #ff2d92; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>',
    );

    // 4. 코드 블록 복구
    html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
        const { lang, code } = codeBlocks[index];
        // HTML 특수문자 이스케이프 (보안 및 렌더링 오류 방지)
        const escapedCode = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return `<pre data-lang="${lang}" style="background-color: #f0f0f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; border: 1px solid #e0e0e0; margin: 10px 0;"><code>${escapedCode}</code></pre>`;
    });

    return html;
}

// startRecording()에서 세팅하고, stopRecording()에서 사용
let mediaRecorder = null; // MediaRecorder 인스턴스
let recognition = null; // SpeechRecognition 인스턴스
let micStream = null; // 마이크 하드웨어 스트림 (나중에 꺼야 함!)
let audioChunks = []; // 녹음 데이터 조각들

// 녹음 버튼을 눌렀을 때 (시작만!)
// 마이크 권한을 얻고
// MediaRecorder.start() + Recognition.start()
// 여기선 Promise 필요 없음! 그냥 시작만 하면 됨
async function startRecording() {
    // 1. 마이크 접근 권한 요청 & 스트림 획득
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 2. MediaRecorder 세팅 & 녹음 시작
    mediaRecorder = new MediaRecorder(micStream);
    audioChunks = []; // 이전 녹음 데이터 초기화

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.start();
    console.log("녹음 시작!");

    // 3. STT(음성→텍스트) 인식도 동시에 시작
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.start();
    console.log("STT 인식 시작!");
}

// 전송/종료 버튼을 눌렀을 때
// mediaRecorder.stop() + recognition.stop() 실행
// Promise.all로 [STT텍스트, 오디오Base64] 둘 다 기다림
// 마이크 스트림(빨간 불) 해제!
function stopRecording() {
    // STT 텍스트를 Promise로 받기
    const sttPromise = new Promise((resolve, reject) => {
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            resolve(transcript);
        };

        recognition.onerror = (error) => {
            reject(error);
        };

        // STT 중지 → onresult 또는 onerror 콜백이 호출됨
        recognition.onend = () => {
            resolve("");
        };
        recognition.stop();
    });

    // 오디오 Base64를 Promise로 받기
    const audioPromise = new Promise((resolve, reject) => {
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

            // Blob → Base64 변환 (FileReader 활용)
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                resolve(reader.result.split(",")[1]); // base64 문자열 반환!
            };
            reader.onerror = (err) => {
                reject(err);
            };
        };

        // 녹음 중지 → onstop 콜백이 호출됨
        mediaRecorder.stop();
    });

    // 마이크 하드웨어 스트림 해제 (빨간 불 꺼짐!)
    if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        micStream = null;
        console.log("마이크 스트림 해제 완료!");
    }

    // 두 무기를 동시에 기다려서 [sttText, audioBase64] 배열로 반환
    return Promise.all([sttPromise, audioPromise]);
}

// 사용 예시 (나중에 버튼 이벤트에 연결):
// 녹음 버튼 클릭 → await startRecording();
// 전송 버튼 클릭 → const [sttText, audioBase64] = await stopRecording();

let reviewBox = null;

function showReviewUI() {
    if (reviewBox) {
        // 이미 패널이 띄워져 있으면 내용만 갈아끼우기
        // document.getElementById("kanana-review-text").innerHTML =
        //     parseMarkdownToHTML(text);
        return;
    }

    // 새로운 HTML 패널(div) 만들기
    reviewBox = document.createElement("div");
    reviewBox.id = "kanana-review-panel";

    const header = document.createElement("div");
    header.className = "kanana-header";
    header.innerHTML = "<span>Kanana-o 코드 리뷰</span>";

    // 닫기 버튼 (X)
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "kanana-close-btn";
    closeBtn.onclick = () => {
        reviewBox.remove();
        reviewBox = null;
    };
    header.appendChild(closeBtn);

    // 리뷰 텍스트가 들어갈 본문 영역
    const content = document.createElement("div");
    content.id = "kanana-review-text";
    // content.innerHTML = parseMarkdownToHTML(text);

    // 입력 창을 담을 컨테이너
    const inputContainer = document.createElement("div");
    inputContainer.className = "kanana-input-container";
    inputContainer.style.display = "flex";

    const chatInput = document.createElement("textarea");
    chatInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            await sendButtonEvent();
            chatInput.value = "";
        }
    });

    chatInput.id = "chat-input";
    chatInput.type = "text";
    chatInput.placeholder = "Kanana-o에게 추가로 질문해 보세요!";
    chatInput.style.flex = "1";

    // 마이크 버튼 (button)
    const micBtn = document.createElement("button");
    micBtn.id = "mic-btn";
    micBtn.innerText = "🎙️";

    // 전송 버튼 (button)
    const sendBtn = document.createElement("button");
    sendBtn.id = "send-btn";
    sendBtn.innerText = "전송";

    // 마이크 버튼 클릭 이벤트
    micBtn.addEventListener("click", async () => {
        // TODO 1:
        // 만약 지금 녹음 중이 아니라면? -> isRecording을 true로 바꾸고 startRecording() 실행!
        // 마이크 버튼 색상을 빨간색으로 바꿔서 사용자에게 녹음 중임을 알리면 좋겠지?

        if (!isRecording) {
            isRecording = true;
            await startRecording();

            micBtn.style.backgroundColor = "#ff0000";
        }
    });

    // 전송 버튼 클릭 이벤트
    sendBtn.addEventListener("click", async () => {
        await sendButtonEvent();
        chatInput.value = "";
        isRecording = false;
        micBtn.style.backgroundColor = "#4CAF50";
    });

    inputContainer.appendChild(chatInput);
    inputContainer.appendChild(micBtn);
    inputContainer.appendChild(sendBtn);

    // 이제 이거를 Body에 붙입시다
    reviewBox.appendChild(header);
    reviewBox.appendChild(content);
    reviewBox.appendChild(inputContainer);
    document.body.appendChild(reviewBox);
}

// function updateReviewUI(text) {
//     if (reviewBox) {
//         document.getElementById("kanana-review-text").innerHTML =
//             parseMarkdownToHTML(text);
//     } else {
//         showReviewUI(text);
//     }

//     updateReviewUI(text);
// }

function appendMessageToUI(role, text) {
    // 1. 카톡방 배경(컨테이너) 찾기
    const chatBox = document.getElementById("kanana-review-text");
    if (!chatBox) return; // 패널이 안 열려있으면 무시

    // 2. 새로운 말풍선(div) 만들기
    const bubble = document.createElement("div");

    // 3. 역할(user vs assistant)에 따라 말풍선 디자인 다르게 하기
    if (role === "user") {
        // 유저 질문은 오른쪽 정렬, 다른 배경색
        bubble.style.backgroundColor = "#f9f9f9"; // 연한 파란색
        bubble.style.margin = "10px 0 10px auto"; // 오른쪽으로 밀기
        bubble.style.padding = "10px";
        bubble.style.borderRadius = "10px";
        bubble.style.maxWidth = "80%";
    } else {
        // AI 답변은 왼쪽 정렬, 기본 배경색
        bubble.style.backgroundColor = "#ffb8d8";
        bubble.style.margin = "10px auto 10px 0";
        bubble.style.padding = "10px";
        bubble.style.borderRadius = "10px";
        bubble.style.maxWidth = "80%";
    }

    // 4. 파싱된 마크다운 텍스트를 말풍선 안에 넣기
    bubble.innerHTML = parseMarkdownToHTML(text);

    // 5. 카톡방 배경에 말풍선 이어 붙이기 (핵심!)
    chatBox.appendChild(bubble);

    // 6. 스크롤을 맨 아래로 자동으로 내려주기 (UX 디테일)
    chatBox.scrollTop = chatBox.scrollHeight;

    return bubble;
}
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
            showReviewUI(
                "Kanana-o가 코드를 분석하고 있습니다...\n잠시만 기다려주세요!",
            );

            const response = await fetch("http://localhost:8000/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ code: event.data.code }),
            });

            const result = await response.json();
            if (result.status === "success") {
                updateReviewUI(result.review);
            } else {
                updateReviewUI(
                    "서버에서 에러가 발생했습니다:\n" + result.message,
                );
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

let reviewBox = null;

function showReviewUI(text) {
    if (reviewBox) {
        // 이미 패널이 띄워져 있으면 내용만 갈아끼우기
        document.getElementById("kanana-review-text").innerHTML =
            parseMarkdownToHTML(text);
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

    // 6. 리뷰 텍스트가 들어갈 본문 영역
    const content = document.createElement("div");
    content.id = "kanana-review-text";
    content.innerHTML = parseMarkdownToHTML(text);

    // 이제 이거를 Body에 붙입시다
    reviewBox.appendChild(header);
    reviewBox.appendChild(content);
    document.body.appendChild(reviewBox);
}

function updateReviewUI(text) {
    if (reviewBox) {
        document.getElementById("kanana-review-text").innerHTML =
            parseMarkdownToHTML(text);
    } else {
        showReviewUI(text);
    }
}

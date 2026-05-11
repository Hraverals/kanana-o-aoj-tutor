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
            const response = await fetch("http://localhost:8000/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ code: event.data.code }),
            });

            const result = await response.json();
            console.log("응답 성공: ", result);
            // alert("서버 통신 성공");
        } catch (error) {
            console.error(error);
            alert(
                "서버와 통신하는 데 실패했습니다. 파이썬 서버가 켜져 있는지 확인해주세요.",
            );
        }
    }
});

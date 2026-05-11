console.log("Kanana-o 봇: Main World 스크립트 주입 및 실행 성공!");

function extractANDSendData() {
    // 1. 문제, 입력, 출력 데이터 파싱
    const problemNode = document.querySelector(".px-5.space-y-6");
    const problemText = problemNode
        ? problemNode.innerText
        : "문제 지문을 찾지 못했습니다.";

    // 2. 시간 제한, 메모리 제한 파싱
    const limitsNode = document.querySelector(".mt-4");
    const limitsText = limitsNode
        ? limitsNode.innerText
        : "제한 사항을 찾지 못했습니다.";

    // 3. 작성 중인 에디터 코드 파싱
    let editorCode = "코드 못 찾음 ㅜㅜ";
    try {
        if (window.monaco && window.monaco.editor.getModels().length > 0) {
            editorCode = window.monaco.editor.getModels()[0].getValue();
            console.log(
                "✅ window.monaco 전역 객체에서 코드를 성공적으로 추출했습니다.",
            );
        } else {
            // 차선책 -> 위에 문제 정보 가져오듯이 돔 스크래핑
            const codeLines = document.querySelectorAll(".view-line");
            if (codeLines.length > 0) {
                editorCode = Array.from(codeLines)
                    .map((line) => line.innerText)
                    .join("\n");
                console.log(
                    "⚠️ DOM 스크래핑(.view-line)을 통해 코드를 추출했습니다.",
                );
            }
        }
    } catch (e) {
        console.error("코드 추출 중 에러:", e);
    }

    const finalExtractedData = `
[제한 사항]
${limitsText}

[문제 내용]
${problemText}

[현재 작성 중인 코드]
${editorCode}
`;

    window.postMessage(
        {
            type: "KANANA_EXTRACTED_DATA",
            code: finalExtractedData,
        },
        "*",
    );
}

function waitForMonacoAndExtract(maxRetries = 10, intervalMs = 500) {
    const currentUrl = window.location.href;

    // 문제 페이지에서만 작동하도록 하자

    if (!currentUrl.includes("/problems/")) {
        console.warn("이곳은 문제 풀이 페이지가 아닙니다! (URL 불일치)");
        alert("Kanana-o 봇은 '문제 풀이 페이지'에서만 동작합니다!");
        return; // 즉시 종료
    }

    let attempts = 0;

    const interval = setInterval(() => {
        attempts++;

        if (window.monaco && window.monaco.editor.getModels().length > 0) {
            clearInterval(interval);
            extractANDSendData();
        } else if (attempts >= maxRetries) {
            clearInterval(interval);
            console.warn("로드 시간 초과함 -> 현재 상태로 강제 추출 시도");
            extractANDSendData();
        }
    }, intervalMs);
}

waitForMonacoAndExtract();

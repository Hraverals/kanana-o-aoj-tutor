document.getElementById("analyzeBtn").addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // 탭 찾아서 아래 코드 작동
    if (tab) {
        chrome.tabs.sendMessage(
            tab.id,
            { action: "START_EXTRACTION" },
            (response) => {
                console.log("content.js에서 받은 응답:", response);
            },
        );
    }

    document.getElementById("analyzeBtn").innerText = "분석 중...";
});

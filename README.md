# Kanana-o AOJ 코딩 튜터

> 충남대학교 컴퓨터인공지능학부 알고리즘 동아리 [ANA](https://anacnu.kr)의 부원들을 위한 AI 코드 리뷰 크롬 확장 프로그램입니다.

본 프로젝트는 카카오의 국내 최초 통합 멀티모달 AI 모델인 Kanana-o를 활용해보기 위해 구현한 코드 리뷰 크롬 확장 프로그램입니다. 이 프로젝트를 개발할 수 있었던 이유는 제가 Kanana-o의 베타 테스터에 선정되었기 때문입니다. ~~야호!! 키카오 선생님들 감사합니다 . . .~~ 
<br>
[AOJ (ANA Online Judge)](https://aoj.anacnu.kr)에서 문제를 풀 때, 작성 중인 코드를 **Kanana-o**가 분석하여 실시간 코드 리뷰를 제공합니다.  
시스템 프롬프트를 통해 사용자에게 정답을 직접 알려주지 않고, 논리적 힌트와 개선 방향만을 제시하게 하여 사용자의 학습 효과를 극대화하고자 했습니다.
<br>
처음에는 BOJ 에디터에서 사용할 수 있도록 계획하였으나, BOJ 서비스 종료 후 이 개발을 시작하게 되어 저희 동아리의 자체 OJ인 AOJ에서 API의 멀티모달 기능을 활용해보는 방향으로 구현했습니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| **코드 자동 추출** | AOJ 문제 페이지의 Monaco 에디터에서 작성 중인 코드를 자동으로 가져옵니다 |
| **문제 지문 파싱** | DOM 스크래핑을 통해 문제 내용, 입출력 형식, 시간/메모리 제한 사항을 함께 수집합니다 |
| **AI 코드 리뷰** | Kanana-o 모델이 코드의 논리 오류, 시간복잡도 문제 등을 분석합니다 |
| **힌트 기반 피드백** | 정답 코드를 제공하지 않고, 핵심 아이디어와 수정 방향만 안내합니다 |

## 프로젝트 구조

```
kanana/
├── extension/                # 프론트엔드
│   ├── manifest.json         # 익스텐션 설정 (Manifest V3)
│   ├── popup.html            # 팝업 UI
│   ├── popup.js              # 팝업 이벤트 핸들러
│   ├── styles.css            # 팝업 스타일
│   ├── content.js            # Content Script (데이터 중계, 서버 통신, UI 구현)
│   ├── content-style.css     # 코드 리뷰 패널 스타일
│   ├── inject.js             # Script Injection (DOM 접근 후 내용 추출 + Monaco 에디터 접근)
│   └── icons/                # 익스텐션 아이콘
│
├── server/                   # 백엔드
│   ├── main.py               # FastAPI 서버 구축 및 API 엔드포인트, Kanana-o 호출 로직 구현
│   ├── requirements.txt      # Python 의존성 목록
│   └── .env                  # API 키
│
├── testcode/                 # Kanana-o API 테스트 코드
│   ├── resText.py            # 텍스트 출력 테스트
│   └── resAudio.py           # 오디오 출력 테스트
│
└── .gitignore
```

## 동작 흐름
1. 사용자가 AOJ 문제 페이지에서 익스텐션 팝업의 [코드 분석 요청하기] 버튼을 클릭합니다.

2. popup.js에서 content.js로 "START_EXTRACTION" 메시지를 전송합니다.

3. content.js에서 inject.js를 통해 스크립트를 주입하여, 문제 지문과 제한사항을 DOM에서 파싱하고, Monaco 에디터의 내용을 추출합니다.

4. inject.js에서 content.js로 window.postMessage를 전달합니다.

5. content.js가 로컬의 FastAPI 서버로 POST 요청을 전송합니다.

6. main.py가 Kanana-o API를 호출하여 코드 리뷰를 생성합니다.

7. 리뷰 결과를 AOJ 페이지 내 확장 프로그램 패널에 마크다운 형식으로 출력합니다.

## 시작하기

### 사전 요구사항

- **Python** 3.9+
- **Google Chrome** 브라우저
- **Kanana-o API Key** (카카오클라우드)
- 그 외에는 그냥 `requirements.txt` 파일에 있는거 다운받고 그대로 실행하면 됩니다.

### 1. 서버 설정

```bash
# 의존성 설치
pip install -r server/requirements.txt
```

### 2. 환경변수 설정

`server/.env` 파일을 생성하고 API 키를 입력합니다.

```env
KANANA_API_KEY=your_kanana_api_key_here
```

### 3. 서버 실행

```bash
uvicorn server.main:app --reload
```

서버가 `http://localhost:8000`에서 실행됩니다.

### 4. 크롬 익스텐션 설치

1. Chrome에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `extension/` 폴더 선택

### 5. 사용하기

1. [AOJ](https://aoj.anacnu.kr)에서 아무 문제 페이지로 이동합니다.
2. 코드를 작성한 뒤, 우측 상단 익스텐션 아이콘을 클릭합니다.
3. **코드 분석 요청하기** 버튼을 클릭합니다.
4. 잠시 기다리면 페이지 우측 하단에 코드 리뷰 패널이 표시됩니다.

## 기술 스택

### 프론트엔드

| 기술 | 용도 |
|---|---|
| **Chrome Extensions Manifest V3** | 익스텐션 프레임워크 |
| **Vanilla JS** | 팝업 / Content Script / Inject Script |
| **CSS** | 팝업 & 리뷰 패널 스타일링 |

### 백엔드

| 기술 | 용도 |
|---|---|
| **FastAPI** | 비동기 웹 프레임워크 |
| **Uvicorn** | ASGI 서버 |
| **OpenAI SDK** | Kanana-o API 통신 (AsyncOpenAI) |
| **Pydantic** | 요청 데이터 검증 |
| **python-dotenv** | 환경변수 관리 |

### AI 모델

| 모델 | 설명 |
|---|---|
| **Kanana-o** | 카카오클라우드 제공 멀티모달 AI 모델 (베타 버전) |

import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from openai import AsyncOpenAI

load_dotenv()

app = FastAPI()

# 크롬 브라우저는 외부에서 오는 데이터를 해킹으로 간주하고 막아버림
# 따라서 일단 익스텐션에서 보내는 데이터를 받고 테스트하기 위해, 모든 출처허용합시다.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 나중에는 우리 익스텐션 ID만 넣자
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, PUT 등 모든 통신 방식 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# async 클라이언트 세팅 -> 여러 요청 동시처리를 위함
KANANA_API_KEY = os.getenv("KANANA_API_KEY")
client = AsyncOpenAI(
    base_url="https://kanana-o.a2s-endpoint.kr-central-2.kakaocloud.com/v1",
    api_key=KANANA_API_KEY
)

# JSON 데이터를 파이썬 클래스로 정의합시다
# 이렇게 해두면 데이터에 'code'라는 글자가 없거나, 숫자가 들어오면 FastAPI가 알아서 에러를 튕겨넴
class AnalyzeRequest(BaseModel):
    code: str 
    # 프론트에서 'code'라는 키(Key)에 문자열(str)을 담아 보낼 예정

@app.post("/analyze")
async def analyze_code(request_data: AnalyzeRequest):
    print("익스텐션으로부터 데이터를 받았습니다. Kanana-o 분석을 시작합니다.")
    
    """
    # 테스트를 해보자
    print("익스텐션으로부터 받은 데이터")
    print("=" * 50)
    print(request_data.code)
    print("=" * 50)

    # json 형식으로 body
    return {
        "status": "success", 
        "message": "서버가 데이터를 성공적으로 수신했습니다."
    }
    """

    system_prompt = (
        "너는 충남대 알고리즘 동아리 'ANA'의 스터디원들을 돕는 깐깐하지만 친절한 시니어 개발자 멘토야. "
        "사용자가 작성한 코드와 문제 지문을 분석해서 코드 리뷰를 진행해 줘. "
        "단, 학습을 위해 다음 [절대 규칙]을 반드시 지켜야 해.\n\n"
        "[절대 규칙]\n"
        "1. 완성된 정답 코드를 절대 직접 작성해서 주지 마.\n"
        "2. 수정해야 할 부분의 논리적 이유('왜 이렇게 고쳐야 하는지')와 핵심 아이디어만 글로 설명해.\n"
        "3. 만약 코드를 예시로 보여줘야 한다면, 1~2줄짜리 아주 짧은 의사코드(Pseudo-code)나 일부 스니펫만 사용해.\n"
        "4. 시간 초과(O(N^2) 등)나 메모리 누수 위험이 있다면 시간복잡도/공간복잡도 개념을 들어 설명해 줘."
    )

    user_prompt = f"다음 문제 정보와 내가 작성한 코드를 보고 리뷰해줘:\n\n{request_data.code}"

    try:
        # 명세서대로 작성해보자
        response = await client.chat.completions.create(
            model="kanana-o",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": user_prompt
                        }
                    ]
                }
            ],
            temperature=0.7
        )

        review_result = response.choices[0].message.content
        print("분석 완료! 프론트엔드로 결과를 반환합니다.")
        print(review_result)

        return {
            "status": "success", 
            "review": review_result
        }
    
    except Exception as e:
        print(f"API 호출 에러: {e}")
        return {
            "status": "error",
            "message": "AI 분석 중 오류가 발생했습니다."
        }
    
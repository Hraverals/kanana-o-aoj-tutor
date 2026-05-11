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
        "너는 알고리즘 스터디원을 돕는 훌륭한 선배 개발자 멘토야. "
        "사용자가 작성한 코드와 문제 지문을 분석해서, 정답을 직접 알려주기보다는 "
        "어떤 부분에서 메모리 누수나 시간 초과가 발생할 수 있는지, "
        "로직의 오류가 있는지 예리하고 친절하게 힌트를 줘."
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
    
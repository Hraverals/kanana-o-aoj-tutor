import os
import base64
import wave
import io
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Optional

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

SAMPLE_RATE = 24000

# JSON 데이터를 파이썬 클래스로 정의합시다

# 사용자는 카나나에게 텍스트 또는 오디오로 입력을 준다
# 들어온 오디오는 STT를 사용해 클라이언트에서 텍스트로 저장해두고, 카나나에게는 오디오를 보낸다
# 들어온 텍스트는 클라이언트에 그대로 저장해두고 카나나에게 텍스트 그대로 보낸다
# 카나나는 오디오 또는 텍스트로 된 현재의 입력과 텍스트로 된 과거 대화를 대화 맥락에 대한 입력으로 받는다
# 카나나가 이를 해석하여 오디오와 텍스트로 응답을 준다
# 클라이언트는 오디오와 텍스트 둘 다로 카나나의 응답을 확인한다.

class ChatMessage(BaseModel):
    role: str
    content: str

class AnalyzeRequest(BaseModel):
    messages: List[ChatMessage]

    audio_b64: Optional[str] = None
    # 마이크를 쓸 수도 있고, 안 쓸 수도 있음

@app.post("/analyze")
async def analyze_code(request_data: AnalyzeRequest):
    print("익스텐션으로부터 데이터를 받았습니다. Kanana-o 분석을 시작합니다.")
    
    kanana_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in request_data.messages
    ]

    system_prompt = (
        "너는 충남대 알고리즘 동아리 'ANA'의 스터디원들을 돕는 깐깐하지만 친절한 시니어 개발자 멘토야. "
        "사용자가 작성한 코드와 문제 지문을 분석해서 코드 리뷰를 진행해 줘. "
        "단, 학습을 위해 다음 [절대 규칙]을 반드시 지켜야 해.\n\n"
        "[절대 규칙]\n"
        "1. 완성된 정답 코드를 절대 직접 작성해서 주지 마.\n"
        "2. 수정해야 할 부분의 논리적 이유('왜 이렇게 고쳐야 하는지')와 핵심 아이디어만 글로 설명해.\n"
        "3. 만약 코드를 예시로 보여줘야 한다면, 백틱을 활용한 1~2줄짜리 아주 짧은 의사코드(Pseudo-code)나 일부 스니펫만 사용해.\n"
        "4. 시간 초과(O(N^2) 등)나 메모리 누수 위험이 있다면 시간복잡도/공간복잡도 개념을 들어 설명해 줘."
        "5. 만약 코드를 예시로 보여줘야해서 코드 블록을 작성할 때는 반드시 ```language 형식을 사용하고, 코드 블록 내부에는 HTML 특수 문자(<, > 등)가 포함될 수 있으니 주의해줘. 인라인 코드는 반드시 백틱 한 개로 감싸줘."
    )

    # user_prompt = f"다음 문제 정보와 내가 작성한 코드를 보고 리뷰해줘:\n\n{request_data.code}"
    # 첫 대화가 되는 코드 리뷰 요청에 대한 유저 프롬프트는 클라이언트에서 작성할 예정

    kanana_messages.insert(0, {
        "role": "system", 
        "content": system_prompt
    })

    # 오디오 입력이 있으면 멀티모달 요청, 없으면 텍스트만
    if request_data.audio_b64:
        last_user_message = kanana_messages[-1]
        original_text = last_user_message["content"]
        last_user_message["content"] = [
            {"type": "text", "text": original_text},
            {"type": "input_audio", "input_audio": {"data": request_data.audio_b64, "format": "wav"}}
        ]
        modalities = ["text", "audio"]
    else:
        modalities = ["text"]

    try:
        if request_data.audio_b64:
            # 오디오 입력 -> 스트리밍으로 호출하여 오디오 청크 수집
            response = await client.chat.completions.create(
                model="kanana-o",
                messages=kanana_messages,
                modalities=modalities,
                temperature=0.7,
                stream=True
            )

            text_content = ""
            audio_pcm_chunks = []

            async for chunk in response:
                raw = chunk.model_dump()
                choices = raw.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}

                # 텍스트 수집
                content = delta.get("content")
                if isinstance(content, str) and content:
                    if not text_content:
                        text_content = content
                    else:
                        # kanana-o 모델은 delta에 새 토큰이 아닌 누적된 텍스트 전체가 올 수 있음
                        if len(content) >= len(text_content) and content.startswith(text_content[:10]):
                            text_content = content
                        elif text_content.startswith(content):
                            # 동일한 완성 텍스트가 반복해서 오는 경우 무시
                            pass
                        else:
                            # 만약 일반적인 delta(새 토큰만) 방식이라면
                            text_content += content

                # 오디오 수집
                audio = delta.get("audio")
                if audio is None:
                    continue

                audio_b64_data = None
                if isinstance(audio, str):
                    audio_b64_data = audio
                elif isinstance(audio, dict):
                    audio_b64_data = audio.get("data") or audio.get("audio")

                if isinstance(audio_b64_data, str) and audio_b64_data:
                    pcm = base64.b64decode(audio_b64_data, validate=True)
                    if pcm:
                        audio_pcm_chunks.append(pcm)

            # PCM 청크들을 하나의 WAV 파일로 합치기
            response_audio_b64 = None
            if audio_pcm_chunks:
                all_pcm = b"".join(audio_pcm_chunks)
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(SAMPLE_RATE)
                    wf.writeframes(all_pcm)
                response_audio_b64 = base64.b64encode(wav_buffer.getvalue()).decode("utf-8")

            print("분석 완료! (오디오+텍스트) 프론트엔드로 결과를 반환합니다.")
            print(text_content)

            return {
                "status": "success",
                "review": text_content,
                "audio_b64": response_audio_b64
            }
        else:
            # 텍스트 입력 -> 비스트리밍, 텍스트만 응답
            response = await client.chat.completions.create(
                model="kanana-o",
                messages=kanana_messages,
                modalities=modalities,
                temperature=0.7
            )

            review_result = response.choices[0].message.content
            print("분석 완료! (텍스트) 프론트엔드로 결과를 반환합니다.")
            print(review_result)

            return {
                "status": "success",
                "review": review_result,
                "audio_b64": None
            }

    except Exception as e:
        print(f"API 호출 에러: {e}")
        return {
            "status": "error",
            "message": "AI 분석 중 오류가 발생했습니다.",
            "audio_b64": None
        }

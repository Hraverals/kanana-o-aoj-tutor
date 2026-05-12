import base64

from openai import OpenAI

# client 에서는 입력 받아올 endpoint 랑 API key 만 지정해줌
client = OpenAI(
    base_url="https://kanana-o.a2s-endpoint.kr-central-2.kakaocloud.com/v1",
    api_key="[ENCRYPTION_KEY]"
)

# 파일을 base64로 변환해서 넘겨줘야함
def b64_of_file(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

# Image understanding
image_b64 = b64_of_file("choonsick.jpg")

# res 받기
response = client.chat.completions.create(
    model="kanana-o",
    # message 에 보낼 데이터 형식 지정해서, 웹에서 json으로 body 보내듯이 쏴주면 됨
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": image_b64}},
                {"type": "text", "text": "What is in this image?"}
            ]
        }
    ],
)

print(response.choices[0].message.content)
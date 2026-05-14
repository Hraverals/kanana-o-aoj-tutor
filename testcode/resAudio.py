import base64

from openai import OpenAI
import os
from dotenv import load_dotenv
load_dotenv()

KANANA_API_KEY = os.getenv("KANANA_KEY")

client = OpenAI(
    base_url="https://kanana-o.a2s-endpoint.kr-central-2.kakaocloud.com/v1",
    api_key=KANANA_API_KEY
)

def b64_of_file(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

image_b64 = b64_of_file("choonsick.jpg")
audio_b64 = b64_of_file("instruction.wav")
response = client.chat.completions.create(
    model="kanana-o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": image_b64}},
                {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "wav"}},
            ]
        }
    ],
    modalities=["text", "audio"],
    stream=True,
)

import os
import wave

SAMPLE_RATE = 24000
os.makedirs("result", exist_ok=True)

text_content = ""
out_wavs = []
cnt = 0

for chunk in response:
    raw = chunk.model_dump()
    choices = raw.get("choices") or []
    if not choices:
        continue
    delta = choices[0].get("delta") or {}

    content = delta.get("content")
    if isinstance(content, str) and content:
        print(content, end="", flush=True)
        text_content += content

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
            out = f"result/{cnt:04d}_chunk.wav"
            cnt += 1
            with wave.open(out, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(pcm)
            out_wavs.append(out)
            print(f"\nsaved {out}", flush=True)

print(f"Saved {cnt} audio chunk(s) under result/")

if out_wavs:
    all_frames = b""
    for f in out_wavs:
        with wave.open(f, "rb") as wf:
            all_frames += wf.readframes(wf.getnframes())
    with wave.open("result/result.wav", "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(all_frames)
    print("merged -> result/result.wav")
else:
    print("No audio in response")
import base64
import json
import urllib.request
import os

mermaid_code = """flowchart LR
    subgraph USERS ["Utilisateurs"]
        A["Candidat\n(Soumet sa candidature)"]
        B["Comite\n(Decision humaine finale)"]
    end

    subgraph APP ["Interface et Orchestration"]
        UI["Tableau de bord Web\n(React / Vite)"]
        API["FastAPI et n8n\n(Orchestration & API)"]
        UI <--> API
    end

    subgraph PIPELINE ["Pipeline d Evaluation IA"]
        direction TB
        P1["1. Audit Multimodal\n(OCR du CV & Transcription video)"]
        P2["2. Verification RAG\n(Regles du corpus Yale)"]
        P3["3. Revue Multi-Agents\n(3 Evaluateurs + President)"]
        P1 --> P2 --> P3
    end

    subgraph SERVICES ["IA et Stockage"]
        LLM["Groq AI Cloud\n(LLM, Vision & Whisper)"]
        DB[("Stockage\n(Corpus & Documents)")]
    end

    A --> UI
    UI --> B
    API <--> PIPELINE
    PIPELINE -.-> SERVICES

    classDef users fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef app fill:#ede9fe,stroke:#7c3aed,stroke-width:2px;
    classDef pipe fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef srv fill:#fef3c7,stroke:#d97706,stroke-width:2px;

    class A,B users;
    class UI,API app;
    class P1,P2,P3 pipe;
    class LLM,DB srv;
"""

payload = {
    "code": mermaid_code,
    "mermaid": {
        "theme": "default",
        "themeVariables": {
            "fontSize": "15px",
            "fontFamily": "Inter, system-ui, sans-serif"
        }
    }
}

json_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
encoded = base64.urlsafe_b64encode(json_bytes).decode("ascii")

url = f"https://mermaid.ink/img/{encoded}?type=png"

# Use os.path.join to avoid path issues
output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "architecture_overview.png")

print(f"Export vers: {output_path}")
req = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
)

with urllib.request.urlopen(req, timeout=20) as response:
    content = response.read()

with open(output_path, "wb") as f:
    f.write(content)

print(f"Succes! PNG exporte ({len(content)} octets)")

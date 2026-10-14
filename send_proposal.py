"""
Proposal Submitter for n8n Webhook
Sends a proposal payload to trigger the n8n workflow.
Usage:
    python send_proposal.py [proposal_id]
Default:
    python send_proposal.py PROP-01-EXCELLENT
"""

import sys
import os
import json
import requests

def submit(proposal_name="PROP-01-EXCELLENT"):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    proposals_dir = os.path.join(base_dir, "data", "synthetic_proposals")

    filename = proposal_name if proposal_name.endswith(".json") else f"{proposal_name}.json"
    file_path = os.path.join(proposals_dir, filename)

    if not os.path.exists(file_path):
        # Search for closest match
        matches = [f for f in os.listdir(proposals_dir) if proposal_name.lower() in f.lower() and f.endswith(".json")]
        if matches:
            file_path = os.path.join(proposals_dir, matches[0])
        else:
            print(f"Error: Proposal file not found: {file_path}")
            return

    with open(file_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    print(f"[*] Submitting proposal: [{payload['id']}] '{payload['title']}'")
    print(f"[*] Target n8n Webhook: http://localhost:5678/webhook-test/submit-proposal")

    try:
        # First try test webhook URL (used when clicking 'Test Step' in n8n canvas)
        test_url = "http://localhost:5678/webhook-test/submit-proposal"
        res = requests.post(test_url, json=payload, timeout=15)
        print(f"[+] Success! Status {res.status_code}")
        try:
            print("[+] Pipeline Output:")
            print(json.dumps(res.json(), indent=2))
        except Exception:
            print(res.text)
    except requests.exceptions.Timeout:
        print("[!] Request timed out. Ensure backend API is responding on http://127.0.0.1:8000")
    except requests.exceptions.ConnectionError:
        print("[!] Could not connect to n8n webhook. Make sure the workflow is actively listening in n8n!")

if __name__ == "__main__":
    p_name = sys.argv[1] if len(sys.argv) > 1 else "PROP-01-EXCELLENT"
    submit(p_name)

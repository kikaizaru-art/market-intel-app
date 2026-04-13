"""
Google Trends データ取得スクリプト
Node.js から child_process 経由で呼び出される

Usage: python fetch_trends.py '["kw1","kw2"]' JP

429 (Too Many Requests) 対策:
  - リトライ間隔を長めに設定
  - 最大3回リトライ
"""

import json
import sys
import os
import time

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

from pytrends.request import TrendReq

keywords = json.loads(sys.argv[1])
geo = sys.argv[2]

MAX_RETRIES = 3
RETRY_DELAYS = [30, 60, 120]  # 秒

for attempt in range(MAX_RETRIES):
    try:
        pytrends = TrendReq(hl="ja-JP", tz=-540, retries=2, backoff_factor=1)
        pytrends.build_payload(keywords, cat=0, timeframe="today 3-m", geo=geo)
        df = pytrends.interest_over_time()

        if df.empty:
            print(json.dumps([]))
        else:
            df = df.drop(columns=["isPartial"], errors="ignore")
            df.index = df.index.strftime("%Y-%m-%d")
            rows = [
                {"date": date, **{k: int(v) for k, v in row.items()}}
                for date, row in df.to_dict("index").items()
            ]
            print(json.dumps(rows, ensure_ascii=False))
        sys.exit(0)

    except Exception as e:
        if "429" in str(e) and attempt < MAX_RETRIES - 1:
            delay = RETRY_DELAYS[attempt]
            print(f"[trends] 429 rate limited, waiting {delay}s... (attempt {attempt + 1}/{MAX_RETRIES})", file=sys.stderr)
            time.sleep(delay)
        else:
            raise

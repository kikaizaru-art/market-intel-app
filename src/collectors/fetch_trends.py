"""
Google Trends データ取得スクリプト
Node.js から child_process 経由で呼び出される

Usage: python fetch_trends.py '["kw1","kw2"]' JP
"""

import json
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

from pytrends.request import TrendReq

keywords = json.loads(sys.argv[1])
geo = sys.argv[2]

pytrends = TrendReq(hl="ja-JP", tz=-540)
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

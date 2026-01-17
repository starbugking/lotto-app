#!/usr/bin/env python3
import requests
import json
from datetime import datetime

API_URL = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={}"

def load_data():
    with open("lotto-data.json", 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open("lotto-data.json", 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fetch_lotto(round_num):
    try:
        res = requests.get(API_URL.format(round_num), timeout=10)
        data = res.json()
        if data.get('returnValue') == 'success':
            return {
                'round': data['drwNo'],
                'numbers': sorted([data[f'drwtNo{i}'] for i in range(1, 7)]),
                'bonus': data['bnusNo'],
                'date': data['drwNoDate']
            }
    except:
        pass
    return None

def main():
    json_data = load_data()
    latest = json_data['latestRound']
    current = (datetime.now() - datetime(2002, 12, 7)).days // 7 + 1
    
    new_data = []
    for r in range(latest + 1, current + 1):
        data = fetch_lotto(r)
        if data:
            new_data.append(data)
            print(f"{r}회: {data['numbers']}")
        else:
            break
    
    if new_data:
        new_data.sort(key=lambda x: x['round'], reverse=True)
        json_data['data'] = new_data + json_data['data']
        json_data['latestRound'] = new_data[0]['round']
        json_data['lastUpdate'] = datetime.now().strftime('%Y-%m-%d')
        save_data(json_data)
        print(f"✅ {len(new_data)}개 업데이트!")
    else:
        print("📭 새 데이터 없음")

if __name__ == '__main__':
    main()

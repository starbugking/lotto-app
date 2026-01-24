#!/usr/bin/env python3
import requests
import json
import re
from datetime import datetime
from bs4 import BeautifulSoup

# 네이버 검색 URL
NAVER_URL = "https://search.naver.com/search.naver?query=로또+당첨번호"

# 동행복권 API (백업)
API_URL = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={}"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def load_data():
    with open("lotto-data.json", 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open("lotto-data.json", 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fetch_from_naver():
    """네이버 검색에서 최신 로또 번호 가져오기"""
    try:
        print("네이버에서 로또 번호 가져오는 중...")
        res = requests.get(NAVER_URL, headers=HEADERS, timeout=15)
        print(f"  응답 코드: {res.status_code}")
        
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 회차 번호 찾기
        round_elem = soup.select_one('.lotto_result_title strong')
        if not round_elem:
            # 다른 선택자 시도
            round_text = soup.find(string=re.compile(r'\d+회'))
            if round_text:
                round_match = re.search(r'(\d+)회', round_text)
                if round_match:
                    round_num = int(round_match.group(1))
            else:
                print("  회차 정보를 찾을 수 없음")
                return None
        else:
            round_num = int(re.search(r'(\d+)', round_elem.text).group(1))
        
        print(f"  회차: {round_num}")
        
        # 당첨 번호 찾기 (여러 선택자 시도)
        numbers = []
        
        # 방법 1: span.ball 클래스
        balls = soup.select('.ball')
        if balls:
            for ball in balls[:6]:
                num = int(ball.text.strip())
                numbers.append(num)
        
        # 방법 2: num_box 클래스
        if not numbers:
            num_box = soup.select('.num_box .num')
            for num in num_box[:6]:
                numbers.append(int(num.text.strip()))
        
        # 방법 3: 정규식으로 찾기
        if not numbers:
            text = res.text
            pattern = r'당첨번호.*?(\d+).*?(\d+).*?(\d+).*?(\d+).*?(\d+).*?(\d+)'
            match = re.search(pattern, text, re.DOTALL)
            if match:
                numbers = [int(match.group(i)) for i in range(1, 7)]
        
        if len(numbers) < 6:
            print(f"  번호를 찾을 수 없음 (찾은 개수: {len(numbers)})")
            return None
        
        # 보너스 번호 찾기
        bonus = None
        bonus_elem = soup.select_one('.bonus')
        if bonus_elem:
            bonus = int(bonus_elem.text.strip())
        else:
            # + 뒤에 오는 숫자 찾기
            balls = soup.select('.ball')
            if len(balls) >= 7:
                bonus = int(balls[6].text.strip())
        
        if not bonus:
            bonus = 0  # 못 찾으면 0으로
        
        # 날짜 계산 (회차 기반)
        first_draw = datetime(2002, 12, 7)
        draw_date = first_draw + timedelta(days=(round_num - 1) * 7)
        date_str = draw_date.strftime('%Y-%m-%d')
        
        return {
            'round': round_num,
            'numbers': sorted(numbers),
            'bonus': bonus,
            'date': date_str
        }
        
    except Exception as e:
        print(f"  네이버 크롤링 에러: {e}")
        return None

def fetch_from_api(round_num):
    """동행복권 API에서 가져오기 (백업)"""
    try:
        print(f"  API로 {round_num}회 가져오는 중...")
        res = requests.get(API_URL.format(round_num), headers=HEADERS, timeout=15)
        data = res.json()
        if data.get('returnValue') == 'success':
            return {
                'round': data['drwNo'],
                'numbers': sorted([data[f'drwtNo{i}'] for i in range(1, 7)]),
                'bonus': data['bnusNo'],
                'date': data['drwNoDate']
            }
    except Exception as e:
        print(f"  API 에러: {e}")
    return None

def main():
    from datetime import timedelta
    
    json_data = load_data()
    latest_saved = json_data['latestRound']
    
    print(f"=== 로또 데이터 업데이트 ===")
    print(f"저장된 최신 회차: {latest_saved}")
    
    # 네이버에서 최신 번호 가져오기
    latest = fetch_from_naver()
    
    if not latest:
        # 네이버 실패시 API로 시도
        current_round = (datetime.now() - datetime(2002, 12, 7)).days // 7 + 1
        for r in range(latest_saved + 1, current_round + 1):
            latest = fetch_from_api(r)
            if latest:
                break
    
    if latest and latest['round'] > latest_saved:
        print(f"\n새 데이터 발견: {latest['round']}회")
        print(f"  번호: {latest['numbers']} + {latest['bonus']}")
        
        # 중간에 빠진 회차 있으면 채우기
        new_data = []
        for r in range(latest_saved + 1, latest['round'] + 1):
            if r == latest['round']:
                new_data.append(latest)
            else:
                data = fetch_from_api(r)
                if data:
                    new_data.append(data)
        
        if new_data:
            new_data.sort(key=lambda x: x['round'], reverse=True)
            json_data['data'] = new_data + json_data['data']
            json_data['latestRound'] = new_data[0]['round']
            json_data['lastUpdate'] = datetime.now().strftime('%Y-%m-%d')
            save_data(json_data)
            print(f"\n🎉 {len(new_data)}개 업데이트 완료!")
    else:
        print("\n📭 새 데이터 없음")

if __name__ == '__main__':
    from datetime import timedelta
    main()

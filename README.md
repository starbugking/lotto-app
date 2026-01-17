# 🎱 로또 번호 추천 앱

통계 기반 분석 + 마르코프 체인 로또 번호 추천 앱

## 📱 기능

- **최적 조합**: 보상형 광고 후 TOP 5 번호 조합 표시
- **랜덤 생성**: 3회마다 전면 광고, 가중치 기반 랜덤
- **통계 분석**: 번호별 출현 횟수, 점수, 마르코프 전이

## 💰 광고 배치

| 위치 | 유형 | 트리거 |
|------|------|--------|
| 상단 | 배너 | 항상 |
| 하단 | 배너 | 항상 |
| 통계탭 중단 | 배너 | 통계탭 |
| 이번주 번호 보기 | 보상형 (15초) | 버튼 클릭 |
| 추천번호 생성 | 전면 | 3회마다 |
| 앱 종료 | 전면 | 뒤로가기 |

## 🚀 빌드 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 안드로이드 프로젝트 추가
```bash
npx cap add android
```

### 3. 빌드 & 동기화
```bash
npm run build
npx cap sync android
```

### 4. Android Studio에서 열기
```bash
npx cap open android
```

### 5. APK 빌드
Android Studio → Build → Generate Signed Bundle/APK

## ⚙️ 설정 변경 필요

### capacitor.config.json
```json
{
  "plugins": {
    "AdMob": {
      "appIdAndroid": "ca-app-pub-1814435248484070~여기에_앱ID"
    }
  }
}
```

### src/App.js
```javascript
const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/lotto-app/main/lotto-data.json';
```
→ YOUR_USERNAME을 본인 GitHub 아이디로 변경

## 📊 점수 시스템

| 항목 | 배점 | 근거 |
|------|------|------|
| 전체 출현빈도 | 35점 | 공 물리적 특성 |
| 핫넘버 (최근 10회) | 35점 | 기계 상태 |
| 마르코프 전이 | 30점 | 전이 패턴 |

## 🔄 자동 업데이트

GitHub Actions가 매주 토요일 밤 `lotto-data.json` 자동 업데이트

---

⚠️ 로또는 완전한 랜덤입니다. 당첨을 보장하지 않습니다!

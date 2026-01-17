import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { 
  initializeAdMob, 
  showBannerTop, 
  showBannerBottom, 
  showInterstitial, 
  showExitInterstitial,
  showRewarded, 
  preloadAds 
} from './adManager';

// ============================================
// GitHub Raw URL - 데이터 자동 업데이트
// ============================================
const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/lotto-app/main/lotto-data.json';

// ============================================
// 앱 컴포넌트
// ============================================
export default function App() {
  const [activeTab, setActiveTab] = useState('best');
  const [luckyNumber, setLuckyNumber] = useState('');
  const [likeNumber, setLikeNumber] = useState('');
  const [dislikeNumber, setDislikeNumber] = useState('');
  const [randomResults, setRandomResults] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(0);
  
  // 데이터 상태
  const [lottoData, setLottoData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  
  // 광고 상태
  const [adsInitialized, setAdsInitialized] = useState(false);
  
  // 보상형 광고 상태
  const [showBestResults, setShowBestResults] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  
  // 뒤로가기 상태
  const [backPressTime, setBackPressTime] = useState(0);
  const [showExitToast, setShowExitToast] = useState(false);

  // ============================================
  // 초기화
  // ============================================
  useEffect(() => {
    const init = async () => {
      // AdMob 초기화
      const adResult = await initializeAdMob();
      if (adResult) {
        setAdsInitialized(true);
        showBannerTop();
        showBannerBottom();
        preloadAds();
      }
      
      // 데이터 로드
      try {
        const res = await fetch(GITHUB_DATA_URL);
        if (res.ok) {
          const json = await res.json();
          setLottoData(json.data);
          setLastUpdate(json.lastUpdate);
        }
      } catch (e) {
        console.error('데이터 로드 실패:', e);
        setLottoData(FALLBACK_DATA);
      }
      setIsLoading(false);
    };
    
    init();
  }, []);

  // ============================================
  // 뒤로가기 처리 (종료 광고)
  // ============================================
  useEffect(() => {
    const handleBackButton = CapApp.addListener('backButton', async ({ canGoBack }) => {
      const now = Date.now();
      
      if (now - backPressTime < 3000) {
        // 3초 내 두 번째 뒤로가기 → 앱 종료
        CapApp.exitApp();
      } else {
        // 첫 번째 뒤로가기 → 광고 + 토스트
        setBackPressTime(now);
        await showExitInterstitial();
        setShowExitToast(true);
        setTimeout(() => setShowExitToast(false), 3000);
      }
    });
    
    return () => {
      handleBackButton.remove();
    };
  }, [backPressTime]);

  // ============================================
  // 데이터 계산
  // ============================================
  const latestRound = lottoData.length > 0 ? lottoData[0].round : 0;
  const latestDraw = lottoData[0] || { numbers: [], bonus: 0, date: '' };

  // 번호별 점수 계산
  const numberScores = useMemo(() => {
    if (lottoData.length === 0) return {};
    
    const scores = {};
    for (let i = 1; i <= 45; i++) {
      scores[i] = { total: 0, frequency: 0, hot: 0, markov: 0, details: {} };
    }

    // 1. 전체 출현빈도 (35점)
    const totalFreq = {};
    for (let i = 1; i <= 45; i++) totalFreq[i] = 0;
    lottoData.forEach(d => d.numbers.forEach(n => totalFreq[n]++));
    
    const maxFreq = Math.max(...Object.values(totalFreq));
    const minFreq = Math.min(...Object.values(totalFreq));
    
    for (let i = 1; i <= 45; i++) {
      scores[i].frequency = maxFreq > minFreq 
        ? ((totalFreq[i] - minFreq) / (maxFreq - minFreq)) * 35 
        : 17.5;
      scores[i].details.totalAppearance = totalFreq[i];
      scores[i].details.frequency = totalFreq[i];
    }

    // 2. 핫넘버 (35점)
    const recent10 = lottoData.slice(0, 10);
    const hotCount = {};
    for (let i = 1; i <= 45; i++) hotCount[i] = 0;
    recent10.forEach(d => d.numbers.forEach(n => hotCount[n]++));
    
    const maxHot = Math.max(...Object.values(hotCount));
    
    for (let i = 1; i <= 45; i++) {
      scores[i].hot = maxHot > 0 ? (hotCount[i] / maxHot) * 35 : 0;
      scores[i].details.recentAppearance = hotCount[i];
    }

    // 3. 마르코프 전이확률 (30점)
    const transition = {};
    for (let i = 1; i <= 45; i++) {
      transition[i] = {};
      for (let j = 1; j <= 45; j++) {
        transition[i][j] = 0;
      }
    }
    
    for (let i = 1; i < lottoData.length; i++) {
      const thisWeek = lottoData[i];
      const nextWeek = lottoData[i - 1];
      thisWeek.numbers.forEach(from => {
        nextWeek.numbers.forEach(to => {
          transition[from][to]++;
        });
      });
    }
    
    const lastWeekNumbers = latestDraw.numbers || [];
    const markovScores = {};
    
    for (let j = 1; j <= 45; j++) {
      let totalTransition = 0;
      lastWeekNumbers.forEach(from => {
        totalTransition += transition[from][j];
      });
      markovScores[j] = totalTransition;
    }
    
    const maxMarkov = Math.max(...Object.values(markovScores));
    const minMarkov = Math.min(...Object.values(markovScores));
    
    for (let i = 1; i <= 45; i++) {
      scores[i].markov = maxMarkov > minMarkov 
        ? ((markovScores[i] - minMarkov) / (maxMarkov - minMarkov)) * 30 
        : 0;
      scores[i].details.markovTransition = markovScores[i];
      scores[i].details.markovRaw = markovScores[i];
    }

    // 총점
    for (let i = 1; i <= 45; i++) {
      scores[i].total = scores[i].frequency + scores[i].hot + scores[i].markov;
    }

    return scores;
  }, [lottoData, latestDraw]);

  // 점수 순위
  const rankedNumbers = useMemo(() => {
    if (Object.keys(numberScores).length === 0) return [];
    return Object.entries(numberScores)
      .map(([num, data]) => ({ num: parseInt(num), ...data }))
      .sort((a, b) => b.total - a.total);
  }, [numberScores]);

  const getRank = (num) => rankedNumbers.findIndex(r => r.num === num) + 1;
  const getScore = (num) => numberScores[num]?.total.toFixed(1) || '0';

  // 밸런스 체크
  const isBalanced = (nums) => {
    const oddCount = nums.filter(n => n % 2 === 1).length;
    const lowCount = nums.filter(n => n <= 22).length;
    const sum = nums.reduce((a, b) => a + b, 0);
    
    if (oddCount < 2 || oddCount > 4) return false;
    if (lowCount < 2 || lowCount > 4) return false;
    if (sum < 100 || sum > 170) return false;
    
    return true;
  };

  // 최적 조합
  const bestCombinations = useMemo(() => {
    if (rankedNumbers.length === 0) return [];
    
    const luckyNum = parseInt(luckyNumber);
    const hasLucky = luckyNum >= 1 && luckyNum <= 45;
    
    let pool = rankedNumbers.slice(0, 20).map(r => r.num);
    if (hasLucky && !pool.includes(luckyNum)) pool.push(luckyNum);
    
    const combinations = [];
    
    const generate = (start, current) => {
      if (current.length === 6) {
        if (isBalanced(current)) {
          if (hasLucky && !current.includes(luckyNum)) return;
          const sorted = [...current].sort((a, b) => a - b);
          const score = sorted.reduce((sum, n) => sum + numberScores[n].total, 0);
          combinations.push({ numbers: sorted, score });
        }
        return;
      }
      for (let i = start; i < pool.length; i++) {
        generate(i + 1, [...current, pool[i]]);
      }
    };
    
    generate(0, []);
    combinations.sort((a, b) => b.score - a.score);
    
    return combinations.slice(0, 5).map((combo, idx) => ({
      rank: idx + 1,
      numbers: combo.numbers,
      score: combo.score.toFixed(1),
      sum: combo.numbers.reduce((a, b) => a + b, 0),
      oddEven: `${combo.numbers.filter(n => n % 2 === 1).length}:${6 - combo.numbers.filter(n => n % 2 === 1).length}`,
    }));
  }, [rankedNumbers, numberScores, luckyNumber]);

  // ============================================
  // 이벤트 핸들러
  // ============================================
  
  // 이번주 번호 보기 (보상형 광고)
  const handleViewBestNumbers = async () => {
    if (showBestResults) return; // 이미 봤으면 패스
    
    setIsWatchingAd(true);
    const rewarded = await showRewarded();
    setIsWatchingAd(false);
    
    if (rewarded) {
      setShowBestResults(true);
    } else {
      alert('광고를 끝까지 시청해야 번호를 볼 수 있습니다!');
    }
  };

  // 랜덤 생성 (3회마다 전면 광고)
  const generateRandom = async () => {
    if (Object.keys(numberScores).length === 0) return;
    
    const newCount = generateCount + 1;
    setGenerateCount(newCount);
    
    // 3회마다 전면 광고
    if (newCount % 3 === 0) {
      await showInterstitial();
    }
    
    setIsGenerating(true);
    
    setTimeout(() => {
      const like = parseInt(likeNumber);
      const dislike = parseInt(dislikeNumber);
      const hasLike = like >= 1 && like <= 45;
      const hasDislike = dislike >= 1 && dislike <= 45;
      
      const weightedPool = [];
      Object.entries(numberScores).forEach(([num, data]) => {
        const n = parseInt(num);
        if (hasDislike && n === dislike) return;
        let weight = Math.max(1, Math.floor(data.total));
        if (hasLike && n === like) weight *= 3;
        for (let i = 0; i < weight; i++) weightedPool.push(n);
      });
      
      const results = [];
      let attempts = 0;
      
      while (results.length < 5 && attempts < 5000) {
        attempts++;
        const selected = [];
        if (hasLike) selected.push(like);
        while (selected.length < 6) {
          const pick = weightedPool[Math.floor(Math.random() * weightedPool.length)];
          if (!selected.includes(pick)) selected.push(pick);
        }
        selected.sort((a, b) => a - b);
        if (!isBalanced(selected)) continue;
        const key = selected.join(',');
        if (results.some(r => r.numbers.join(',') === key)) continue;
        const score = selected.reduce((sum, n) => sum + numberScores[n].total, 0);
        results.push({
          numbers: selected,
          score: score.toFixed(1),
          sum: selected.reduce((a, b) => a + b, 0),
          oddEven: `${selected.filter(n => n % 2 === 1).length}:${6 - selected.filter(n => n % 2 === 1).length}`,
        });
      }
      
      results.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
      setRandomResults(results.slice(0, 5));
      setIsGenerating(false);
    }, 500);
  };

  // ============================================
  // UI 컴포넌트
  // ============================================
  const getNumberColor = (n) => {
    if (n <= 10) return 'bg-yellow-400 text-yellow-900';
    if (n <= 20) return 'bg-blue-500 text-white';
    if (n <= 30) return 'bg-red-500 text-white';
    if (n <= 40) return 'bg-gray-600 text-white';
    return 'bg-green-500 text-white';
  };

  const NumberBall = ({ number, size = 'md', highlight = false, showRank = false }) => {
    const sizeClasses = { sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-base' };
    const rank = getRank(number);
    return (
      <div className="relative">
        <div className={`${sizeClasses[size]} ${getNumberColor(number)} rounded-full flex items-center justify-center font-bold shadow-lg ${highlight ? 'ring-3 ring-green-400' : ''}`}>
          {number}
        </div>
        {showRank && rank > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 bg-purple-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{fontSize: '9px'}}>
            {rank}
          </span>
        )}
      </div>
    );
  };

  // 로딩
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎱</div>
          <div className="text-white text-lg">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 상단 배너 공간 */}
      <div className="h-14 bg-black/20" />
      
      <div className="p-4 pb-20">
        <div className="max-w-lg mx-auto">
          
          {/* 헤더 */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-white">🎱 로또 번호 추천</h1>
            <p className="text-purple-300 text-sm mt-1">통계 기반 · 마르코프 체인</p>
            {lastUpdate && <p className="text-purple-400/50 text-xs">데이터: {lastUpdate}</p>}
          </div>

          {/* 지난주 당첨번호 */}
          {latestDraw.numbers.length > 0 && (
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 mb-4">
              <div className="text-purple-300 text-xs mb-2">지난주 {latestRound}회 ({latestDraw.date})</div>
              <div className="flex justify-center gap-1">
                {latestDraw.numbers.map((n, i) => <NumberBall key={i} number={n} size="sm" />)}
                <span className="text-white flex items-center px-1">+</span>
                <NumberBall number={latestDraw.bonus} size="sm" />
              </div>
            </div>
          )}

          {/* 탭 */}
          <div className="flex mb-4 bg-white/10 rounded-xl p-1">
            {['best', 'random', 'stats'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === tab ? 'bg-white text-purple-900 shadow' : 'text-white/70'
                }`}
              >
                {tab === 'best' ? '✨ 최적' : tab === 'random' ? '🎲 랜덤' : '📊 통계'}
              </button>
            ))}
          </div>

          {/* ============================================ */}
          {/* 최적 조합 탭 */}
          {/* ============================================ */}
          {activeTab === 'best' && (
            <>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-4">
                <div className="text-white font-semibold text-sm mb-2">🍀 행운의 번호</div>
                <input
                  type="number" min="1" max="45" value={luckyNumber}
                  onChange={e => { setLuckyNumber(e.target.value); setShowBestResults(false); }}
                  placeholder="1~45"
                  className="w-20 px-3 py-2 text-center bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>

              {!showBestResults ? (
                <button
                  onClick={handleViewBestNumbers}
                  disabled={isWatchingAd}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl shadow-lg mb-4 disabled:opacity-50"
                >
                  {isWatchingAd ? '🎬 광고 시청 중...' : '🎬 광고 보고 이번주 번호 보기'}
                </button>
              ) : (
                <div className="bg-white rounded-xl p-4 shadow-xl">
                  <div className="text-center mb-4">
                    <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {latestRound + 1}회차
                    </span>
                    <h2 className="text-lg font-bold text-gray-800 mt-2">🏆 최적 조합 TOP 5</h2>
                  </div>
                  
                  <div className="space-y-3">
                    {bestCombinations.map((combo, i) => (
                      <div key={i} className={`p-3 rounded-lg ${i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            i === 0 ? 'bg-yellow-400' : 'bg-gray-300'
                          }`}>{i + 1}</span>
                          <span className="ml-auto text-xs text-gray-400">{combo.score}점</span>
                        </div>
                        <div className="flex justify-center gap-1.5">
                          {combo.numbers.map((n, j) => <NumberBall key={j} number={n} size="sm" showRank />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================ */}
          {/* 랜덤 생성 탭 */}
          {/* ============================================ */}
          {activeTab === 'random' && (
            <>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <div className="text-white font-semibold text-sm mb-1">💚 좋아하는 번호</div>
                  <input
                    type="number" min="1" max="45" value={likeNumber}
                    onChange={e => setLikeNumber(e.target.value)}
                    placeholder="1~45"
                    className="w-20 px-3 py-2 text-center bg-white/10 border border-green-500/30 rounded-lg text-white"
                  />
                  <span className="text-green-300/60 text-xs ml-2">가중치 3배</span>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm mb-1">❌ 싫어하는 번호</div>
                  <input
                    type="number" min="1" max="45" value={dislikeNumber}
                    onChange={e => setDislikeNumber(e.target.value)}
                    placeholder="1~45"
                    className="w-20 px-3 py-2 text-center bg-white/10 border border-red-500/30 rounded-lg text-white"
                  />
                  <span className="text-red-300/60 text-xs ml-2">제외</span>
                </div>
              </div>

              <button
                onClick={generateRandom}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-lg mb-4 disabled:opacity-50"
              >
                {isGenerating ? '🎰 생성 중...' : `🎲 추천번호 생성 (${generateCount % 3}/3)`}
              </button>

              {randomResults.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-xl">
                  <div className="font-bold text-gray-800 mb-3">🎲 생성 결과</div>
                  <div className="space-y-3">
                    {randomResults.map((combo, i) => (
                      <div key={i} className="p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-purple-200 text-purple-700">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">{combo.score}점</span>
                        </div>
                        <div className="flex justify-center gap-1.5">
                          {combo.numbers.map((n, j) => <NumberBall key={j} number={n} size="sm" showRank />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================ */}
          {/* 통계 탭 */}
          {/* ============================================ */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {/* 번호별 출현 횟수 */}
              <div className="bg-white rounded-xl p-4 shadow-xl">
                <h3 className="font-bold text-gray-800 mb-3">📈 번호별 출현 횟수</h3>
                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                  {rankedNumbers.slice(0, 15).map(item => (
                    <div key={item.num} className="p-2 bg-gray-50 rounded">
                      <NumberBall number={item.num} size="sm" />
                      <div className="text-xs text-gray-500 mt-1">{item.details.frequency}회</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">상위 15개 · 전체 {lottoData.length}회차</p>
              </div>

              {/* 중단 배너 광고 공간 */}
              <div className="h-16 bg-black/20 rounded-xl flex items-center justify-center">
                <span className="text-white/30 text-sm">광고</span>
              </div>

              {/* 번호별 점수 상세 */}
              <div className="bg-white rounded-xl p-4 shadow-xl">
                <h3 className="font-bold text-gray-800 mb-3">🏆 번호별 종합 점수</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rankedNumbers.map((item, i) => (
                    <div key={item.num} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="w-6 text-center text-xs text-gray-400">{i + 1}</span>
                      <NumberBall number={item.num} size="sm" />
                      <div className="flex-1 ml-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500" 
                            style={{ width: `${item.total}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-purple-600">{item.total.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 마르코프 전이 분석 */}
              <div className="bg-white rounded-xl p-4 shadow-xl">
                <h3 className="font-bold text-gray-800 mb-3">🔄 마르코프 전이 분석</h3>
                <p className="text-sm text-gray-600 mb-3">
                  지난주 번호 [{latestDraw.numbers.join(', ')}] 다음에 나올 확률 높은 번호
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {rankedNumbers
                    .sort((a, b) => b.details.markovRaw - a.details.markovRaw)
                    .slice(0, 10)
                    .map(item => (
                      <div key={item.num} className="text-center p-2 bg-purple-50 rounded">
                        <NumberBall number={item.num} size="sm" />
                        <div className="text-xs text-purple-600 mt-1">{item.details.markovRaw}</div>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">전이 횟수 기준 상위 10개</p>
              </div>

              {/* 점수 계산 방식 */}
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <h3 className="font-bold text-white mb-2">📊 점수 계산 방식</h3>
                <div className="text-sm text-purple-200 space-y-1">
                  <p>• 전체 출현빈도: 35점 (공 물리적 특성)</p>
                  <p>• 핫넘버 (최근 10회): 35점 (기계 상태)</p>
                  <p>• 마르코프 전이: 30점 (패턴 분석)</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* 하단 배너 공간 */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-black/20" />
      
      {/* 종료 토스트 */}
      {showExitToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
          한번 더 누르면 종료됩니다
        </div>
      )}
    </div>
  );
}

// ============================================
// 폴백 데이터
// ============================================
const FALLBACK_DATA = [
  { round: 1206, numbers: [1, 3, 17, 26, 27, 42], bonus: 23, date: '2026-01-10' },
  { round: 1205, numbers: [1, 6, 14, 22, 35, 43], bonus: 19, date: '2026-01-03' },
  { round: 1204, numbers: [8, 16, 28, 30, 31, 44], bonus: 27, date: '2025-12-27' },
];

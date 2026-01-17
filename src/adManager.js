import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdmobConsentStatus, InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';

// ============================================
// 광고 ID
// ============================================
const AD_IDS = {
  BANNER_TOP: 'ca-app-pub-1814435248484070/4108308888',
  BANNER_BOTTOM: 'ca-app-pub-1814435248484070/4223040719',
  BANNER_MIDDLE: 'ca-app-pub-1814435248484070/8828500137',
  INTERSTITIAL_POPUP: 'ca-app-pub-1814435248484070/9283795702',
  INTERSTITIAL_EXIT: 'ca-app-pub-1814435248484070/5365550230',
  REWARDED_VIDEO: 'ca-app-pub-1814435248484070/1123052899',
};

// 테스트용 ID (개발 중에만 사용)
const TEST_IDS = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
};

// 개발 모드면 테스트 ID 사용
const isDev = process.env.NODE_ENV === 'development';

// ============================================
// AdMob 초기화
// ============================================
export async function initializeAdMob() {
  try {
    await AdMob.initialize({
      initializeForTesting: isDev,
    });
    console.log('AdMob 초기화 완료');
    return true;
  } catch (error) {
    console.error('AdMob 초기화 실패:', error);
    return false;
  }
}

// ============================================
// 배너 광고
// ============================================
export async function showBannerTop() {
  try {
    await AdMob.showBanner({
      adId: isDev ? TEST_IDS.BANNER : AD_IDS.BANNER_TOP,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
    });
  } catch (error) {
    console.error('상단 배너 에러:', error);
  }
}

export async function showBannerBottom() {
  try {
    await AdMob.showBanner({
      adId: isDev ? TEST_IDS.BANNER : AD_IDS.BANNER_BOTTOM,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
  } catch (error) {
    console.error('하단 배너 에러:', error);
  }
}

export async function hideBanner() {
  try {
    await AdMob.hideBanner();
  } catch (error) {
    console.error('배너 숨기기 에러:', error);
  }
}

// ============================================
// 전면 광고 (팝업)
// ============================================
let interstitialLoaded = false;

export async function prepareInterstitial(type = 'popup') {
  try {
    const adId = type === 'exit' 
      ? (isDev ? TEST_IDS.INTERSTITIAL : AD_IDS.INTERSTITIAL_EXIT)
      : (isDev ? TEST_IDS.INTERSTITIAL : AD_IDS.INTERSTITIAL_POPUP);
    
    await AdMob.prepareInterstitial({ adId });
    interstitialLoaded = true;
    console.log('전면 광고 준비 완료');
  } catch (error) {
    console.error('전면 광고 준비 에러:', error);
    interstitialLoaded = false;
  }
}

export async function showInterstitial() {
  try {
    if (!interstitialLoaded) {
      await prepareInterstitial();
    }
    await AdMob.showInterstitial();
    interstitialLoaded = false;
    // 다음 광고 미리 준비
    prepareInterstitial();
    return true;
  } catch (error) {
    console.error('전면 광고 표시 에러:', error);
    return false;
  }
}

// 종료 시 전면 광고
export async function showExitInterstitial() {
  try {
    await AdMob.prepareInterstitial({ 
      adId: isDev ? TEST_IDS.INTERSTITIAL : AD_IDS.INTERSTITIAL_EXIT 
    });
    await AdMob.showInterstitial();
    return true;
  } catch (error) {
    console.error('종료 광고 에러:', error);
    return false;
  }
}

// ============================================
// 보상형 광고 (15초 영상)
// ============================================
let rewardedLoaded = false;
let rewardEarned = false;

export async function prepareRewarded() {
  try {
    await AdMob.prepareRewardVideoAd({
      adId: isDev ? TEST_IDS.REWARDED : AD_IDS.REWARDED_VIDEO,
    });
    rewardedLoaded = true;
    console.log('보상형 광고 준비 완료');
  } catch (error) {
    console.error('보상형 광고 준비 에러:', error);
    rewardedLoaded = false;
  }
}

export async function showRewarded() {
  return new Promise(async (resolve) => {
    try {
      if (!rewardedLoaded) {
        await prepareRewarded();
      }
      
      rewardEarned = false;
      
      // 보상 획득 리스너
      const rewardListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewardEarned = true;
        console.log('보상 획득!');
      });
      
      // 광고 종료 리스너
      const dismissListener = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        rewardListener.remove();
        dismissListener.remove();
        rewardedLoaded = false;
        prepareRewarded(); // 다음 광고 준비
        resolve(rewardEarned);
      });
      
      await AdMob.showRewardVideoAd();
      
    } catch (error) {
      console.error('보상형 광고 표시 에러:', error);
      resolve(false);
    }
  });
}

// ============================================
// 광고 미리 로드
// ============================================
export async function preloadAds() {
  await prepareInterstitial();
  await prepareRewarded();
}

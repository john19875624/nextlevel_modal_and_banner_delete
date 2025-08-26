// 設定オブジェクト
const CONFIG = {
    // 非表示にしたい要素のセレクター
    SELECTORS_TO_HIDE: [
        '.job-list__narrow-down-large--pc',
        '.job-list__narrow-down-large--sp',
        '.common-modal.job-list__banner-modal',
        'dialog[id^="banner_modal_"]',
        '.job-list__banner-modal',
        '.banner',
        '.bannerBox',
        '.flicking-viewport.carousel',
        '.my-list__search'   // ★ 追加：検索フォーム全体を非表示
    ],
    
    // ログ出力の設定
    LOGGING: {
        PREFIX: '[NextLevel Banner Hider]',
        ENABLED: true
    },
    
    // MutationObserverの設定
    OBSERVER_OPTIONS: {
        childList: true,
        subtree: true
    }
};

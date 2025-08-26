// ==UserScript==
// @name         NEXT LEVEL ジョブリストバナー非表示 (改良版)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  https://www.e-nextlevel.jp/work/list のバナー要素を効率的に非表示にし、詳細なログを出力
// @author       You
// @match        https://www.e-nextlevel.jp/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 設定オブジェクト
    const CONFIG = {
        // 非表示にしたい要素のセレクター
        SELECTORS_TO_HIDE: [
            '.job-list__narrow-down-large--pc',
            '.job-list__narrow-down-large--sp',
            '.common-modal.job-list__banner-modal',
            'dialog[id^="banner_modal_"]',
            '.job-list__banner-modal'
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

    // ログ出力クラス
    class Logger {
        static log(message, type = 'info') {
            if (!CONFIG.LOGGING.ENABLED) return;
            
            const prefix = CONFIG.LOGGING.PREFIX;
            const timestamp = new Date().toLocaleTimeString();
            
            switch (type) {
                case 'success':
                    console.log(`✅ ${prefix} [${timestamp}] ${message}`);
                    break;
                case 'error':
                    console.log(`❌ ${prefix} [${timestamp}] ${message}`);
                    break;
                case 'info':
                    console.log(`ℹ️ ${prefix} [${timestamp}] ${message}`);
                    break;
                case 'start':
                    console.log(`🚀 ${prefix} [${timestamp}] ${message}`);
                    break;
                case 'end':
                    console.log(`🏁 ${prefix} [${timestamp}] ${message}`);
                    break;
                default:
                    console.log(`${prefix} [${timestamp}] ${message}`);
            }
        }
    }

    // 要素非表示処理クラス
    class ElementHider {
        constructor(selectors) {
            this.selectors = selectors;
            this.hiddenElements = new Set();
            this.bodyScrollState = null;
        }

        /**
         * 指定されたセレクターの要素を非表示にする
         * @param {string} selector - CSSセレクター
         * @returns {boolean} - 処理が成功したかどうか
         */
        hideElementBySelector(selector) {
            const element = document.querySelector(selector);
            
            if (!element) {
                Logger.log(`セレクター '${selector}' に該当する要素が見つかりません`, 'error');
                return false;
            }

            return this.hideElement(element, selector);
        }

        /**
         * 要素を非表示にする
         * @param {Element} element - 非表示にする要素
         * @param {string} selector - セレクター名（ログ用）
         * @returns {boolean} - 処理が成功したかどうか
         */
        hideElement(element, selector) {
            const elementId = this.getElementId(element, selector);
            
            if (this.hiddenElements.has(elementId)) {
                return false; // 既に処理済み
            }

            if (this.isElementVisible(element)) {
                // モーダル関連の要素の場合は特別な処理
                if (this.isModalElement(element)) {
                    this.handleModalElement(element, selector);
                } else {
                    element.style.display = 'none';
                }
                
                this.hiddenElements.add(elementId);
                Logger.log(`'${selector}' を非表示にしました`, 'success');
                return true;
            } else {
                Logger.log(`'${selector}' は既に非表示です`, 'info');
                return false;
            }
        }

        /**
         * モーダル要素かどうかを判定
         * @param {Element} element - チェック対象の要素
         * @returns {boolean} - モーダル要素かどうか
         */
        isModalElement(element) {
            return element.tagName === 'DIALOG' || 
                   element.classList.contains('common-modal') ||
                   element.classList.contains('job-list__banner-modal');
        }

        /**
         * モーダル要素の特別な処理
         * @param {Element} element - モーダル要素
         * @param {string} selector - セレクター名
         */
        handleModalElement(element, selector) {
            // ダイアログの場合は close() メソッドを使用
            if (element.tagName === 'DIALOG' && element.open) {
                element.close();
                Logger.log(`ダイアログ '${selector}' を閉じました`, 'info');
            }
            
            // 要素を非表示に設定
            element.style.display = 'none';
            
            // body のスクロール制御を解除
            this.restoreBodyScroll();
            
            Logger.log(`モーダル '${selector}' のスクロール制御を解除しました`, 'info');
        }

        /**
         * body要素のスクロールを復元
         */
        restoreBodyScroll() {
            const body = document.body;
            const html = document.documentElement;
            
            // よくあるスクロール制御のスタイルを解除
            body.style.overflow = '';
            body.style.position = '';
            body.style.top = '';
            body.style.left = '';
            body.style.right = '';
            body.style.width = '';
            body.style.height = '';
            
            html.style.overflow = '';
            html.style.position = '';
            
            // モーダル関連のクラスを削除
            body.classList.remove('modal-open', 'no-scroll', 'overflow-hidden');
            html.classList.remove('modal-open', 'no-scroll', 'overflow-hidden');
            
            Logger.log('bodyのスクロール制御を復元しました', 'info');
        }

        /**
         * 要素が表示されているかチェック
         * @param {Element} element - チェック対象の要素
         * @returns {boolean} - 表示されているかどうか
         */
        isElementVisible(element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }

        /**
         * 要素のユニークIDを生成
         * @param {Element} element - 要素
         * @param {string} selector - セレクター
         * @returns {string} - ユニークID
         */
        getElementId(element, selector) {
            return `${selector}:${element.tagName}:${element.className}`;
        }

        /**
         * 全ての指定要素を非表示にする
         */
        hideAllElements() {
            Logger.log('要素の非表示処理を開始', 'start');
            
            let hiddenCount = 0;
            
            this.selectors.forEach(selector => {
                // 複数の要素が存在する可能性があるセレクター（モーダルなど）に対応
                const elements = document.querySelectorAll(selector);
                
                if (elements.length > 0) {
                    elements.forEach(element => {
                        if (this.hideElement(element, selector)) {
                            hiddenCount++;
                        }
                    });
                } else {
                    Logger.log(`セレクター '${selector}' に該当する要素が見つかりません`, 'error');
                }
            });

            Logger.log(`非表示処理完了 (${hiddenCount}個の要素を処理)`, 'end');
        }
    }

    // DOM監視クラス
    class DOMWatcher {
        constructor(elementHider) {
            this.elementHider = elementHider;
            this.observer = null;
            this.isObserving = false;
        }

        /**
         * DOM変更の監視を開始
         */
        startWatching() {
            if (this.isObserving) {
                Logger.log('既にDOM監視は開始されています', 'info');
                return;
            }

            this.observer = new MutationObserver(() => {
                this.elementHider.hideAllElements();
            });

            this.observer.observe(document.body, CONFIG.OBSERVER_OPTIONS);
            this.isObserving = true;
            
            Logger.log('DOM変更の監視を開始しました', 'info');
        }

        /**
         * DOM変更の監視を停止
         */
        stopWatching() {
            if (this.observer && this.isObserving) {
                this.observer.disconnect();
                this.isObserving = false;
                Logger.log('DOM変更の監視を停止しました', 'info');
            }
        }
    }

    // メインアプリケーションクラス
    class NextLevelBannerHider {
        constructor() {
            this.elementHider = new ElementHider(CONFIG.SELECTORS_TO_HIDE);
            this.domWatcher = new DOMWatcher(this.elementHider);
        }

        /**
         * アプリケーションを初期化・開始
         */
        init() {
            Logger.log('NextLevel Banner Hider を開始します', 'start');
            
            // 初回実行
            this.elementHider.hideAllElements();
            
            // DOM監視開始
            this.domWatcher.startWatching();
            
            Logger.log('初期化完了', 'info');
        }

        /**
         * アプリケーションを停止
         */
        destroy() {
            this.domWatcher.stopWatching();
            Logger.log('NextLevel Banner Hider を停止しました', 'end');
        }
    }

    // アプリケーション実行
    const app = new NextLevelBannerHider();
    
    // DOM読み込み完了後に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }

    // デバッグ用: グローバルスコープにappを追加（必要に応じてコメントアウト）
    // window.nextLevelBannerHider = app;

})();

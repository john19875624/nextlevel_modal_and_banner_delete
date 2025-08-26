// ==UserScript==
// @name         NEXT LEVEL ジョブリストバナー非表示 (シンプルログ版)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  NEXT LEVEL のバナーや検索フォームを非表示にし、成功/失敗件数だけログ出力するシンプル版
// @author       You
// @match        https://www.e-nextlevel.jp/*
// @grant        none
// ==/UserScript==
(function() {
    'use strict';

    // 設定オブジェクト
    const CONFIG = {
        SELECTORS_TO_HIDE: [
            '.job-list__narrow-down-large--pc',
            '.job-list__narrow-down-large--sp',
            '.common-modal.job-list__banner-modal',
            'dialog[id^="banner_modal_"]',
            '.job-list__banner-modal',
            '.banner',
            '.bannerBox',
            '.flicking-viewport.carousel',
            '.my-list__search'   // ★ 検索フォーム全体を非表示
        ],
        LOGGING: {
            PREFIX: '[NextLevel Banner Hider]',
            ENABLED: true
        },
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
                case 'start':
                    console.log(`🚀 ${prefix} [${timestamp}] ${message}`); break;
                case 'end':
                    console.log(`🏁 ${prefix} [${timestamp}] ${message}`); break;
                case 'error':
                    console.log(`❌ ${prefix} [${timestamp}] ${message}`); break;
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
        }

        hideElement(element, selector) {
            const elementId = this.getElementId(element, selector);
            if (this.hiddenElements.has(elementId)) return false;

            if (this.isElementVisible(element)) {
                if (this.isModalElement(element)) {
                    this.handleModalElement(element);
                } else {
                    element.style.display = 'none';
                }
                this.hiddenElements.add(elementId);
                return true;
            }
            return false;
        }

        isModalElement(element) {
            return element.tagName === 'DIALOG' ||
                   element.classList.contains('common-modal') ||
                   element.classList.contains('job-list__banner-modal');
        }

        handleModalElement(element) {
            if (element.tagName === 'DIALOG' && element.open) {
                element.close();
            }
            element.style.display = 'none';
            this.restoreBodyScroll();
        }

        restoreBodyScroll() {
            const body = document.body;
            const html = document.documentElement;
            body.style.overflow = '';
            body.style.position = '';
            body.style.top = '';
            body.style.left = '';
            body.style.right = '';
            body.style.width = '';
            body.style.height = '';
            html.style.overflow = '';
            html.style.position = '';
            body.classList.remove('modal-open', 'no-scroll', 'overflow-hidden');
            html.classList.remove('modal-open', 'no-scroll', 'overflow-hidden');
        }

        isElementVisible(element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }

        getElementId(element, selector) {
            return `${selector}:${element.tagName}:${element.className}`;
        }

        hideAllElements() {
            Logger.log('要素の非表示処理を開始', 'start');

            let hiddenCount = 0;
            let notFoundCount = 0;

            this.selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(element => {
                        if (this.hideElement(element, selector)) {
                            hiddenCount++;
                        }
                    });
                } else {
                    notFoundCount++;
                }
            });

            Logger.log(`非表示処理完了: ${hiddenCount}件成功 / ${notFoundCount}件未発見`, 'end');
        }
    }

    // DOM監視クラス
    class DOMWatcher {
        constructor(elementHider) {
            this.elementHider = elementHider;
            this.observer = null;
            this.isObserving = false;
        }

        startWatching() {
            if (this.isObserving) return;
            this.observer = new MutationObserver(() => {
                this.elementHider.hideAllElements();
            });
            this.observer.observe(document.body, CONFIG.OBSERVER_OPTIONS);
            this.isObserving = true;
        }

        stopWatching() {
            if (this.observer && this.isObserving) {
                this.observer.disconnect();
                this.isObserving = false;
            }
        }
    }

    // メインアプリケーション
    class NextLevelBannerHider {
        constructor() {
            this.elementHider = new ElementHider(CONFIG.SELECTORS_TO_HIDE);
            this.domWatcher = new DOMWatcher(this.elementHider);
        }

        init() {
            this.elementHider.hideAllElements();
            this.domWatcher.startWatching();
        }

        destroy() {
            this.domWatcher.stopWatching();
        }
    }

    // 実行
    const app = new NextLevelBannerHider();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }
    // window.nextLevelBannerHider = app; // デバッグ用
})();

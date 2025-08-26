// ==UserScript==
// @name         NEXT LEVEL ジョブリストバナー非表示 (改良版)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  https://www.e-nextlevel.jp/work/list のバナー要素と検索フォームを非表示にする
// @author       You
// @match        https://www.e-nextlevel.jp/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        SELECTORS_TO_HIDE: [
            '.my-list__search', // ★今回追加したセレクター
            '.job-list__narrow-down-large--pc',
            '.job-list__narrow-down-large--sp',
            '.common-modal.job-list__banner-modal',
            'dialog[id^="banner_modal_"]',
            '.job-list__banner-modal',
            '.banner',
            '.bannerBox',
            '.flicking-viewport.carousel'
        ],
        LOGGING_ENABLED: true,
        LOGGING_PREFIX: '[NextLevel Hider]'
    };

    function log(message, type = 'info') {
        if (!CONFIG.LOGGING_ENABLED) return;
        const prefix = CONFIG.LOGGING_PREFIX;
        const icon = {
            'start': '🚀',
            'end': '🏁',
            'success': '✅',
            'error': '❌',
            'info': 'ℹ️'
        }[type] || '';
        console.log(`${icon} ${prefix} ${message}`);
    }

    /**
     * @class NextLevelHider
     * 不要な要素の非表示とDOM監視を管理
     */
    class NextLevelHider {
        constructor() {
            this.hiddenElements = new Set();
            this.observer = null;
        }

        init() {
            log('🚀 スクリプトを開始します', 'start');
            this.addInstantCSSRules();
            this.startObservingDOM();
            log('🏁 初期化完了', 'end');
        }

        addInstantCSSRules() {
            const selectors = CONFIG.SELECTORS_TO_HIDE.join(', ');
            if (typeof GM_addStyle !== 'undefined') {
                GM_addStyle(`${selectors} { display: none !important; visibility: hidden !important; }`);
                log(`✅ CSSルールを適用し、${CONFIG.SELECTORS_TO_HIDE.length}個のセレクターを即時非表示にしました`, 'success');
            } else {
                log('❌ GM_addStyleが見つかりません。@grant GM_addStyleが宣言されているか確認してください。', 'error');
            }
        }

        startObservingDOM() {
            if (this.observer) return;
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node instanceof Element) {
                            CONFIG.SELECTORS_TO_HIDE.forEach(selector => {
                                if (node.matches(selector) && !this.hiddenElements.has(node)) {
                                    this.hideElement(node, selector);
                                }
                                node.querySelectorAll(selector).forEach(child => {
                                    if (!this.hiddenElements.has(child)) {
                                        this.hideElement(child, selector);
                                    }
                                });
                            });
                        }
                    });
                });
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
            log('ℹ️ DOM変更の監視を開始しました');
        }

        hideElement(element, selector) {
            const uniqueId = element.tagName + element.className + element.id;
            if (this.hiddenElements.has(uniqueId)) {
                return false;
            }

            if (this.isModalElement(element)) {
                this.handleModalElement(element, selector);
            } else {
                element.style.setProperty('display', 'none', 'important');
            }
            
            this.hiddenElements.add(uniqueId);
            log(`✅ 動的に出現した'${selector}' に一致する要素を非表示にしました`, 'success');
            return true;
        }

        isModalElement(element) {
            return element.tagName === 'DIALOG' ||
                   element.classList.contains('common-modal') ||
                   element.classList.contains('job-list__banner-modal');
        }

        handleModalElement(element, selector) {
            if (element.tagName === 'DIALOG' && element.open) {
                element.close();
                log(`ダイアログ '${selector}' を閉じました`, 'info');
            }
            element.style.setProperty('display', 'none', 'important');
            this.restoreBodyScroll();
            log(`モーダル '${selector}' のスクロール制御を解除しました`, 'info');
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

            log('ℹ️ bodyのスクロール制御を復元しました');
        }
    }

    const app = new NextLevelHider();
    app.init();
})();

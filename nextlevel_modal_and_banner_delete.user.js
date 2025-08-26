// ==UserScript==
// @name         NEXT LEVEL ジョブリストバナー非表示 (改良版)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  https://www.e-nextlevel.jp/work/list のバナー要素を効率的に非表示にし、詳細なログを出力
// @author       You
// @match        https://www.e-nextlevel.jp/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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
            '.flicking-viewport.carousel'
        ],
        LOGGING_ENABLED: true,
        LOGGING_PREFIX: '[NextLevel Banner Hider]'
    };

    /**
     * @class NextLevelBannerHider
     * バナー要素の非表示とDOM監視を管理するメインクラス
     */
    class NextLevelBannerHider {
        constructor() {
            this.hiddenElements = new Set();
            this.observer = null;
        }

        /**
         * アプリケーションの初期化と開始
         */
        init() {
            this.log('🚀 スクリプトを開始します', 'start');
            
            // 初回実行とDOM監視の開始
            this.hideAllElements();
            this.startObservingDOM();

            this.log('🏁 初期化完了', 'end');
        }

        /**
         * 指定されたセレクターに一致する全ての要素を非表示にする
         */
        hideAllElements() {
            let count = 0;
            CONFIG.SELECTORS_TO_HIDE.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(element => {
                        if (this.hideElement(element, selector)) {
                            count++;
                        }
                    });
                } else {
                    this.log(`セレクター '${selector}' に該当する要素が見つかりませんでした`, 'info');
                }
            });
            if (count > 0) {
                this.log(`✅ ${count} 個の要素を非表示にしました`, 'success');
            }
        }

        /**
         * 単一の要素を非表示にする
         * @param {Element} element - 非表示にする要素
         * @param {string} selector - 要素のセレクター（ログ用）
         * @returns {boolean} - 新たに要素を非表示にしたか
         */
        hideElement(element, selector) {
            // 重複処理を避けるためのユニークIDを生成
            const uniqueId = element.tagName + element.className + element.id;
            if (this.hiddenElements.has(uniqueId)) {
                return false;
            }

            // モーダル要素の特別な処理
            if (element.tagName === 'DIALOG' && element.open) {
                element.close();
                document.body.style.overflow = '';
            }

            // スタイルを直接適用して非表示にする
            element.style.setProperty('display', 'none', 'important');
            this.hiddenElements.add(uniqueId);
            
            this.log(`'${selector}' に一致する要素を非表示にしました`, 'info');
            return true;
        }

        /**
         * DOMの変更を監視し、動的に追加された要素を非表示にする
         * 検索フォームのトグルボタンもこの監視内で追加
         */
        startObservingDOM() {
            if (this.observer) return;

            // 検索フォームが追加されたかどうかのフラグ
            let isSearchFormButtonAdded = false;

            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node instanceof Element) {
                            // バナー非表示の処理
                            CONFIG.SELECTORS_TO_HIDE.forEach(selector => {
                                if (node.matches(selector)) {
                                    this.hideElement(node, selector);
                                }
                                node.querySelectorAll(selector).forEach(child => {
                                    this.hideElement(child, selector);
                                });
                            });
                            
                            // 検索フォームボタンの追加処理
                            if (!isSearchFormButtonAdded && node.matches('.my-list__search')) {
                                this.addSearchFormToggleButton(node);
                                isSearchFormButtonAdded = true;
                            }
                        }
                    });
                });
            });

            this.observer.observe(document.body, { childList: true, subtree: true });
            this.log('DOM変更の監視を開始しました', 'info');
        }
        
        /**
         * 検索フォームの表示/非表示ボタンを追加する
         * @param {Element} searchForm - 検索フォームの要素
         */
        addSearchFormToggleButton(searchForm) {
            const button = document.createElement('button');
            button.textContent = '検索条件を表示/非表示';
            button.id = 'toggleSearchFormButton';
            button.style.cssText = 'display: block; margin: 10px auto; padding: 8px 16px; font-size: 14px; cursor: pointer; border: 1px solid #ccc; background-color: #f0f0f0; border-radius: 4px;';

            searchForm.parentNode.insertBefore(button, searchForm);

            button.addEventListener('click', () => {
                if (searchForm.style.display === 'none') {
                    searchForm.style.display = 'block';
                    button.textContent = '検索条件を非表示';
                } else {
                    searchForm.style.display = 'none';
                    button.textContent = '検索条件を表示';
                }
            });
            
            this.log('✅ 検索フォームのトグルボタンを追加しました', 'success');
        }

        /**
         * ログ出力ヘルパー
         * @param {string} message - ログメッセージ
         * @param {string} type - ログの種類 ('info', 'success', 'error', 'start', 'end')
         */
        log(message, type = 'info') {
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
    }

    // スクリプトの実行
    const app = new NextLevelBannerHider();
    app.init();
})();

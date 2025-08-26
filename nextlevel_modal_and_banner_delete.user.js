// ==UserScript==
// @name         E-NEXT LEVEL Googleカレンダー登録スクリプト
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  E-NEXT LEVELの求人詳細ページから情報を抽出し、ワンクリックでGoogleカレンダーにイベントとして追加＆検索ボックス非表示
// @author       You
// @match        https://www.e-nextlevel.jp/work/detail/*
// @match        https://www.e-nextlevel.jp/mylist*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 設定とセレクタの定数化
    const CONFIG = {
        BUTTON_STYLES: `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            z-index: 1000;
        `,
        GOOGLE_CALENDAR_BASE_URL: 'https://www.google.com/calendar/render'
    };

    const SELECTORS = {
        SEARCH_BOX: 'div.my-list__search',
        TITLE: 'div.job-detail__content--title',
        INFO_TEXT: 'div.job-detail__content--information--text',
        NOTICE_TEXT: 'div.job-detail__content--description--notice-list--item--text',
        DETAIL_ITEM: 'div.job-detail__content--description--detail-list--item',
        DETAIL_TITLE: 'div.job-detail__content--description--detail-list--item--title',
        DETAIL_CONTENT: 'div.job-detail__content--description--detail-list--item--content',
        NOTICE_TITLE: 'div.job-detail__content--description--notice-list--item--title'
    };

    const REGEX_PATTERNS = {
        DATE_TIME: /((\d{4}年)?\d{1,2}月\d{1,2}日)(\(.\))?\s*(\d{1,2}:\d{2})～(\d{1,2}:\d{2})/,
        DATE_PARSE: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
        LOCATION: /東京都|大阪府|.+[都道府県].+[区市町村]/,
        GATHERING_TIME: /時刻：.*?(\d{1,2}:\d{2})/
    };

    /**
     * ユーティリティ関数群
     */
    class Utils {
        static getElement(selector) {
            try {
                return document.querySelector(selector);
            } catch (error) {
                Utils.log(`セレクタエラー "${selector}": ${error.message}`, 'error');
                return null;
            }
        }

        static getAllElements(selector) {
            try {
                return document.querySelectorAll(selector);
            } catch (error) {
                Utils.log(`セレクタエラー "${selector}": ${error.message}`, 'error');
                return [];
            }
        }

        static cleanText(text) {
            if (!text) return '';
            return text.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
        }

        static log(message, level = 'debug') {
            const timestamp = new Date().toLocaleTimeString();
            console[level](`[E-NEXT Calendar ${timestamp}]: ${message}`);
        }

        static padZero(num) {
            return num.toString().padStart(2, '0');
        }

        // DOM要素の存在を安全に確認
        static waitForElement(selector, timeout = 5000) {
            return new Promise((resolve) => {
                const element = Utils.getElement(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                const observer = new MutationObserver((mutations, obs) => {
                    const element = Utils.getElement(selector);
                    if (element) {
                        obs.disconnect();
                        resolve(element);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                // タイムアウト処理
                setTimeout(() => {
                    observer.disconnect();
                    Utils.log(`要素が見つかりませんでした: ${selector}`, 'warn');
                    resolve(null);
                }, timeout);
            });
        }
    }

    /**
     * 情報抽出クラス
     */
    class InfoExtractor {
        constructor() {
            this.info = {
                title: '',
                date: '',
                startTime: '',
                endTime: '',
                location: '',
                details: ''
            };
        }

        extractTitle() {
            const titleElement = Utils.getElement(SELECTORS.TITLE);
            if (titleElement) {
                this.info.title = Utils.cleanText(titleElement.textContent);
                Utils.log(`タイトル: ${this.info.title}`);
            } else {
                Utils.log('タイトルが見つかりませんでした', 'warn');
            }
        }

        extractDateTimeAndLocation() {
            const textElements = Utils.getAllElements(SELECTORS.INFO_TEXT);
            
            if (textElements.length === 0) {
                Utils.log('情報テキストが見つかりませんでした', 'warn');
                return;
            }

            textElements.forEach(element => {
                const text = Utils.cleanText(element.textContent);
                Utils.log(`情報テキスト: ${text}`);
                
                this._parseDateTime(text);
                this._parseLocation(text);
            });
        }

        _parseDateTime(text) {
            const match = text.match(REGEX_PATTERNS.DATE_TIME);
            if (!match) return;

            let dateStr = match[1];
            
            // 年がなければ今年を補完
            if (!dateStr.includes('年')) {
                const currentYear = new Date().getFullYear();
                dateStr = `${currentYear}年${dateStr}`;
            }

            const dateMatches = dateStr.match(REGEX_PATTERNS.DATE_PARSE);
            if (dateMatches && dateMatches.length === 4) {
                const [, year, month, day] = dateMatches;
                this.info.date = `${year}-${Utils.padZero(month)}-${Utils.padZero(day)}`;
                this.info.startTime = match[4];
                this.info.endTime = match[5];
                
                Utils.log(`日付: ${this.info.date}, 開始時間: ${this.info.startTime}, 終了時間: ${this.info.endTime}`);
            }
        }

        _parseLocation(text) {
            if (text.match(REGEX_PATTERNS.LOCATION)) {
                this.info.location = text;
                Utils.log(`場所: ${this.info.location}`);
            }
        }

        extractGatheringTime() {
            const noticeTexts = Utils.getAllElements(SELECTORS.NOTICE_TEXT);
            
            for (const element of noticeTexts) {
                const match = element.innerHTML.match(REGEX_PATTERNS.GATHERING_TIME);
                if (match) {
                    this.info.startTime = match[1];
                    Utils.log(`集合時刻で上書き: ${this.info.startTime}`);
                    return;
                }
            }
        }

        extractDetails() {
            let detailsContent = this._extractDetailItems();
            detailsContent += this._extractGatheringInfo();
            this.info.details = detailsContent.trim();
        }

        _extractDetailItems() {
            let content = '';
            const detailItems = Utils.getAllElements(SELECTORS.DETAIL_ITEM);
            
            if (detailItems.length === 0) {
                Utils.log('詳細リストが見つかりませんでした', 'warn');
                return content;
            }

            detailItems.forEach(item => {
                const title = item.querySelector(SELECTORS.DETAIL_TITLE)?.textContent.trim();
                const itemContent = item.querySelector(SELECTORS.DETAIL_CONTENT)?.textContent.trim();
                
                if (title && itemContent) {
                    content += `${title}: ${Utils.cleanText(itemContent)}\n`;
                }
            });

            return content;
        }

        _extractGatheringInfo() {
            const gatheringElement = Utils.getElement(SELECTORS.NOTICE_TITLE);
            
            if (!gatheringElement || !gatheringElement.textContent.includes('集合')) {
                return '';
            }

            const textElement = gatheringElement.nextElementSibling;
            if (textElement) {
                return `${gatheringElement.textContent.trim()}: ${textElement.textContent.trim()}\n`;
            } else {
                Utils.log('集合情報の次の要素が見つかりませんでした', 'warn');
                return '';
            }
        }

        getExtractedInfo() {
            return this.info;
        }
    }

    /**
     * Googleカレンダー関連のクラス
     */
    class GoogleCalendarManager {
        constructor(info) {
            this.info = info;
        }

        generateCalendarUrl() {
            if (!this._validateRequiredInfo()) {
                Utils.log('必要な情報（日付、開始時間、終了時間）が不足しています', 'error');
                return null;
            }

            const { startDate, endDate } = this._createDateObjects();
            if (!startDate || !endDate) return null;

            const params = this._buildUrlParams(startDate, endDate);
            return `${CONFIG.GOOGLE_CALENDAR_BASE_URL}?${params.toString()}`;
        }

        _validateRequiredInfo() {
            return this.info.date && this.info.startTime && this.info.endTime;
        }

        _createDateObjects() {
            const startDate = new Date(this.info.date);
            if (isNaN(startDate.getTime())) {
                Utils.log(`無効な日付: ${this.info.date}`, 'error');
                return {};
            }

            const [startHours, startMinutes] = this.info.startTime.split(':').map(Number);
            const [endHours, endMinutes] = this.info.endTime.split(':').map(Number);

            startDate.setHours(startHours, startMinutes, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(endHours, endMinutes, 0, 0);

            // 日付をまたぐ場合の処理
            if (endDate < startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }

            return { startDate, endDate };
        }

        _buildUrlParams(startDate, endDate) {
            const startISO = startDate.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
            const endISO = endDate.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

            return new URLSearchParams({
                action: 'TEMPLATE',
                text: this.info.title || '無題のイベント',
                dates: `${startISO}/${endISO}`,
                details: this.info.details || '',
                location: this.info.location || ''
            });
        }
    }

    /**
     * UI管理クラス
     */
    class UIManager {
        static async hideSearchBox() {
            try {
                // 検索ボックスの読み込みを待つ
                const searchBox = await Utils.waitForElement(SELECTORS.SEARCH_BOX, 3000);
                if (searchBox) {
                    // 検索ボックスを折りたたみ可能にする
                    UIManager._makeSearchBoxCollapsible(searchBox);
                } else {
                    Utils.log('検索ボックスが見つからないか、読み込まれていません', 'warn');
                }
            } catch (error) {
                Utils.log(`検索ボックス処理エラー: ${error.message}`, 'error');
            }
        }

        static _makeSearchBoxCollapsible(searchBox) {
            try {
                const container = searchBox.querySelector('.container');
                if (!container) {
                    Utils.log('検索ボックス内のcontainerが見つかりません', 'warn');
                    return;
                }

                // 検索フォームとソートフォームを取得
                const searchForm = container.querySelector('form[action="/work/search"]');
                const sortForm = container.querySelector('form[action="/work/order"]');

                if (!searchForm || !sortForm) {
                    Utils.log('検索フォームまたはソートフォームが見つかりません', 'warn');
                    return;
                }

                // コントロールパネルを作成
                const controlPanel = UIManager._createControlPanel();
                
                // 検索フォームを折りたたみ可能にする
                UIManager._makeFormCollapsible(searchForm, '日付検索', controlPanel, true);
                
                // ソートフォームは常に表示（コンパクトに）
                UIManager._makeSortFormCompact(sortForm);

                // コントロールパネルをコンテナの最初に挿入
                container.insertBefore(controlPanel, container.firstChild);
                
                Utils.log('検索ボックスを改良しました');
            } catch (error) {
                Utils.log(`折りたたみ機能作成エラー: ${error.message}`, 'error');
            }
        }

        static _createControlPanel() {
            const panel = document.createElement('div');
            panel.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 16px;
                border-radius: 8px 8px 0 0;
                margin-bottom: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 500;
            `;
            
            const title = document.createElement('span');
            title.textContent = '🔍 検索とフィルター';
            title.style.cssText = `
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 8px;
            `;
            
            panel.appendChild(title);
            panel.appendChild(buttonContainer);
            
            return panel;
        }

        static _makeFormCollapsible(form, label, controlPanel, startHidden = false) {
            const buttonContainer = controlPanel.querySelector('div:last-child');
            
            // 折りたたみボタンを作成
            const toggleButton = document.createElement('button');
            toggleButton.innerHTML = startHidden ? `${label} ▼` : `${label} ▲`;
            toggleButton.type = 'button';
            toggleButton.style.cssText = `
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                padding: 4px 12px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            `;
            
            // ホバー効果
            toggleButton.addEventListener('mouseenter', () => {
                toggleButton.style.background = 'rgba(255,255,255,0.3)';
                toggleButton.style.transform = 'translateY(-1px)';
            });
            
            toggleButton.addEventListener('mouseleave', () => {
                toggleButton.style.background = 'rgba(255,255,255,0.2)';
                toggleButton.style.transform = 'translateY(0)';
            });

            let isHidden = startHidden;
            
            // 初期状態設定
            if (startHidden) {
                form.style.cssText = `
                    max-height: 0;
                    overflow: hidden;
                    opacity: 0;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: translateY(-10px);
                `;
            } else {
                form.style.cssText = `
                    max-height: 1000px;
                    overflow: visible;
                    opacity: 1;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: translateY(0);
                `;
            }
            
            toggleButton.onclick = (e) => {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    isHidden = !isHidden;
                    
                    if (isHidden) {
                        // 折りたたみアニメーション
                        form.style.maxHeight = '0';
                        form.style.opacity = '0';
                        form.style.transform = 'translateY(-10px)';
                        toggleButton.innerHTML = `${label} ▼`;
                        
                        setTimeout(() => {
                            form.style.overflow = 'hidden';
                        }, 400);
                    } else {
                        // 展開アニメーション
                        form.style.overflow = 'visible';
                        form.style.maxHeight = '1000px';
                        form.style.opacity = '1';
                        form.style.transform = 'translateY(0)';
                        toggleButton.innerHTML = `${label} ▲`;
                    }
                    
                    Utils.log(`${label}を${isHidden ? '折りたたみ' : '展開'}ました`);
                } catch (error) {
                    Utils.log(`フォーム切り替えエラー: ${error.message}`, 'error');
                }
            };
            
            buttonContainer.appendChild(toggleButton);
        }

        static _makeSortFormCompact(sortForm) {
            // ソートフォームをコンパクトにスタイル調整
            sortForm.style.cssText = `
                background: #f8f9fa;
                padding: 12px;
                border-radius: 0 0 8px 8px;
                border-top: 1px solid #e9ecef;
                transition: all 0.3s ease;
            `;

            const customSelect = sortForm.querySelector('.custom-select');
            if (customSelect) {
                customSelect.style.cssText = `
                    position: relative;
                    max-width: 200px;
                    margin: 0 auto;
                `;

                // セレクトボックスにアイコンを追加
                const selectTrigger = customSelect.querySelector('.select-trigger');
                if (selectTrigger) {
                    selectTrigger.style.cssText = `
                        background: white;
                        border: 2px solid #e9ecef;
                        padding: 8px 16px;
                        border-radius: 20px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-align: center;
                        font-size: 14px;
                        position: relative;
                    `;
                    
                    // ドロップダウンアイコンを追加
                    if (!selectTrigger.querySelector('.dropdown-icon')) {
                        const icon = document.createElement('span');
                        icon.className = 'dropdown-icon';
                        icon.innerHTML = '⚙️';
                        icon.style.cssText = `
                            margin-right: 8px;
                            font-size: 12px;
                        `;
                        selectTrigger.insertBefore(icon, selectTrigger.firstChild);
                    }

                    // ホバー効果
                    selectTrigger.addEventListener('mouseenter', () => {
                        selectTrigger.style.borderColor = '#667eea';
                        selectTrigger.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    });

                    selectTrigger.addEventListener('mouseleave', () => {
                        selectTrigger.style.borderColor = '#e9ecef';
                        selectTrigger.style.boxShadow = 'none';
                    });
                }

                // オプションリストのスタイル改善
                const optionsList = customSelect.querySelector('.options');
                if (optionsList) {
                    optionsList.style.cssText = `
                        background: white;
                        border: 2px solid #e9ecef;
                        border-radius: 12px;
                        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                        backdrop-filter: blur(10px);
                        margin-top: 4px;
                        overflow: hidden;
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        z-index: 1000;
                    `;

                    // オプション項目のスタイル
                    const options = optionsList.querySelectorAll('li');
                    options.forEach(option => {
                        option.style.cssText = `
                            padding: 10px 16px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            border-bottom: 1px solid #f0f0f0;
                            font-size: 14px;
                        `;

                        option.addEventListener('mouseenter', () => {
                            option.style.background = '#667eea';
                            option.style.color = 'white';
                        });

                        option.addEventListener('mouseleave', () => {
                            if (!option.classList.contains('options--active')) {
                                option.style.background = 'white';
                                option.style.color = 'black';
                            }
                        });

                        // アクティブ項目のスタイル
                        if (option.classList.contains('options--active')) {
                            option.style.background = '#667eea';
                            option.style.color = 'white';
                        }
                    });
                }
            }
        }

        static createCalendarButton(calendarManager) {
            try {
                const button = document.createElement('button');
                button.textContent = 'Googleカレンダーに追加';
                button.style.cssText = CONFIG.BUTTON_STYLES;
                
                button.onclick = () => {
                    try {
                        const url = calendarManager.generateCalendarUrl();
                        if (url) {
                            window.open(url, '_blank');
                            Utils.log('カレンダーURLを開きました');
                        } else {
                            const message = 'イベントを追加できません。必要な情報（日付や時間）が不足しています。';
                            alert(message);
                            Utils.log(message, 'warn');
                        }
                    } catch (error) {
                        Utils.log(`カレンダーボタンクリックエラー: ${error.message}`, 'error');
                        alert('エラーが発生しました。コンソールを確認してください。');
                    }
                };

                document.body.appendChild(button);
                Utils.log('カレンダー追加ボタンを作成しました');
            } catch (error) {
                Utils.log(`カレンダーボタン作成エラー: ${error.message}`, 'error');
            }
        }
    }

    /**
     * アプリケーションのメインクラス
     */
    class App {
        static async init() {
            try {
                Utils.log('アプリケーションを開始します');

                // 検索ボックスの非表示（全ページ共通）
                await UIManager.hideSearchBox();

                // 求人詳細ページでない場合は終了
                if (!location.pathname.startsWith('/work/detail/')) {
                    Utils.log('求人詳細ページではありません。処理を終了します');
                    return;
                }

                Utils.log('求人詳細ページでの処理を開始します');

                const extractor = new InfoExtractor();
                
                // 情報の抽出（エラーハンドリング付き）
                await App._extractInformationSafely(extractor);

                const extractedInfo = extractor.getExtractedInfo();
                const calendarManager = new GoogleCalendarManager(extractedInfo);
                
                // ボタンの作成
                UIManager.createCalendarButton(calendarManager);

                Utils.log('アプリケーションの初期化が完了しました');
            } catch (error) {
                Utils.log(`実行中に予期しないエラーが発生しました: ${error.message}`, 'error');
                console.error('Full error:', error);
                // ユーザーにはエラーの詳細を表示しない（セキュリティ考慮）
                // alert('処理中にエラーが発生しました。');
            }
        }

        static async _extractInformationSafely(extractor) {
            try {
                extractor.extractTitle();
                extractor.extractDateTimeAndLocation();
                extractor.extractGatheringTime();
                extractor.extractDetails();
            } catch (error) {
                Utils.log(`情報抽出エラー: ${error.message}`, 'error');
                // 一部の情報抽出が失敗しても処理を続行
            }
        }
    }

    // アプリケーション開始（DOM読み込み完了を待つ）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', App.init);
    } else {
        // すでに読み込み済みの場合は即座に実行
        App.init();
    }
})();

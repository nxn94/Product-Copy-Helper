// ==UserScript==
// @name         Product-Copy-Helper
// @namespace    nxn94_Product-Copy-Helper
// @version      1.0.4
// @description  Copy the product title, link, or item number and price, including whether it's net or gross
// @match        *://*.amazon.de/*
// @match        *://*.ebay.de/*
// @match        *://*.ipc-computer.de/*
// @match        *://*.touchandscreen.de/*
// @match        *://*.eetgroup.com/*
// @match        *://*.smartpart4u.de/*
// @match        *://*.accessoires-asus.com/*
// @match        *://*.fixpart.de/*
// @match        *://*.aswo.com/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /*
     * Normale Shops laufen nur im Hauptfenster. Bei ASWO befindet sich die
     * eigentliche Produktseite jedoch in einem eingebetteten Dokument.
     * Dort darf das Skript deshalb ebenfalls laufen.
     */
    const CURRENT_HOST = location.hostname.toLowerCase();
    const CURRENT_IS_ASWO =
        CURRENT_HOST === 'shop.aswo.com' ||
        CURRENT_HOST.endsWith('.aswo.com');

    if (!CURRENT_IS_ASWO && window.top !== window.self) {
        return;
    }

    const BUTTON_ID = 'vm-product-copy-button';
    const INSTANCE_ATTRIBUTE = 'data-vm-product-copy-owner';

    /*
     * Steuerart der Shops.
     * Amazon erkennt netto/brutto automatisch.
     * Nicht aufgeführte Shops werden standardmäßig als brutto markiert.
     */
    const SHOP_TAX_TYPES = {
        'shop.aswo.com': 'netto',
        'aswo.com': 'netto',
        'eetgroup.com': 'netto',
        'ebay.de': 'brutto',
        'ebay.com': 'brutto',
        'ipc-computer.de': 'brutto',
        'touchandscreen.de': 'brutto',
        'smartpart4u.de': 'brutto',
        'accessoires-asus.com': 'brutto',
        'fixpart.de': 'brutto'
    };

    const DEFAULT_TAX_TYPE = 'brutto';

    const SHOP_SELECTORS = {
        'amazon.': {
            title: ['#productTitle', 'h1'],
            price: [
                '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
                '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
                '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
                '.priceToPay .a-offscreen',
                '#price_inside_buybox',
                '#newBuyBoxPrice'
            ]
        },
        'ebay.': {
            title: ['h1.x-item-title__mainTitle span', 'h1.x-item-title__mainTitle', 'h1'],
            price: ['.x-price-primary span', '.x-price-section .ux-textspans', '[itemprop="price"]']
        },
        'ipc-computer.de': {
            title: ['h1.product-detail-name', '.product-detail-name', 'h1'],
            price: ['.product-detail-price', '.product-detail-price-container .price', '[itemprop="price"]', '.price']
        },
        'touchandscreen.de': {
            title: ['.product--title', '.product-detail-name', 'h1'],
            price: ['[itemprop="price"]', '.product--price', '.product-detail-price', '.price']
        },
        'eetgroup.com': {
            title: ['[data-testid="product-title"]', '.product-title', 'h1'],
            price: ['[data-testid="product-price"]', '[itemprop="price"]', '.product-price', '.price']
        },
        'smartpart4u.de': {
            title: ['h1.product-detail-name', '.product-detail-name', 'h1'],
            price: ['.product-detail-price', '[itemprop="price"]', '.price']
        },
        'accessoires-asus.com': {
            title: ['[itemprop="name"]', '.product-title', 'h1'],
            price: ['#prixFinalArticleV2', '[itemprop="price"]', '.product-price', '.current-price', '.price']
        },
        'fixpart.de': {
            title: ['[data-testid="product-title"]', '[itemprop="name"]', '.product-title', 'h1'],
            price: ['[data-testid="product-price"]', '[itemprop="price"]', '.product-price', '.price']
        }
    };

    const GENERIC_TITLE_SELECTORS = [
        '[itemprop="name"]',
        '[data-testid="product-title"]',
        '[data-test="product-title"]',
        '.product-title',
        '.product-detail-name',
        '.product--title',
        'main h1',
        'article h1',
        'h1'
    ];

    const GENERIC_PRICE_SELECTORS = [
        '[itemprop="price"][content]',
        '[itemprop="price"]',
        '[data-testid="product-price"]',
        '[data-test="product-price"]',
        '[data-price]',
        '.product-detail-price',
        '.product-price',
        '.current-price',
        '.sales-price',
        '.special-price',
        '.offer-price',
        '.price--current',
        '.price-current',
        '.price__current',
        '.product--price',
        '.price'
    ];

    function normalize(value) {
        return String(value || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function elementValue(element) {
        if (!element) return '';

        return normalize(
            element.getAttribute('content') ||
            element.getAttribute('data-price') ||
            element.getAttribute('value') ||
            element.textContent
        );
    }

    function firstValue(selectors, validator) {
        for (const selector of selectors) {
            let elements;

            try {
                elements = document.querySelectorAll(selector);
            } catch (error) {
                continue;
            }

            for (const element of elements) {
                const value = elementValue(element);
                if (value && (!validator || validator(value, element))) return value;
            }
        }

        return '';
    }

    function currentShop() {
        const hostname = location.hostname.toLowerCase();

        for (const domain of Object.keys(SHOP_SELECTORS)) {
            if (hostname.includes(domain)) return SHOP_SELECTORS[domain];
        }

        return null;
    }

    function isAmazon() {
        return location.hostname.toLowerCase().includes('amazon.');
    }

    function isAswo() {
        const hostname = location.hostname.toLowerCase();
        return hostname === 'shop.aswo.com' || hostname.endsWith('.aswo.com');
    }

    function taxTypeForCurrentShop() {
        if (isAswo()) return 'netto';

        const hostname = location.hostname.toLowerCase().replace(/^www\./, '');

        for (const domain of Object.keys(SHOP_TAX_TYPES)) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
                return SHOP_TAX_TYPES[domain];
            }
        }

        return DEFAULT_TAX_TYPE;
    }

    function addTaxLabel(price) {
        const normalizedPrice = normalize(price);
        if (!normalizedPrice) return '';

        // Bereits gekennzeichnete Preise nicht doppelt beschriften.
        if (/\bnetto\b|\bbrutto\b/i.test(normalizedPrice)) {
            return normalizedPrice;
        }

        return normalizedPrice + ' ' + taxTypeForCurrentShop();
    }

    function jsonLdProducts() {
        const products = [];

        function inspect(value) {
            if (!value) return;

            if (Array.isArray(value)) {
                value.forEach(inspect);
                return;
            }

            if (typeof value !== 'object') return;

            const type = value['@type'];
            const types = Array.isArray(type) ? type : [type];

            if (types.some(item => String(item || '').toLowerCase() === 'product')) {
                products.push(value);
            }

            Object.values(value).forEach(inspect);
        }

        document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try {
                inspect(JSON.parse(script.textContent));
            } catch (error) {
                // Ungültige JSON-LD-Blöcke werden ignoriert.
            }
        });

        return products;
    }

    function looksLikePrice(value) {
        return Boolean(value) &&
            value.length <= 120 &&
            (/(?:€|EUR|\$|USD|£|GBP|CHF)/i.test(value) || /\d+[.,]\d{2}/.test(value));
    }

    function extractPrice(value) {
        const text = normalize(value);
        let match;

        match = text.match(/(?:ab\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)\s*(?:€|EUR)/i);
        if (match) return match[1] + ' €';

        match = text.match(/(?:€|EUR)\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)/i);
        if (match) return match[1] + ' €';

        match = text.match(/(?:\$|USD)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
        if (match) return '$' + match[1];

        match = text.match(/(?:£|GBP)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
        if (match) return '£' + match[1];

        match = text.match(/(?:CHF)\s*(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})?)/i);
        if (match) return match[1] + ' CHF';

        match = text.match(/\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})/);
        return match ? match[0] + ' €' : text;
    }

    function aswoArticleNumber() {
        if (!isAswo()) return '';

        const articleNumberElement = document.querySelector(
            '.article_number, [title="ASWO Artikelnummer"]'
        );

        if (articleNumberElement) {
            const match = normalize(articleNumberElement.textContent).match(/#?([A-Z]\d{5,})\b/i);
            if (match) return '#' + match[1].toUpperCase();
        }

        const pageText = normalize(document.body ? document.body.innerText : '');
        let match = pageText.match(
            /(?:ASWO\s*)?(?:Artikel(?:nummer|nr\.?|\s*Nr\.?)|Art\.?\s*-?\s*Nr\.?)\s*[:#]?\s*#?([A-Z]\d{5,})/i
        );

        if (!match) match = pageText.match(/#([A-Z]\d{5,})\b/i);
        return match ? '#' + match[1].toUpperCase() : '';
    }

    function aswoProductTitle() {
        if (!isAswo()) return '';

        const selectors = [
            '[id*="articleDescription" i]',
            '[id*="designation" i]',
            '[id*="articleName" i]',
            '[class*="articleDescription" i]',
            '[class*="designation" i]',
            '[class*="articleName" i]',
            '.product-title',
            'main h1',
            'h1',
            'h2'
        ];

        const articleNumber = aswoArticleNumber().replace('#', '');

        return firstValue(selectors, value => {
            const text = normalize(value);
            return text.length >= 3 &&
                text.length <= 250 &&
                text !== 'ASWO DE' &&
                text !== articleNumber &&
                text !== '#' + articleNumber;
        });
    }

    function parseEuroNumber(value) {
        const match = normalize(value).match(
            /(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*€?/
        );

        if (!match) return null;

        const number = Number(
            match[1]
                .replace(/[.\s]/g, '')
                .replace(',', '.')
        );

        return Number.isFinite(number) ? number : null;
    }

    function isStruckThrough(element) {
        if (!element) return false;

        if (element.matches('s, strike, del')) {
            return true;
        }

        const inlineStyle = String(
            element.getAttribute('style') || ''
        );

        if (/line-through/i.test(inlineStyle)) {
            return true;
        }

        try {
            return /line-through/i.test(
                window.getComputedStyle(element).textDecorationLine || ''
            );
        } catch (error) {
            return false;
        }
    }

    function aswoReducedPrice() {
        if (!isAswo()) return '';

        /*
         * Zuerst typische Bezeichnungen für Aktions- und Sonderpreise.
         */
        const explicitReducedSelectors = [
            '[id*="specialPrice" i]',
            '[id*="salePrice" i]',
            '[id*="reducedPrice" i]',
            '[id*="discountPrice" i]',
            '[id*="aktionspreis" i]',
            '[id*="sonderpreis" i]',
            '[class*="specialPrice" i]',
            '[class*="salePrice" i]',
            '[class*="reducedPrice" i]',
            '[class*="discountPrice" i]',
            '[class*="aktionspreis" i]',
            '[class*="sonderpreis" i]',
            '[class*="reduced" i]',
            '[class*="discount" i]'
        ];

        const explicitPrice = firstValue(
            explicitReducedSelectors,
            (value, element) => {
                return looksLikePrice(value) &&
                    parseEuroNumber(value) !== null &&
                    !isStruckThrough(element);
            }
        );

        if (explicitPrice) {
            return extractPrice(explicitPrice) + ' netto';
        }

        /*
         * ASWO zeigt bei reduzierten Artikeln den alten Preis
         * durchgestrichen und den gültigen Preis im selben Preisblock.
         */
        const oldPriceElements = Array.from(
            document.querySelectorAll('s, strike, del, [style*="line-through" i], [class*="oldPrice" i], [class*="old_price" i]')
        ).filter(element => {
            return looksLikePrice(elementValue(element)) &&
                parseEuroNumber(elementValue(element)) !== null;
        });

        /*
         * Falls die Durchstreichung nur per CSS-Klasse gesetzt wird,
         * werden zusätzlich kompakte Preiselemente geprüft.
         */
        document.querySelectorAll(
            '[id*="price" i], [class*="price" i], span, div'
        ).forEach(element => {
            const value = elementValue(element);

            if (
                value.length <= 40 &&
                looksLikePrice(value) &&
                parseEuroNumber(value) !== null &&
                isStruckThrough(element) &&
                !oldPriceElements.includes(element)
            ) {
                oldPriceElements.push(element);
            }
        });

        for (const oldPriceElement of oldPriceElements) {
            const oldPriceNumber = parseEuroNumber(
                elementValue(oldPriceElement)
            );

            if (oldPriceNumber === null) continue;

            let container = oldPriceElement.parentElement;

            /*
             * Einen kleinen gemeinsamen Preisblock suchen, nicht die
             * gesamte Seite. So werden Warenkorb- und Kopfpreise vermieden.
             */
            while (
                container &&
                container !== document.body &&
                normalize(container.innerText).length < 12
            ) {
                container = container.parentElement;
            }

            if (!container || container === document.body) {
                continue;
            }

            const containerText = normalize(container.innerText);

            if (containerText.length > 500) {
                continue;
            }

            const candidates = [];

            container.querySelectorAll(
                '[id*="price" i], [class*="price" i], span, div, strong, b'
            ).forEach(element => {
                const value = elementValue(element);
                const number = parseEuroNumber(value);

                if (
                    number === null ||
                    number <= 0 ||
                    value.length > 40 ||
                    element === oldPriceElement ||
                    oldPriceElement.contains(element) ||
                    isStruckThrough(element)
                ) {
                    return;
                }

                if (number < oldPriceNumber) {
                    candidates.push({
                        element: element,
                        value: value,
                        number: number
                    });
                }
            });

            /*
             * Der reduzierte Preis steht normalerweise nach dem alten Preis.
             * Kandidaten danach werden daher bevorzugt, anschließend der
             * niedrigste Preis innerhalb dieses Preisblocks.
             */
            candidates.sort((a, b) => {
                const aAfter = Boolean(
                    oldPriceElement.compareDocumentPosition(a.element) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );
                const bAfter = Boolean(
                    oldPriceElement.compareDocumentPosition(b.element) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );

                if (aAfter !== bAfter) {
                    return aAfter ? -1 : 1;
                }

                return a.number - b.number;
            });

            if (candidates.length > 0) {
                return extractPrice(candidates[0].value) + ' netto';
            }
        }

        return '';
    }

    function aswoNetPrice() {
        if (!isAswo()) return '';

        /*
         * Ein reduzierter Preis hat immer Vorrang vor dem
         * durchgestrichenen ursprünglichen Preis.
         */
        const reducedPrice = aswoReducedPrice();

        if (reducedPrice) {
            return reducedPrice;
        }

        const bodyText = normalize(
            document.body ? document.body.innerText : ''
        );

        const labelledPatterns = [
            /(?:Netto(?:preis)?|Preis\s*netto|Ihr\s*Preis|EK(?:-Preis)?|Einkaufspreis)\s*[:]?\s*(?:€|EUR)?\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*(?:€|EUR)?/i,
            /(?:€|EUR)\s*(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*(?:netto|exkl\.?\s*(?:USt|MwSt))/i,
            /(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*(?:€|EUR)\s*(?:netto|exkl\.?\s*(?:USt|MwSt))/i
        ];

        for (const pattern of labelledPatterns) {
            const match = bodyText.match(pattern);
            if (match) return match[1] + ' € netto';
        }

        const selectors = [
            '[id*="netPrice" i]',
            '[id*="netto" i]',
            '[id*="price" i]',
            '[class*="netPrice" i]',
            '[class*="netto" i]',
            '[class*="price" i]'
        ];

        const selectedPrice = firstValue(
            selectors,
            (value, element) => {
                return looksLikePrice(value) &&
                    !/^€?\s*0[,.]00\s*€?$/i.test(normalize(value)) &&
                    !isStruckThrough(element);
            }
        );

        if (selectedPrice) {
            return extractPrice(selectedPrice) + ' netto';
        }

        const allPrices = bodyText.match(
            /(?:€\s*)?\d{1,3}(?:[.\s]\d{3})*,\d{2}\s*€?/g
        ) || [];

        const usablePrice = allPrices
            .map(normalize)
            .find(value => !/0,00/.test(value));

        return usablePrice
            ? extractPrice(usablePrice) + ' netto'
            : '';
    }

    function productTitle() {
        if (isAswo()) {
            const aswoTitle = aswoProductTitle();
            if (aswoTitle) return aswoTitle;
        }

        const shop = currentShop();
        const shopTitle = firstValue(shop ? shop.title : []);
        if (shopTitle) return shopTitle;

        const product = jsonLdProducts()[0];
        if (product && product.name) return normalize(product.name);

        const metaTitle = document.querySelector('meta[property="og:title"]');
        if (metaTitle && metaTitle.content) return normalize(metaTitle.content);

        return firstValue(GENERIC_TITLE_SELECTORS) || normalize(document.title) || 'Produkt';
    }

    function amazonPriceWithTaxInformation() {
        if (!isAmazon()) return '';

        const netPriceElement = document.querySelector([
            '.priceblock_vat_excl_price .a-offscreen',
            '.priceblock_vat_excl_price .a-price .a-offscreen',
            '[class*="vat_excl"] .a-offscreen',
            '[class*="vat-excl"] .a-offscreen'
        ].join(', '));

        if (netPriceElement) {
            const netPrice = extractPrice(netPriceElement.textContent);
            if (netPrice && looksLikePrice(netPrice)) return netPrice + ' netto';
        }

        const grossPriceElement = document.querySelector([
            '.priceblock_vat_inc_price .a-offscreen',
            '.priceblock_vat_inc_price .a-price .a-offscreen',
            '[class*="vat_inc"] .a-offscreen',
            '[class*="vat-incl"] .a-offscreen'
        ].join(', '));

        if (grossPriceElement) {
            const grossPrice = extractPrice(grossPriceElement.textContent);
            if (grossPrice && looksLikePrice(grossPrice)) return grossPrice + ' brutto';
        }

        const possiblePriceContainers = document.querySelectorAll([
            '[class*="priceblock_vat"]',
            '#corePrice_feature_div',
            '#corePriceDisplay_desktop_feature_div',
            '#apex_desktop',
            '.priceToPay',
            '.reinventPricePriceToPayMargin'
        ].join(', '));

        const netPrices = [];
        const grossPrices = [];
        const standardPrices = [];

        for (const container of possiblePriceContainers) {
            const context = normalize(container.textContent);
            const priceElements = container.querySelectorAll('.a-price .a-offscreen, .a-offscreen');

            for (const priceElement of priceElements) {
                const rawPrice = normalize(priceElement.textContent);
                if (!looksLikePrice(rawPrice)) continue;

                const formattedPrice = extractPrice(rawPrice);
                const isNetPrice = /exkl\.?\s*(ust|mwst)\.?|zzgl\.?\s*(ust|mwst)\.?|ohne\s*(ust|mwst)\.?|\bnetto\b|excl\.?\s*(vat|tax)|excluding\s*(vat|tax)|ex\s*vat/i.test(context);
                const isGrossPrice = /inkl\.?\s*(ust|mwst)\.?|einschl\.?\s*(ust|mwst)\.?|\bbrutto\b|incl\.?\s*(vat|tax)|including\s*(vat|tax)/i.test(context);

                if (isNetPrice && !netPrices.includes(formattedPrice)) {
                    netPrices.push(formattedPrice);
                } else if (isGrossPrice && !grossPrices.includes(formattedPrice)) {
                    grossPrices.push(formattedPrice);
                } else if (!isNetPrice && !isGrossPrice && !standardPrices.includes(formattedPrice)) {
                    standardPrices.push(formattedPrice);
                }
            }
        }

        if (netPrices.length > 0) return netPrices[0] + ' netto';
        if (grossPrices.length > 0) return grossPrices[0] + ' brutto';

        const standardPrice = firstValue([
            '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
            '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
            '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
            '.reinventPricePriceToPayMargin .a-price:not(.a-text-price) .a-offscreen',
            '.priceToPay .a-offscreen',
            '#price_inside_buybox',
            '#newBuyBoxPrice'
        ], looksLikePrice);

        if (standardPrice) return extractPrice(standardPrice) + ' brutto';
        return standardPrices.length > 0 ? standardPrices[0] + ' brutto' : '';
    }

    function structuredPrice() {
        const product = jsonLdProducts()[0];
        if (!product || !product.offers) return '';

        const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
        const offer = offers.find(item => item && (item.price !== undefined || item.lowPrice !== undefined));
        if (!offer) return '';

        const rawPrice = offer.price !== undefined ? offer.price : offer.lowPrice;
        const currency = offer.priceCurrency || 'EUR';
        const numericPrice = Number(rawPrice);
        const formattedPrice = Number.isFinite(numericPrice)
            ? numericPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : normalize(rawPrice);

        return currency === 'EUR' ? formattedPrice + ' €' : formattedPrice + ' ' + currency;
    }

    function productPrice() {
        if (isAswo()) return aswoNetPrice();

        if (isAmazon()) {
            const amazonPrice = amazonPriceWithTaxInformation();
            if (amazonPrice) return amazonPrice;
        }

        const shop = currentShop();
        const shopPrice = firstValue(shop ? shop.price : [], looksLikePrice);
        if (shopPrice) return addTaxLabel(extractPrice(shopPrice));

        const jsonPrice = structuredPrice();
        if (jsonPrice) return addTaxLabel(jsonPrice);

        const metaPrice = document.querySelector(
            'meta[property="product:price:amount"], meta[property="og:price:amount"]'
        );

        if (metaPrice && metaPrice.content) {
            const currencyMeta = document.querySelector(
                'meta[property="product:price:currency"], meta[property="og:price:currency"]'
            );
            const currency = currencyMeta && currencyMeta.content ? currencyMeta.content : 'EUR';
            const numericPrice = Number(metaPrice.content);
            const formattedPrice = Number.isFinite(numericPrice)
                ? numericPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : normalize(metaPrice.content);
            const result = currency === 'EUR' ? formattedPrice + ' €' : formattedPrice + ' ' + currency;
            return addTaxLabel(result);
        }

        const genericPrice = firstValue(GENERIC_PRICE_SELECTORS, looksLikePrice);
        return genericPrice ? addTaxLabel(extractPrice(genericPrice)) : '';
    }

    function productReference() {
        if (isAswo()) {
            return {
                type: 'Artikelnummer',
                value: aswoArticleNumber() || 'nicht gefunden'
            };
        }

        const canonical = document.querySelector('link[rel="canonical"]');
        let url;

        try {
            url = new URL(canonical && canonical.href ? canonical.href : location.href);
        } catch (error) {
            return { type: 'Link', value: location.href };
        }

        url.hash = '';

        const amazonMatch = url.pathname.match(
            /\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)/i
        );

        if (amazonMatch && url.hostname.includes('amazon.')) {
            return {
                type: 'Link',
                value: url.origin + '/dp/' + amazonMatch[1].toUpperCase()
            };
        }

        const ebayMatch = url.pathname.match(
            /\/itm\/(?:[^/]+\/)?(\d{9,15})(?:[/?]|$)/i
        );

        if (ebayMatch && url.hostname.includes('ebay.')) {
            return {
                type: 'Link',
                value: url.origin + '/itm/' + ebayMatch[1]
            };
        }

        for (const parameter of Array.from(url.searchParams.keys())) {
            if (/^(utm_|tag$|ref$|ref_|camp$|campaign$|creative$|linkCode$|qid$|sr$|srsltid$|mkevt$|mkcid$|mkrid$|siteid$|customid$|toolid$)/i.test(parameter)) {
                url.searchParams.delete(parameter);
            }
        }

        return { type: 'Link', value: url.toString() };
    }

    function clipboardContent() {
        const title = productTitle();
        const price = productPrice() || 'nicht gefunden';
        const reference = productReference();
        const referenceLine = reference.type === 'Artikelnummer'
            ? 'Artikelnummer: ' + reference.value
            : reference.value;

        const plainText = title + '\n' + referenceLine + '\nPreis: ' + price + '\n';
        const safeTitle = escapeHtml(title);
        const safePrice = escapeHtml(price);
        let htmlReference;

        if (reference.type === 'Artikelnummer') {
            htmlReference = '<div>Artikelnummer: ' + escapeHtml(reference.value) + '</div>';
        } else {
            const safeUrl = escapeHtml(reference.value);
            htmlReference =
                '<div><a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" title="' + safeUrl + '">' +
                safeUrl +
                '</a></div>';
        }

        const html =
            '<div>' + safeTitle + '</div>' +
            htmlReference +
            '<div>Preis: ' + safePrice + '</div>' +
            '<br>';

        return { html, plainText, price, reference };
    }

    async function copyProduct() {
        const content = clipboardContent();

        if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([content.html], { type: 'text/html' }),
                    'text/plain': new Blob([content.plainText], { type: 'text/plain' })
                });

                await navigator.clipboard.write([clipboardItem]);
                return content;
            } catch (error) {
                console.debug('Clipboard API fehlgeschlagen:', error);
            }
        }

        GM_setClipboard(content.plainText, 'text/plain');
        return content;
    }

    function createButton() {
        if (!document.body) return;

        /*
         * Alte oder doppelt erzeugte Buttons entfernen. Anschließend bleibt
         * genau ein Button im Hauptdokument übrig.
         */
        const existingButtons = Array.from(
            document.querySelectorAll('#' + BUTTON_ID + ', [' + INSTANCE_ATTRIBUTE + ']')
        );

        if (existingButtons.length > 0) {
            existingButtons.slice(1).forEach(element => element.remove());
            return;
        }

        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.setAttribute(INSTANCE_ATTRIBUTE, 'main');
        button.type = 'button';
        button.textContent = 'Produkt kopieren';
        button.title = 'Produkttitel, Referenz und Preis kopieren';
        button.style.cssText = [
            'position:fixed',
            'right:18px',
            'bottom:18px',
            'z-index:2147483647',
            'padding:11px 16px',
            'border:0',
            'border-radius:10px',
            'background:#1666c5',
            'color:#fff',
            'font:600 14px Arial,sans-serif',
            'box-shadow:0 4px 16px rgba(0,0,0,.28)',
            'cursor:pointer',
            'opacity:.96'
        ].join(';');

        button.addEventListener('click', async function () {
            const originalText = button.textContent;

            try {
                const content = await copyProduct();

                if (content.reference.value === 'nicht gefunden') {
                    button.textContent = 'Kopiert, Artikelnr. fehlt';
                    button.style.background = '#a15c00';
                } else if (content.price === 'nicht gefunden') {
                    button.textContent = 'Kopiert, Preis fehlt';
                    button.style.background = '#a15c00';
                } else {
                    button.textContent = 'Kopiert!';
                    button.style.background = '#17833b';
                }
            } catch (error) {
                console.error('Kopieren fehlgeschlagen:', error);
                button.textContent = 'Fehler beim Kopieren';
                button.style.background = '#b42318';
            }

            window.setTimeout(function () {
                button.textContent = originalText;
                button.style.background = '#1666c5';
            }, 1800);
        });

        document.body.appendChild(button);
    }

    function hasAswoProductData() {
        return Boolean(
            document.querySelector(
                '.article_number, [title="ASWO Artikelnummer"]'
            )
        );
    }

    function keepButtonAvailable() {
        function updateButton() {
            /*
             * Auf ASWO nur in genau dem Dokument einen Button anzeigen,
             * das auch die Artikelnummer und damit die Produktdaten enthält.
             * Homepage-, Menü- und Hilfsframes bleiben ohne Button.
             */
            if (isAswo() && !hasAswoProductData()) {
                const existingButton = document.getElementById(BUTTON_ID);

                if (existingButton) {
                    existingButton.remove();
                }

                return;
            }

            if (!document.getElementById(BUTTON_ID) && document.body) {
                createButton();
            }
        }

        updateButton();

        const observer = new MutationObserver(function () {
            updateButton();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    if (document.body) {
        keepButtonAvailable();
    } else {
        window.addEventListener(
            'DOMContentLoaded',
            keepButtonAvailable,
            { once: true }
        );
    }

})();

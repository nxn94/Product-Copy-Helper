# Product Copy Helper

A userscript for copying product information from supported online shops in a clean, reusable format.

The script adds a **Copy product** button to configured product pages and copies the following information:

- Product title
- Product URL, or the article number for ASWO
- Current product price
- Net or gross price label

It supports both rich-text and plain-text clipboard output. When pasted into a rich-text editor, product URLs remain clickable.

## Example Output

### Standard shop

```text
Bosch Cordless Drill XYZ
https://www.amazon.de/dp/XXXXXXXXXX
Price: 129.00 EUR gross
```

### ASWO

```text
Replacement part description
Article number: #C722946
Price: 15.80 EUR net
```

## Features

- Adds a floating **Copy product** button to supported shop pages
- Copies product title, reference, and price with one click
- Creates clickable links in rich-text applications
- Includes a plain-text clipboard fallback
- Removes common tracking parameters from copied URLs
- Shortens Amazon URLs to the `/dp/ASIN` format
- Shortens eBay URLs to the `/itm/ITEM_NUMBER` format
- Labels prices as `net` or `gross`
- Detects Amazon Business prices excluding and including VAT
- Prefers Amazon prices excluding VAT when available
- Uses the ASWO article number instead of the session-dependent product URL
- Detects reduced ASWO prices and ignores struck-through original prices
- Supports dynamically loaded ASWO product pages and embedded product documents
- Runs only on configured shop domains

## Supported Shops

The script currently contains dedicated configuration for:

- Amazon Germany
- eBay Germany
- IPC-Computer
- Touch and Screen
- EET Group
- Smartpart4u
- Accessoires Asus
- FixPart
- ASWO Shop

Generic product metadata and common product selectors are used as fallbacks where appropriate.

## Shop-Specific Behavior

### Amazon

Amazon prices are checked in the following order:

1. Price excluding VAT
2. Price including VAT
3. A price block with a recognizable VAT label
4. The regular visible Amazon product price

Example:

```text
Price: 15.80 EUR net
```

If no net price is available:

```text
Price: 18.80 EUR gross
```

### ASWO

ASWO product URLs are session-dependent and are therefore not copied. The script copies the ASWO article number instead:

```text
Article number: #C722946
```

ASWO prices are considered net prices.

For discounted products, the script attempts to identify a struck-through original price and then selects the lower, non-struck-through price from the same price area.

The ASWO product content may be loaded inside an embedded document. The script therefore shows the button only in the document that contains the product's `.article_number` element.

### Accessoires Asus

The final article price is read preferentially from:

```css
#prixFinalArticleV2
```

## Installation

### Violentmonkey

1. Install [Violentmonkey](https://violentmonkey.github.io/) in a compatible browser.
2. Open the userscript file from this repository.
3. Confirm the installation in Violentmonkey.
4. Open or reload a supported product page.
5. Click the **Copy product** button in the lower-right corner.

### Manual installation

1. Open the Violentmonkey dashboard.
2. Create a new userscript.
3. Copy the complete contents of `produktdaten-kopieren.user.js` into the editor.
4. Save the script.
5. Reload the product page.

## Browser Compatibility

The script is primarily developed and tested with:

- Brave
- Violentmonkey

It should also work in other Chromium-based browsers supported by Violentmonkey. Clipboard behavior may differ depending on browser permissions and the application into which the content is pasted.

## Clipboard Formats

The script attempts to write two clipboard formats:

- `text/html` for rich-text applications
- `text/plain` as a fallback

Rich-text output includes a clickable product link. Plain-text output contains the visible URL without HTML markup.

For ASWO, the article number is copied as text instead of a link.

## Price Tax Configuration

Shop-specific net or gross behavior is configured in `SHOP_TAX_TYPES`:

```javascript
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
```

The script currently uses the German output labels `netto` and `brutto`. These labels can be changed directly in the userscript if English output is preferred.

Unknown shops default to the value configured in:

```javascript
const DEFAULT_TAX_TYPE = 'brutto';
```

## Adding Another Shop

### 1. Add a metadata match rule

Add the shop domain to the userscript metadata block:

```javascript
// @match        *://*.example-shop.com/*
```

### 2. Add shop selectors

Add a new entry to `SHOP_SELECTORS`:

```javascript
'example-shop.com': {
    title: [
        'h1.product-title',
        'h1'
    ],
    price: [
        '.product-price',
        '[itemprop="price"]'
    ]
}
```

Selectors are checked from top to bottom. Put the most precise selector first.

### 3. Configure the tax type

Add the domain to `SHOP_TAX_TYPES`:

```javascript
'example-shop.com': 'brutto'
```

Use either:

- `netto`
- `brutto`

### 4. Test the result

Verify that the copied output contains:

- The correct product title
- The intended product URL or reference
- The current selling price rather than an old or recommended price
- The correct net or gross label

## Updating Site Selectors

Online shops may change their HTML structure without notice. If a shop stops working:

1. Open the product page.
2. Use the browser developer tools to inspect the title and current price.
3. Identify a stable ID, class, `data-*` attribute, or Schema.org property.
4. Add the selector before generic fallback selectors.
5. Avoid dynamically generated class names where possible.

A stable ID such as:

```css
#prixFinalArticleV2
```

is generally preferable to a generic selector such as:

```css
.price
```

## Privacy

The userscript processes page content locally in the browser.

It does not intentionally:

- Send product data to an external service
- Track browsing history
- Create user accounts
- Store copied products remotely

The script only reads product information from the currently opened page and writes the formatted result to the clipboard after the user clicks the button.

## Known Limitations

- Shop layouts can change and may require selector updates.
- Product variations may display different prices depending on the selected option.
- Login-protected shops can only be processed after the user has logged in normally.
- Dynamically loaded prices may not be available immediately.
- Generic price selectors may occasionally detect a secondary price if a shop does not expose a stable product-price element.
- Tax labels depend on the configured behavior of each shop unless the page provides an explicit VAT indication.
- Discount detection relies on the original price being visibly struck through and the reduced price appearing in the same price area.

## Troubleshooting

### The button does not appear

- Confirm that the userscript is enabled.
- Confirm that the shop domain is included in the `@match` rules.
- Reload the page with a full refresh.
- Check the Violentmonkey editor for syntax errors.
- Check whether the product area is loaded inside an embedded document.

### Multiple buttons appear

- Make sure only one version of the userscript is enabled in Violentmonkey.
- Remove or disable older test versions.
- Check whether the script is running in multiple frames.

### The wrong price is copied

- Inspect the current price element with browser developer tools.
- Add its selector before the generic selectors.
- Check whether the page contains a struck-through original price, a recommended retail price, or a price for another product variation.

### Rich-text links are not preserved

The destination application may only accept plain text. In that case, the URL is still copied, but it will not necessarily be inserted as an HTML link.

## Development

The userscript is plain JavaScript and does not require a build step.

Recommended workflow:

1. Edit `produktdaten-kopieren.user.js`.
2. Increase the `@version` value.
3. Check the file for JavaScript syntax errors.
4. Test at least one regular shop, Amazon, and ASWO.
5. Commit the change with a short description of the affected shop or feature.

Example syntax check with Node.js:

```bash
node --check produktdaten-kopieren.user.js
```

## Suggested Repository Structure

```text
.
├── README.md
├── produktdaten-kopieren.user.js
├── LICENSE
└── CHANGELOG.md
```

## Contributing

Bug reports and selector updates are welcome.

When reporting a problem, please include:

- Shop domain
- Product-page URL, if it is publicly accessible
- Expected copied result
- Actual copied result
- Relevant HTML snippet for the title, price, or article number
- Browser and userscript-manager version

Do not include account credentials, customer numbers, addresses, session identifiers, or other private information in issues or HTML samples.

## License

This project is licensed under the **GNU Affero General Public License v3.0 or later** (`AGPL-3.0-or-later`). See the [`LICENSE`](LICENSE) file for the complete license text.

You may use, study, modify, and redistribute the software under the terms of the GNU AGPL. Modified versions must remain available under the same license. If a modified version is made available for users to interact with over a network, those users must be offered access to its corresponding source code.

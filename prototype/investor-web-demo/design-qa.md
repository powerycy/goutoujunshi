# Design QA

## Visual truth

- Primary reference: `../wechat-mini-program/design-qa-assets/home-final.png`
- Source implementation: `../wechat-mini-program/miniprogram/pages/home`, `pages/me`, `pages/pricing`, `pages/history`, `pages/analysis-loading`, and `pages/analysis-result`
- Shared assets: the original `doghead-logo.png`, `arrow-up-icon.png`, and `person-icon.png`

## Verification

- Compared the reference and web implementation side by side at a 390 × 833 viewport.
- Confirmed the same white, charcoal, gray, and green visual system; centered navigation title; hamburger entry; hero logo and title; bottom composer; counter; and round arrow submit control.
- Confirmed the desktop presentation is a centered portrait phone rather than a wide web card.
- Confirmed the hamburger opens the mini-program-style “我的” page.
- Confirmed “充值” opens the package selection page with the existing three packages, balance, gifts, purchase records, and non-delivery footnote.
- Confirmed the access-code gate, model labels, AI/privacy chips, adult checkbox, alias guidance, and minimum-length prompt are absent.
- Confirmed Enter submits and Shift+Enter inserts a newline.
- Confirmed loading, failed, delivered, history, result, suggestions, and recharge states remain inside the phone viewport.

## Result

Passed.

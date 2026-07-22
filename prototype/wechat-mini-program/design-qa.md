**Visual Truth**

- Product direction: restrained Apple-style WeChat Mini Program with one green accent, quiet white surfaces, compact account controls, and no dashboard-style decoration.
- Latest annotations override earlier mockups: balance is display-only, recharge is the only purchase entry, history and product suggestions are always visible, and there is no `更多` disclosure.

**Typography System**

- Display: `40rpx` for the primary screen heading.
- Title: `32rpx` for account names and section-level headings.
- Emphasis: `34rpx` for prices and important numeric values.
- Body: `28rpx` for rows, controls, answers, and input copy.
- Secondary: `24rpx` for supporting values and explanatory copy.
- Caption: `22rpx` for hints, counters, labels, and privacy notes.
- Chevron and control icon sizes are independent of text tokens.

**Current Evidence**

- Home: `design-qa-assets/home-mobile-final.png`.
- Home account-entry correction: `design-qa-assets/home-account-icon-final.png`.
- Home composer position correction: `design-qa-assets/home-composer-position-final.png`.
- Account: `design-qa-assets/me-mobile-final.png`.
- Recharge: `design-qa-assets/pricing-mobile-final.png`.
- History: `design-qa-assets/history-mobile-final.png`.
- Reward confirmation: `design-qa-assets/beta-reward-mobile-final.png`.
- Analysis in progress: `design-qa-assets/analysis-loading-mobile-final.png`.
- Historical result error state: `design-qa-assets/analysis-result-mobile-final.png`.
- Removed legacy intake audit: `design-qa-assets/legacy-case-intake-audit.png`.
- Viewport: WeChat DevTools iPhone 12/13 Pro standalone simulator, 390 x 833 at 74% display scale.
- A same-viewport comparison was performed against `home-final-v2.png` and `me-expanded-final-v2.png` after the latest annotations were applied.

**Checks**

- Home keeps one dominant composer, a compact person account icon, a centered product statement, and no overlapping lower toolbar.
- The home account entry uses a clear system person silhouette, fixed to the content area's `32rpx` right inset and vertically aligned with the brand row; its invisible tap target remains `64rpx`.
- The composer bottom inset is `40rpx + safe-area-inset-bottom`; it sits close to the Home Indicator without touching or being covered by it.
- Account balance has no tap binding or chevron. Recharge is the only entry with a green price hint and navigation chevron.
- History judgment and product suggestions are visible directly. `更多` and its disclosure state have been removed.
- Delete-account copy and the privacy note are centered and fit their containers.
- Recharge keeps three stable price tracks: `¥1/10`, `¥6/30`, and `¥12/75`; selection does not shift layout.
- Home, account, recharge, history, reward, analysis-progress, and historical-result screens consume the shared typography tokens instead of defining page-specific text sizes.
- The duplicate case-intake page and redirect-only analysis page are no longer registered. New questions always return to the home composer.
- The analysis-progress page no longer exposes Skill routing or knowledge-file implementation details.
- The historical-result surface now uses white bands, gray body copy, green section indices, and the same buttons as the rest of the product; the paper folder, stamp, serif type, and yellow treatment are gone.
- White, neutral gray, and `#18c463`/`#18b85f` remain consistent across the inspected screens.
- No clipping, overlap, blank stable state, or malformed text was found in the accepted screenshots.

**Verification**

- WeChat DevTools compile completed successfully under base library `3.17.0`.
- Automated checks: 16 passed, 0 failed.
- Remaining console warnings are WeChat tourist-mode limitations; they are not layout or WXSS failures.

**Evidence Limit**

- The clean simulator session had no delivered historical record, so the historical-result error state was captured directly. Delivered, blocked, and failed layouts share the audited result shell and evidence-section component, but realistic long-answer wrapping still needs a delivered fixture before release-candidate sign-off.

final result: passed

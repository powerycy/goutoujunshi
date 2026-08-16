# Product Design QA

- reference: `artifacts/references/old-kline-ui.jpg`
- implementation: `artifacts/screenshots/10-kline-desktop.png`
- comparison: `artifacts/qa/old-vs-new-kline.png`
- viewport: 1280 × 720 for both source and implementation, device scale factor 1
- state: public synthetic case, 小北, relationship progress, negative candle hovered

## Full-view comparison

The reference and implementation were inspected together in one 2560 × 760 image. The implementation matches the source's warm-black editorial workbench, real candle bodies and wicks, red-positive/green-negative semantics, volume bars, fine grid, compact time controls, and a right-hand evidence explanation panel. The official DeepSeek Harness sidebar and header remain visible by product requirement.

## Focused comparison

At 1280 × 720, the 16-bar cadence, candle direction, OHLC row, price axis, current-price line, crosshair, volume, right-panel evidence text, source citation, completeness, and action confirmation are legible. No trend line or relationship-success forecast is present.

## Fix history

1. P1: pastel trend visualization and structured response cards diverged from the prior UI and normal Agent feel. Fixed with the old dark K-line language and conversational bubbles.
2. P1: replacing the whole sidebar hid official model/provider settings. Fixed by registering inside `sidebar.workspaces`; official Settings → Models, DeepSeek API Key, add-provider, and custom-provider controls were verified post-fix.
3. P2: mobile toast overlapped the view switch. Fixed by positioning it below the mobile header.
4. P1: the settings dialog exposed unrelated general/plugin/preset pages, and the first K-line pass still lacked stock-terminal density. Fixed by replacing the visible settings entry with a direct compact model-connection dialog and adding the source terminal's 16 bars, timeframe strip, indicator strip, OHLC row, price axis, current-price line, crosshair, volume profile, and decision rail. The updated 1280 × 720 side-by-side comparison is saved at `artifacts/qa/old-vs-new-kline.png`.

final result: passed

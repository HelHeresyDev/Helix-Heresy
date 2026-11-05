# Current-interface accessibility verification

This records the completed, fixed **6-B** matrix. It is evidence for the journeys below, not a formal conformance certificate, a real screen-reader test, or a claim that every future screen is already accessible. Deferred gameplay and the tutorial were not implemented or reactivated.

## Controls and shared repairs

- Tab/Shift+Tab follow native controls. Horizontal tab groups support Left/Right, Home and End; vertical groups support Up/Down. Tabs identify their controlled panels and panels identify their tabs.
- Enter and Space activate focused buttons normally. Input/select/text editing retains native keys rather than triggering map navigation or pause. Focus the map region to use its navigation keys; the skip link provides direct access to the current workspace.
- Routine full/map rerenders retain the same control's focus, draft text and caret. Entity-backed controls must match the same identity; absent or ambiguous matches do not transfer a draft to another order/person. A disappearing target falls back to a visible region heading or map viewport. Explicit workspace navigation can move focus out of a now-hidden panel.
- Startup views are one named modal region with inactive gameplay content inert. Tab wraps within the visible view. Settings/About return to their initiating title control. Existing native browser confirmations remain native; cancellation does not delete records or transfer authority.
- **Unavailable actions**, in the top controls, exposes the current view's already-visible disabled-action names and reasons as readable text. Enter/Space opens it; Escape closes it. It does not enable the actions, query undisclosed sources or replace ordinary validation.
- The main interface and clock strip no longer act as blanket live regions. Notification cues retain their dedicated throttled status region. Explicit map-cursor/layer navigation has a separate targeted readout; ordinary map rerenders do not replay it. World/site status and deliberate globe-cell inspection retain scoped feedback.
- Common text/control/focus colors have explicit contrast checks. High contrast now covers management panels, the header, menus and notifications as well as the map; opaque panels avoid background-map interference. Selected tabs have a double-border cue in addition to color and selection semantics. File controls have a visible outer focus indication.
- Header/navigation bounds are measured rather than assumed. Management views reflow to a single width on smaller viewports; map content can scroll between the header and bottom menu. At low heights an empty inspector does not cover the map and a populated inspector participates in the scroll layout.
- Reduced-motion/system settings suppress interface animation and transitions and avoid scripted smooth scrolling/focus pulses. Forced-colors presentation retains system control borders and focus colors. Existing mute, category, contrast, marker-size and DOM Compatibility Map preferences remain available.

## Frozen journey matrix

| Journey/check | Verification and result |
| --- | --- |
| Existing world → site → new run | Keyboard operation of the real library/setup controls, globe inspection, site radio and seed form; visible control-name checks. Passed. The test uses the existing validated focused world fixture, not a new generator implementation. |
| Startup modal and confirmation | Named view, inactive gameplay isolation, first/last Tab containment, Settings/About invoker restoration, native run-deletion confirmation cancellation with unchanged records/focus. Passed. |
| Local inspection and movement | DOM and Canvas, debug reveal disabled: actual arrow-key cursor navigation, selection of the specific known floor tile, native action-button activation and physical task completion at that tile. Passed. Keyboard “Also here” now uses the selected cursor ground instead of the room center. |
| Knowledge boundary | Both renderers: an unobserved layer remains unexplored in the accessible readout, with no hidden rock/deposit names supplied. Passed. |
| Management and blocked actions/tasks | Creature tabs, research, economy and notification settings: native key behavior, visible control names, tab/panel relationships and readable existing block reasons. A normally queued move is then held by actual physical door closure/locking; the Blocked task tab exposes the derived reason and keyboard cancellation removes the same task. Passed. The door change is an explicit test input, not an earned environmental event or an injected blocked-status flag. No work/permission is manufactured by an explanation. |
| Focus and editing | Native pause/speed controls; an incomplete genome draft/caret across a real simulation render; an explicitly reconstructed same-identity form control; refusal to give its draft/focus to a different fixture order. Passed. Pause-key checks fix wall-clock time while retaining input/animation timers; physical movement advances its actual simulation clock. This is not a realtime performance benchmark. |
| Save/continue and death/restart | Existing message-history and notification scenarios exercise reload/continued import. The startup journey exercises actual irreversible scientist death, focused postmortem and a new independent same-world branch. Passed. |
| Readability and sensory options | 640×400 CSS layout at 2× device scale (200%-equivalent layout), then a 1280×800 layout with root text at 200%; usable bounded management panels, no tested horizontal panel overflow, focused notification controls visible. Reduced-motion and forced-colors media inputs checked. Passed for these layouts. |
| Shared palette | Three model checks cover tab destinations, native key ownership and common normal/high-contrast text/control/focus combinations. Text threshold 4.5:1 and control/focus threshold 3:1. Passed for the listed palette, not every rendered pixel. |

## Visual review

Captured Chromium screenshots were inspected for the small-layout management view, keyboard-focused map, 200% text view and forced-colors view. Review found and corrected translucent high-contrast management panels, an oversized header at larger text sizes, content scrolling beneath the header, and an empty inspector obscuring a short map viewport. The resulting captures show readable labels, distinct focus, reachable scrollable controls, and map/navigation separation.

The focused browser test regenerates `/tmp/helix-a11y-zoom-management.png`, `/tmp/helix-a11y-zoom-map.png`, `/tmp/helix-a11y-text-200.png` and `/tmp/helix-a11y-forced-colors.png`. These are temporary verification captures, not production assets or permanent screenshot baselines.

## Focused checks

Run only these relevant files/cases, not the complete suite:

```sh
node --test --test-isolation=none tests/accessibility-ui.unit.test.js
npx playwright test tests/accessibility-closeout.spec.js --project=chromium --workers=2
npx playwright test tests/title-screen.spec.js --project=chromium --grep 'title Settings persist independently'
npx playwright test tests/message-history.spec.js --project=chromium
npx playwright test tests/notifications-browser.spec.js --project=chromium --grep 'dom: notification controls'
```

Three model checks, five fixed-journey browser cases and the three named existing regressions passed. Syntax/whitespace checks also passed. The full suite was not run under `AGENTS.md`.

## Verification limits

- No NVDA, JAWS, Orca or VoiceOver session was performed. Browser role/name checks and scripted keyboard events do **not** establish real assistive-technology usability. Screen readers may reserve map arrow keys in browse mode; actual focus/pass-through behavior needs validation with the user's technology.
- Native confirmation cancellation was tested through the browser automation interface, not by manually operating or hearing an operating-system dialog. Forced-colors checks use Chromium media emulation, not a real Windows high-contrast session.
- Visual review used captured browser images, not a human keyboard-only playtest. The scaled layout emulates the CSS viewport/device scale of zoom; the separate 200% root-text check is not a claim that a browser's native zoom menu was exercised.
- Spatial maps remain pan/zoom/scroll interfaces; the whole globe/laboratory need not fit in one screen. Canvas pixels are not individually exposed as semantic controls. Known cursor descriptions, inspections and orders remain available through the shared projection and DOM compatibility option; undiscovered details stay unknown.
- The palette checks are not an exhaustive contrast census of every glyph, environmental lighting state or historical content panel. The matrix covers the named current journeys and shared patterns, not every optional late-game encounter, future feature, browser engine, mobile layout or color/perception condition.

These limits are disclosed rather than represented as passed tests or converted into an automatically expanding pending queue.

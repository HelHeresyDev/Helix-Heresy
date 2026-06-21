# Helix Heresy — System Handoff Index

Use this index to find the current handoff document for each implemented or actively designed system.

## Current handoffs

| Area | Handoff file | Status |
|---|---|---|
| Physical Rooms | `HANDOFF_PHYSICAL_ROOMS.md` | Implemented through Physical Rooms Pass 3 |
| Room Exposure | `HANDOFF_ROOM_EXPOSURE.md` | Implemented through Room Exposure Pass 4 Fix 2 |
| UI Cleanup | `HANDOFF_UI_CLEANUP.md` | Implemented through UI Cleanup Pass 1 Fix 1 |

## Current working state

Room Exposure is now complete enough to pause or move on:
- Pass 1: Physical State + hidden exposure + diagnostics
- Pass 2: Current-room exposure + observation reliability + snapshot-based move warnings
- Pass 3: Rest quality + unsafe rest confirmation
- Pass 4: Toxic/Failing action gates

UI Cleanup side track is also complete:
- UI Cleanup Pass 1 Fix 1: keyword tooltips and modified stamina cost breakdowns

Treat tooltip/cost work as **UI Cleanup**, not Room Exposure.

## Global workflow notes

- Use fresh prompts for new Cline/Codex chats.
- Use `git add .` for staging unless there is a specific reason not to.
- Continue to keep implementation passes narrow.
- Discuss design before coding.
- Smoke tests should check both behavior and scope discipline.
- If a pass introduces UI wording, include qualitative QC for readability, repetition, and scope creep.

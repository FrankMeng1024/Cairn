# UX Review — Sprint 19

**Sprint**: 19
**Confidence**: HIGH

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Medium | MapHistoryScreen route card shows "No GPS data recorded" with no explanation — first-time user confused whether hike was tracked. No guidance on why GPS data is missing. | STORY-00043-02.png |
| Low | Settings Explorer/Navigator labels are thematic but not self-explanatory from title alone — user must read description text to understand difference. | STORY-00044-02.png |
| Low | FriendsScreen add-friend sheet implies email invitation only — users expecting user search/discovery may be surprised. Mental model mismatch is minor. | STORY-00045-03.png |
| Low | Flag detail sheet shows "No note added" with no affordance to add a note from history view — reads as informational only. | STORY-00046-02.png |

**No Blocker or Critical friction items.**

## Untested Paths
- MapHistoryScreen with real GPS data (only 0-trackPoint state observed)
- What other screens look like after switching to Navigator mode
- FriendsScreen toggling sharing off — friend's perspective
- FriendsScreen duplicate invite
- Flag Delete confirmation dialog behavior
- Many routes/flags scrolling

## Knowledge Updates
- Bottom sheet pattern (scrim + drag handle) is consistent across FriendsScreen and MapHistoryScreen — becoming a reliable Cairn interaction idiom
- Settings mode toggle: card selection with accent border + checkmark + pending-save hint is clear and explicit
- FriendsScreen add-friend: validation errors (invalid email, self-invite) handled gracefully inline with red border + error text
- Sprint 19 adds no Blocker-level UX friction

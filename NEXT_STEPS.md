# Next steps

## Future enhancement: personal voice uploads + automatic word alignment

Allow users to upload their own passuk recordings so a learner can practice with a familiar voice — e.g. a grandparent, parent, teacher, sibling, baal koreh, or community reader.

### Core idea
- User selects a passuk (or aliyah) and uploads an audio recording.
- The app already knows the exact Hebrew text for that passuk.
- Run the same word-alignment logic used for the built-in Vayetsei recordings to estimate each word start time.
- Store the resulting timestamps alongside that user's recording.
- Use those timestamps for:
  - single-tap word playback
  - synchronized word highlighting during full-passuk playback
  - repeat-from-this-word / repeat-this-phrase practice

### Product direction
- Support multiple voice sets for the same passage.
- Let the learner choose which reader/voice to practice with.
- Allow a simple timing-review screen so incorrect boundaries can be nudged manually.
- Preserve the original uploaded recording; alignment metadata should be separate and editable.
- Keep the alignment engine reusable across future parashot, aliyot, haftarot, and different minhagim.

### Important implementation questions for later
- Where user audio is stored (local browser, account storage, cloud object storage, etc.).
- Privacy/consent rules for family recordings, especially recordings of minors.
- Whether alignment runs client-side, server-side, or through a dedicated speech/forced-alignment service.
- File size limits, supported formats, transcoding, and mobile upload UX.
- Confidence scoring so low-confidence word boundaries are flagged for review instead of silently accepted.

This is intentionally a post-V1 enhancement. The current goal is to make the built-in Vayetsei Rishon experience accurate and polished first.

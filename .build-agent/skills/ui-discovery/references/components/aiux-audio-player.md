# @servicenow/aiux-audio-player

## Import

```js
import '@servicenow/aiux-audio-player';
```


Audio player component with playback controls (play/pause, rewind, fast-forward, scrubber, volume, and playback rate).

## Usage

```html
<aiux-audio-player
  .sources=${[
    'https://example.com/song.mp3',
    'https://example.com/song.ogg'
  ]}
></aiux-audio-player>
```

## Properties

- `sources` - Array of alternative audio file URLs. The browser will choose the first source it supports. When empty, the component renders a localized empty state instead of the playback controls.
- `muted` - Whether the audio is initially silenced (default: `false`)
- `autoplay` - Whether the audio plays automatically when loaded (default: `false`)
- `loop` - Whether the audio automatically repeats at the end (default: `false`)
- `jumpTime` - Seconds to jump on rewind/fast-forward (default: `3`)

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property | Type | Label | Default | Description |
| -------- | ---- | ----- | ------- | ----------- |
| `configMuted` | `Boolean` | Muted | `undefined` | Determines whether the audio is initially silenced. |
| `configLoop` | `Boolean` | Loop | `undefined` | Ensures the audio content automatically repeats at the end. |
| `configJumpTime` | `Number` | Jump Time | `undefined` | The number of seconds to jump on rewind or fast-forward. |

## Events

All events bubble and are composed.

- `aiux-audio-player:played` - When playback starts
- `aiux-audio-player:paused` - When playback pauses
- `aiux-audio-player:ended` - When playback ends
- `aiux-audio-player:fast-forward` - When fast-forward button is clicked (detail: `{ jumpTime }`)
- `aiux-audio-player:rewind` - When rewind button is clicked (detail: `{ jumpTime }`)
- `aiux-audio-player:volume-changed` - When volume changes (detail: `{ volume }`, decimal 0-1)
- `aiux-audio-player:time-changed` - When scrubber position changes (detail: `{ time }`)
- `aiux-audio-player:playback-rate-changed` - When playback rate changes (detail: `{ rate }`)

## Features

- Rewind, play/pause, fast-forward controls
- Time display and scrubber
- Inline volume slider: the speaker button reveals a slider in a pill beside it, inside the player's own control row, and the scrubber shrinks to make room rather than being replaced. The button carries `aria-expanded`. Click the button again, press `Escape` (focus returns to the button), or move focus out of the volume group to hide it
- Playback rate selection (0.5x, 1x, 1.5x, 2x), with `ArrowUp`/`ArrowDown` keyboard navigation between rates in the dropdown
- Automatic MIME type inference from file extension
- Desktop Safari compatibility
- Localized empty state when `sources` is empty

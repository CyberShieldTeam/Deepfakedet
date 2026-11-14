# Video transport fixture

`test_pattern_3s.mp4` is a three-second 320×180, 8 fps H.264 MP4 generated locally from FFmpeg's built-in `testsrc` filter. It contains moving color bars and has no real people, speech, or authenticity label. Use it only to test frame sampling, timestamps, HTTP transport, and result rendering; it cannot evaluate deepfake detection accuracy.

`frame_0.jpg`, `frame_1.jpg`, and `frame_2.jpg` were extracted from that same clip near 0.2, 1.2, and 2.2 seconds for the live HTTP smoke test.

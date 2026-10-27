`instagram-video.mp4` is an eight-second purple test frame with silent audio,
generated locally with FFmpeg. It contains no Instagram or production content.
The browser tests serve it from the isolated loopback test server; no external video is used.

Regenerate with:

```sh
ffmpeg -f lavfi -i color=c=0x873684:s=64x96:r=10 -f lavfi -i anullsrc=r=44100:cl=mono -t 8 -c:v libx264 -profile:v baseline -pix_fmt yuv420p -c:a aac -b:a 16k -movflags +faststart test/fixtures/instagram-video.mp4
```

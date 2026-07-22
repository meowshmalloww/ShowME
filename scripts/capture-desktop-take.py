"""Record a cursor-free Windows desktop take with WASAPI loopback audio.

This helper intentionally has no visible recorder UI. FFmpeg captures the
desktop while PyAudioWPatch captures the default speaker endpoint in WASAPI
loopback mode. A silent output stream keeps the Windows audio engine active so
the WAV timeline includes quiet lead-in instead of starting at the first word.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import wave


ROOT = Path(__file__).resolve().parents[1]
VENDORED_PYTHON = ROOT / "artifacts" / "tools" / "python"
sys.path.insert(0, str(VENDORED_PYTHON))

import pyaudiowpatch as pyaudio  # noqa: E402
import dxcam  # noqa: E402


def find_loopback_device(audio: pyaudio.PyAudio) -> tuple[dict, dict]:
    wasapi = audio.get_host_api_info_by_type(pyaudio.paWASAPI)
    output = audio.get_device_info_by_index(wasapi["defaultOutputDevice"])
    if output.get("isLoopbackDevice"):
        return output, output

    output_name = str(output["name"])
    for candidate in audio.get_loopback_device_info_generator():
        if output_name in str(candidate["name"]):
            return output, candidate
    raise RuntimeError(f"No WASAPI loopback device matched {output_name!r}")


def run_ffmpeg(
    command: list[str],
    *,
    stdin: int | None = subprocess.DEVNULL,
) -> subprocess.Popen[bytes]:
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    return subprocess.Popen(
        command,
        stdin=stdin,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        creationflags=creation_flags,
    )


def start_cursor_free_video_capture(
    ffmpeg: str,
    output: Path,
    duration: float,
    fps: int,
) -> tuple[subprocess.Popen[bytes], threading.Thread, list[BaseException]]:
    """Encode Desktop Duplication frames without compositing the OS pointer."""

    camera = dxcam.create(output_color="BGRA")
    first_frame = camera.grab()
    if first_frame is None:
        camera.release()
        raise RuntimeError("Desktop Duplication did not return an initial frame")

    height, width = first_frame.shape[:2]
    video_command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-f",
        "rawvideo",
        "-pixel_format",
        "bgra",
        "-video_size",
        f"{width}x{height}",
        "-framerate",
        str(fps),
        "-i",
        "pipe:0",
        "-t",
        f"{duration:.3f}",
        "-c:v",
        "h264_nvenc",
        "-preset",
        "p4",
        "-cq",
        "20",
        "-b:v",
        "0",
        "-pix_fmt",
        "yuv420p",
        str(output),
    ]
    video_process = run_ffmpeg(video_command, stdin=subprocess.PIPE)
    if video_process.stdin is None:
        camera.release()
        raise RuntimeError("FFmpeg raw-video input pipe was not created")

    camera.start(target_fps=fps, video_mode=True)
    errors: list[BaseException] = []

    def write_frames() -> None:
        frame = first_frame
        frame_count = max(1, round(duration * fps))
        started = time.perf_counter()
        try:
            for index in range(frame_count):
                target = started + (index / fps)
                remaining = target - time.perf_counter()
                if remaining > 0:
                    time.sleep(remaining)
                latest = camera.get_latest_frame()
                if latest is not None:
                    frame = latest
                video_process.stdin.write(frame.tobytes())
        except BaseException as error:  # Propagate capture-thread failures.
            errors.append(error)
        finally:
            try:
                video_process.stdin.close()
            finally:
                camera.stop()
                camera.release()

    thread = threading.Thread(target=write_frames, name="showme-video-capture", daemon=True)
    thread.start()
    return video_process, thread, errors


def capture(output: Path, duration: float, fps: int) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg was not found on PATH")

    output.parent.mkdir(parents=True, exist_ok=True)
    raw_video = output.with_suffix(".video.mkv")
    raw_audio = output.with_suffix(".audio.wav")
    metadata_path = output.with_suffix(".json")

    with pyaudio.PyAudio() as audio:
        output_device, loopback = find_loopback_device(audio)
        rate = int(loopback["defaultSampleRate"])
        channels = max(1, min(2, int(loopback["maxInputChannels"])))
        chunk = 1024
        sample_format = pyaudio.paInt16

        def silence_callback(_input, frame_count, _time_info, _status):
            return (b"\x00" * frame_count * channels * 2, pyaudio.paContinue)

        silence_stream = audio.open(
            format=sample_format,
            channels=channels,
            rate=rate,
            output=True,
            output_device_index=int(output_device["index"]),
            frames_per_buffer=chunk,
            stream_callback=silence_callback,
            start=False,
        )
        capture_stream = audio.open(
            format=sample_format,
            channels=channels,
            rate=rate,
            input=True,
            input_device_index=int(loopback["index"]),
            frames_per_buffer=chunk,
            start=False,
        )

        video_process, video_thread, video_errors = start_cursor_free_video_capture(
            ffmpeg,
            raw_video,
            duration,
            fps,
        )
        silence_stream.start_stream()
        capture_stream.start_stream()
        started = time.perf_counter()

        with wave.open(str(raw_audio), "wb") as writer:
            writer.setnchannels(channels)
            writer.setsampwidth(audio.get_sample_size(sample_format))
            writer.setframerate(rate)
            while time.perf_counter() - started < duration:
                writer.writeframes(
                    capture_stream.read(chunk, exception_on_overflow=False)
                )

        capture_stream.stop_stream()
        silence_stream.stop_stream()
        capture_stream.close()
        silence_stream.close()

        video_thread.join(timeout=max(15, int(duration / 2)))
        if video_thread.is_alive():
            video_process.kill()
            raise RuntimeError("Desktop Duplication capture did not finish in time")
        video_error = video_process.stderr.read() if video_process.stderr else b""
        video_process.wait(timeout=max(15, int(duration / 2)))
        if video_errors:
            raise RuntimeError(f"Desktop Duplication capture failed: {video_errors[0]}")
        if video_process.returncode:
            raise RuntimeError(video_error.decode("utf-8", errors="replace"))

    mux_command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-i",
        str(raw_video),
        "-i",
        str(raw_audio),
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-af",
        "aresample=async=1:first_pts=0",
        "-shortest",
        str(output),
    ]
    muxed = subprocess.run(mux_command, capture_output=True, check=False)
    if muxed.returncode:
        raise RuntimeError(muxed.stderr.decode("utf-8", errors="replace"))

    metadata_path.write_text(
        json.dumps(
            {
                "output": str(output),
                "durationSeconds": duration,
                "fps": fps,
                "audioDevice": loopback["name"],
                "sampleRate": rate,
                "channels": channels,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--duration", type=float, default=35.0)
    parser.add_argument("--fps", type=int, default=30)
    args = parser.parse_args()
    capture(args.output.resolve(), args.duration, args.fps)


if __name__ == "__main__":
    main()

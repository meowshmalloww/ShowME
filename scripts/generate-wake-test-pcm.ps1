param([Parameter(Mandatory = $true)][string]$OutputPath)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(
  16000,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono
)
$audio = [System.IO.MemoryStream]::new()
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $synthesizer.SetOutputToAudioStream($audio, $format)
  $synthesizer.Speak("Hey show me")
  $synthesizer.SetOutputToNull()
  [System.IO.File]::WriteAllBytes($OutputPath, $audio.ToArray())
} finally {
  $synthesizer.Dispose()
  $audio.Dispose()
}

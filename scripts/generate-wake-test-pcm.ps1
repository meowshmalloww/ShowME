param(
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$Phrase = "Hey show me"
)

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
  try {
    $synthesizer.SelectVoiceByHints(
      [System.Speech.Synthesis.VoiceGender]::Female,
      [System.Speech.Synthesis.VoiceAge]::Adult,
      0,
      [System.Globalization.CultureInfo]::GetCultureInfo("en-US")
    )
  } catch {
    # Fall back to the system voice when no en-US female voice is installed.
  }
  $synthesizer.SetOutputToAudioStream($audio, $format)
  $synthesizer.Speak($Phrase)
  $synthesizer.SetOutputToNull()
  [System.IO.File]::WriteAllBytes($OutputPath, $audio.ToArray())
} finally {
  $synthesizer.Dispose()
  $audio.Dispose()
}

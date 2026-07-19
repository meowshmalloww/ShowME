param(
  [string]$WakePhrase = "ShowME",
  [double]$ConfidenceThreshold = 0.42,
  [switch]$SelfTest,
  [switch]$Probe
)

$ErrorActionPreference = "Stop"

try {
  Add-Type -AssemblyName System.Speech
  $installed = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
  if ($installed.Count -eq 0) {
    throw "Windows Speech Recognition is not installed."
  }
  $preferredCulture = [System.Globalization.CultureInfo]::CurrentUICulture.Name
  $recognizerInfo = $installed |
    Where-Object { $_.Culture.Name -eq $preferredCulture } |
    Select-Object -First 1
  if ($null -eq $recognizerInfo) {
    $recognizerInfo = $installed |
      Where-Object { $_.Culture.Name -eq "en-US" } |
      Select-Object -First 1
  }
  if ($null -eq $recognizerInfo) {
    $recognizerInfo = $installed[0]
  }
  $recognizerCulture = $recognizerInfo.Culture
  $ConfidenceThreshold = [Math]::Max(0.25, [Math]::Min(0.9, $ConfidenceThreshold))
  $script:confidenceThreshold = $ConfidenceThreshold
  $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizerCulture)
  if ($Probe) {
    [Console]::Out.WriteLine((@{
      type = "ready"
      culture = $recognizerCulture.Name
      recognizer = $recognizerInfo.Description
    } | ConvertTo-Json -Compress))
    $recognizer.Dispose()
    exit 0
  }

  $variants = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  [void]$variants.Add("Show me")
  [void]$variants.Add("Hey show me")
  [void]$variants.Add("Okay show me")
  if (-not [string]::IsNullOrWhiteSpace($WakePhrase)) {
    $name = $WakePhrase.Trim()
    [void]$variants.Add($name)
    [void]$variants.Add("Hey $name")
    [void]$variants.Add("Okay $name")
  }

  $choices = [System.Speech.Recognition.Choices]::new()
  $choices.Add([string[]]$variants)
  $builder = [System.Speech.Recognition.GrammarBuilder]::new()
  $builder.Culture = $recognizerCulture
  $builder.Append($choices)
  $grammar = [System.Speech.Recognition.Grammar]::new($builder)
  $recognizer.LoadGrammar($grammar)
  if ($SelfTest) {
    $temporaryWave = Join-Path ([System.IO.Path]::GetTempPath()) ("showme-wake-" + [guid]::NewGuid().ToString("N") + ".wav")
    $synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
    try {
      $synthesizer.SetOutputToWaveFile($temporaryWave)
      $synthesizer.Speak("Hey show me")
      $synthesizer.SetOutputToNull()
      $recognizer.SetInputToWaveFile($temporaryWave)
      $result = $recognizer.Recognize([TimeSpan]::FromSeconds(8))
      $success = $null -ne $result -and $result.Confidence -ge $ConfidenceThreshold
      [Console]::Out.WriteLine((@{
        type = "self-test"
        success = $success
        phrase = if ($null -ne $result) { $result.Text } else { "" }
        confidence = if ($null -ne $result) { [Math]::Round($result.Confidence, 3) } else { 0 }
        culture = $recognizerCulture.Name
      } | ConvertTo-Json -Compress))
      if (-not $success) { exit 1 }
      exit 0
    } finally {
      $synthesizer.Dispose()
      Remove-Item -LiteralPath $temporaryWave -ErrorAction SilentlyContinue
    }
  }
  $recognizer.SetInputToDefaultAudioDevice()

  Register-ObjectEvent -InputObject $recognizer -EventName AudioLevelUpdated -Action {
    $now = [Environment]::TickCount64
    if ($null -eq $script:lastLevelAt -or $now - $script:lastLevelAt -ge 80) {
      $script:lastLevelAt = $now
      [Console]::Out.WriteLine((@{
        type = "level"
        level = $Event.SourceEventArgs.AudioLevel
      } | ConvertTo-Json -Compress))
    }
  } | Out-Null

  Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -Action {
    $result = $Event.SourceEventArgs.Result
    # This is a closed grammar containing only explicit wake phrases, so a moderately
    # permissive threshold is more reliable without opening general dictation.
    if ($result.Confidence -ge $script:confidenceThreshold) {
      [Console]::Out.WriteLine((@{
        type = "wake"
        phrase = $result.Text
        confidence = [Math]::Round($result.Confidence, 3)
      } | ConvertTo-Json -Compress))
    }
  } | Out-Null

  [Console]::Out.WriteLine((@{
    type = "ready"
    culture = $recognizerCulture.Name
    recognizer = $recognizerInfo.Description
  } | ConvertTo-Json -Compress))
  $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

  while ($true) {
    $nextEvent = Wait-Event -Timeout 1
    if ($null -ne $nextEvent) {
      Remove-Event -EventIdentifier $nextEvent.EventIdentifier -ErrorAction SilentlyContinue
    }
  }
} catch {
  [Console]::Out.WriteLine((@{
    type = "error"
    message = $_.Exception.Message
  } | ConvertTo-Json -Compress))
  exit 1
} finally {
  if ($null -ne $recognizer) {
    try { $recognizer.RecognizeAsyncCancel() } catch {}
    $recognizer.Dispose()
  }
}

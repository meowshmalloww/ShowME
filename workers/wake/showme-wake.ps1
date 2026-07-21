param(
  [string]$WakePhrase = "ShowME",
  [double]$ConfidenceThreshold = 0.60,
  [switch]$SelfTest,
  [switch]$Probe,
  [switch]$StreamInput
)

$ErrorActionPreference = "Stop"
$recognizer = $null
$dictationRecognizer = $null

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
  $ConfidenceThreshold = [Math]::Max(0.55, [Math]::Min(0.9, $ConfidenceThreshold))
  $script:confidenceThreshold = $ConfidenceThreshold
  $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizerCulture)
  $recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(1.5)
  $recognizer.BabbleTimeout = [TimeSpan]::FromSeconds(2)
  $recognizer.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(180)
  $recognizer.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds(340)
  if ($Probe) {
    [Console]::Out.WriteLine((@{
      type = "ready"
      culture = $recognizerCulture.Name
      recognizer = $recognizerInfo.Description
    } | ConvertTo-Json -Compress))
    $recognizer.Dispose()
    exit 0
  }

  $script:wakePhrases = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  [void]$script:wakePhrases.Add("show me")
  [void]$script:wakePhrases.Add("hey show me")
  [void]$script:wakePhrases.Add("okay show me")

  function Test-WakePhrase([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    $normalized = ($Text.ToLowerInvariant() -replace "[^a-z0-9 ]", " " -replace "\s+", " ").Trim()
    return $script:wakePhrases.Contains($normalized)
  }

  function Test-PlausibleDictation([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    $normalized = ($Text.ToLowerInvariant() -replace "[^a-z0-9 ]", " " -replace "\s+", " ").Trim()
    $words = @($normalized -split " " | Where-Object { $_ })
    if ($words.Count -gt 5) { return $false }
    for ($index = 0; $index -lt $words.Count - 1; $index += 1) {
      if ($words[$index] -eq "show" -and $words[$index + 1] -eq "me") { return $true }
    }
    return $false
  }

  $choices = [System.Speech.Recognition.Choices]::new()
  $choices.Add([string[]]$script:wakePhrases)
  $builder = [System.Speech.Recognition.GrammarBuilder]::new()
  $builder.Culture = $recognizerCulture
  $builder.Append($choices)
  $grammar = [System.Speech.Recognition.Grammar]::new($builder)
  $script:wakeGrammarName = "ShowME fixed wake phrases"
  $grammar.Name = $script:wakeGrammarName
  $recognizer.LoadGrammar($grammar)
  $audioFormat = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(
    16000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono
  )
  if ($SelfTest) {
    $synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
    $selfTestAudio = [System.IO.MemoryStream]::new()
    try {
      try {
        $synthesizer.SelectVoiceByHints(
          [System.Speech.Synthesis.VoiceGender]::Female,
          [System.Speech.Synthesis.VoiceAge]::Adult,
          0,
          $recognizerCulture
        )
      } catch {
        # Fall back to the system voice when no culture-matched female voice is installed.
      }
      $synthesizer.SetOutputToAudioStream($selfTestAudio, $audioFormat)
      $synthesizer.Speak("Hey show me")
      $synthesizer.SetOutputToNull()
      $selfTestAudio.Position = 0
      $recognizer.SetInputToAudioStream($selfTestAudio, $audioFormat)
      $result = $recognizer.Recognize([TimeSpan]::FromSeconds(8))
      $success = $null -ne $result -and
        $result.Confidence -ge $ConfidenceThreshold -and
        $result.Grammar.Name -eq $script:wakeGrammarName -and
        (Test-WakePhrase $result.Text)
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
      $selfTestAudio.Dispose()
    }
  }
  if ($StreamInput) {
    # Use a separate dictation recognizer as a rejection gate. A closed grammar by
    # itself tries to coerce every sentence into its nearest allowed wake phrase.
    # Only short utterances that actually contain "show" reach the wake recognizer.
    $dictationRecognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new(
      $recognizerCulture
    )
    $dictationRecognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(1.5)
    $dictationRecognizer.BabbleTimeout = [TimeSpan]::FromSeconds(2)
    $dictationRecognizer.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(180)
    $dictationRecognizer.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds(340)
    $dictationGrammar = [System.Speech.Recognition.DictationGrammar]::new()
    $dictationRecognizer.LoadGrammar($dictationGrammar)
    [Console]::Out.WriteLine((@{
      type = "ready"
      culture = $recognizerCulture.Name
      recognizer = $recognizerInfo.Description
    } | ConvertTo-Json -Compress))
    while ($null -ne ($inputLine = [Console]::In.ReadLine())) {
      $windowAudio = $null
      $dictationAudio = $null
      $dictationResult = $null
      try {
        $command = $inputLine | ConvertFrom-Json
        if ($command.type -ne "audio" -or [string]::IsNullOrWhiteSpace($command.pcm)) {
          continue
        }
        $audioBytes = [Convert]::FromBase64String($command.pcm)
        if ($audioBytes.Length -lt 3200 -or $audioBytes.Length -gt 128000) {
          continue
        }
        $dictationAudio = [System.IO.MemoryStream]::new($audioBytes, $false)
        $dictationRecognizer.SetInputToAudioStream($dictationAudio, $audioFormat)
        $dictationResult = $dictationRecognizer.Recognize([TimeSpan]::FromSeconds(5))
        try { $dictationRecognizer.SetInputToNull() } catch {}
        $dictationAudio.Dispose()
        $dictationAudio = $null
        $dictationText = if ($null -ne $dictationResult) { $dictationResult.Text } else { "" }
        $normalizedDictation = ($dictationText.ToLowerInvariant() -replace "[^a-z0-9 ]", " " -replace "\s+", " ").Trim()
        $plausibleWake = Test-PlausibleDictation $normalizedDictation
        $directDictationWake = $plausibleWake -and
          $null -ne $dictationResult -and
          $dictationResult.Confidence -ge $script:confidenceThreshold
        if ($directDictationWake) {
          [Console]::Out.WriteLine((@{
            type = "wake"
            phrase = $dictationResult.Text
            confidence = [Math]::Round($dictationResult.Confidence, 3)
          } | ConvertTo-Json -Compress))
          continue
        }
        $windowAudio = [System.IO.MemoryStream]::new($audioBytes, $false)
        $recognizer.SetInputToAudioStream($windowAudio, $audioFormat)
        $result = $recognizer.Recognize([TimeSpan]::FromSeconds(5))
        $strongGrammarConfidence = [Math]::Max(0.82, $script:confidenceThreshold + 0.18)
        if ($null -ne $result -and
          (($plausibleWake -and $result.Confidence -ge $script:confidenceThreshold) -or
            $result.Confidence -ge $strongGrammarConfidence) -and
          $result.Grammar.Name -eq $script:wakeGrammarName -and
          (Test-WakePhrase $result.Text)) {
          [Console]::Out.WriteLine((@{
            type = "wake"
            phrase = $result.Text
            confidence = [Math]::Round($result.Confidence, 3)
          } | ConvertTo-Json -Compress))
        } else {
          [Console]::Out.WriteLine((@{
            type = "processed"
            phrase = if ($null -ne $dictationResult) { $dictationResult.Text } elseif ($null -ne $result) { $result.Text } else { "" }
            confidence = if ($null -ne $dictationResult) { [Math]::Round($dictationResult.Confidence, 3) } elseif ($null -ne $result) { [Math]::Round($result.Confidence, 3) } else { 0 }
          } | ConvertTo-Json -Compress))
        }
      } catch {
        [Console]::Out.WriteLine((@{
          type = "processed"
          message = $_.Exception.Message
        } | ConvertTo-Json -Compress))
      } finally {
        try { $recognizer.SetInputToNull() } catch {}
        try { $dictationRecognizer.SetInputToNull() } catch {}
        if ($null -ne $windowAudio) { $windowAudio.Dispose() }
        if ($null -ne $dictationAudio) { $dictationAudio.Dispose() }
      }
    }
    exit 0
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
    if ($result.Confidence -ge $script:confidenceThreshold -and
      $result.Grammar.Name -eq $script:wakeGrammarName -and
      (Test-WakePhrase $result.Text)) {
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
  if ($null -ne $dictationRecognizer) {
    $dictationRecognizer.Dispose()
  }
}

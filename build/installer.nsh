!macro customInstall
  ; Close a running instance before installing (NSIS locks otherwise).
  nsExec::ExecToLog 'taskkill /F /IM "NativeBlade Studio.exe"'
  Sleep 2000
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'taskkill /F /IM "NativeBlade Studio.exe"'
  Sleep 2000
!macroend

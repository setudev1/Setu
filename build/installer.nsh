; Custom steps for the Setu Windows installer (electron-builder NSIS hooks).
; Ollama is NOT installed here. Setu offers to download and set it up itself the first time it opens
; ("Set up Ollama for me"), so the installer stays small and the user never sees a second installer prompt.

!macro customInstall
!macroend

!macro customUnInstall
  ; Chats, settings and checkpoints are kept on purpose, so reinstalling brings everything back.
!macroend

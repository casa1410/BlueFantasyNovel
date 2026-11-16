; Incluido automáticamente por electron-builder en el instalador NSIS.
;
; "Abrir al iniciar Windows" (src/main/startup.ts) empieza desactivado: la app
; no crea la entrada hasta que se activa en Ajustes. Al desinstalar se borra,
; así que una instalación nueva tampoco arranca sola. En una actualización
; (el instalador nuevo ejecuta el desinstalador viejo) se conserva.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "BlueFantasyNovel"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "BlueFantasyNovel"
  ${endIf}
!macroend

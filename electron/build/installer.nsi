Unicode true
!include "MUI2.nsh"
Name "Movie max"
OutFile "/tmp/desktop-release/MovieMax-Setup.exe"
InstallDir "$PROGRAMFILES64\Movie max"
RequestExecutionLevel admin
VIProductVersion "2.5.0.0"
VIAddVersionKey "ProductName" "Movie max"
VIAddVersionKey "CompanyName" "Movie max"
VIAddVersionKey "FileDescription" "Movie max Setup"
VIAddVersionKey "FileVersion" "2.5.0"
VIAddVersionKey "LegalCopyright" "Movie max"
SetCompressor /SOLID lzma
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to Movie max"
!define MUI_WELCOMEPAGE_TEXT "Movies, series, Luganda and Live TV on your computer.$\r$\n$\r$\nClick Install to continue."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Movie max.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Movie max"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Create a desktop shortcut"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION DeskShortcut
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function DeskShortcut
  CreateShortcut "$DESKTOP\Movie max.lnk" "$INSTDIR\Movie max.exe"
FunctionEnd
Section
  SetShellVarContext all
  nsExec::Exec 'taskkill /F /IM "Movie max.exe"'
  SetOutPath "$INSTDIR"
  File /r "/tmp/desktop-release/Movie max-win32-x64/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Movie max"
  CreateShortcut "$SMPROGRAMS\Movie max\Movie max.lnk" "$INSTDIR\Movie max.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MovieMax" "DisplayName" "Movie max"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MovieMax" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MovieMax" "DisplayIcon" "$INSTDIR\Movie max.exe"
SectionEnd
Section "Uninstall"
  SetShellVarContext all
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\Movie max.lnk"
  RMDir /r "$SMPROGRAMS\Movie max"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MovieMax"
SectionEnd

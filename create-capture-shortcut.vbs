' Double-click to put a "Folium Quick Capture" shortcut on your Desktop with a
' global hotkey (Ctrl+Alt+F). Windows activates .lnk hotkeys with a ~1s delay.
' Works even when the Folium launcher isn't running: the installed service
' worker serves the app shell, and #/capture opens the capture modal.
Set ws = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Set lnk = ws.CreateShortcut(ws.SpecialFolders("Desktop") & "\Folium Quick Capture.lnk")
lnk.TargetPath = "explorer.exe"
lnk.Arguments = "http://localhost:4173/#/capture"
lnk.IconLocation = dir & "\public\brand\folium.ico"
lnk.Hotkey = "Ctrl+Alt+F"
lnk.Description = "Folium quick capture"
lnk.Save
MsgBox "Quick-capture shortcut created on your Desktop (hotkey: Ctrl+Alt+F).", 64, "Folium"

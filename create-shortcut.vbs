' Double-click to put a "Folium" shortcut on your Desktop.
' It launches Folium with no console window (start-folium-hidden.vbs).
Set ws = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Set lnk = ws.CreateShortcut(ws.SpecialFolders("Desktop") & "\Folium.lnk")
lnk.TargetPath = "wscript.exe"
lnk.Arguments = """" & dir & "\start-folium-hidden.vbs"""
lnk.WorkingDirectory = dir
lnk.IconLocation = dir & "\public\brand\folium.ico"
lnk.Description = "Folium - local visual workspace"
lnk.Save
MsgBox "Folium shortcut created on your Desktop.", 64, "Folium"

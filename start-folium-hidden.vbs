' Runs the Folium launcher with no visible console window.
Set WShell = CreateObject("WScript.Shell")
WShell.Run "cmd /c """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\start-folium.bat""", 0, False

@echo off
set JAVA_HOME=C:\Users\Janardhanan\Documents\Projects\DDML\.tools\jdk21
set ANDROID_HOME=C:\Users\Janardhanan\Documents\Projects\DDML\.tools\android-sdk
cd /d C:\Users\Janardhanan\Documents\Projects\DDML\android
"C:\Users\Janardhanan\Documents\Projects\DDML\.tools\gradle\gradle-8.14.3\bin\gradle.bat" assembleDebug --console=plain > ..\android-build.log 2>&1
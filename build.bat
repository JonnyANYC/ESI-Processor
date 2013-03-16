@ECHO off

IF NOT EXIST install.rdf GOTO usage
IF NOT EXIST ..\build\NUL MD ..\build

zip -r -FS ../build/esi_processor.xpi * -x .hg -x build.bat
GOTO done

:usage

echo ERROR: Run this from the ./src/ directory.

:done

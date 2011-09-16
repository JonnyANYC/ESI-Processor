#!/bin/bash

cd /cygdrive/d/dev/esi_processor/src/

zip -r -u ../build/esi_processor.xpi * -x .hg -x build.bat

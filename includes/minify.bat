@echo off

SET "OPTIONS=-c booleans_as_integers,ecma=6,keep_fargs=false,passes=3,toplevel,unsafe,unsafe_math,warnings,arguments,hoist_funs -m"
SET "OPTIONS_KEEPTOP=-c booleans_as_integers,ecma=6,keep_fargs=false,passes=3,unsafe,unsafe_math,warnings,arguments -m"

echo Minifying consolelog.js
call terser script/consolelog.js -o min/consolelog.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying querystatus.js
call terser script/querystatus.js -o min/querystatus.min.js %OPTIONS%
echo.

echo Minifying animate.js
call terser script/animate.js -o min/animate.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying nav.js
call terser script/nav.js -o min/nav.min.js %OPTIONS%
echo.

echo Minifying index.js
call terser script/index.js -o min/index.min.js %OPTIONS%
echo.

echo Minifying requests.js
call terser script/requests.js -o min/requests.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying request.js
call terser script/request.js -o min/request.min.js %OPTIONS%
echo.

echo Minifying new_request.js
call terser script/new_request.js -o min/new_request.min.js %OPTIONS%
echo.

echo Minifying user_settings.js
call terser script/user_settings.js -o min/user_settings.min.js %OPTIONS%
echo.

echo Minifying login.js
call terser script/login.js -o min/login.min.js %OPTIONS%
echo.

echo Minifying register.js
call terser script/register.js -o min/register.min.js %OPTIONS%
echo.

echo Minifying activity.js
call terser script/activity.js -o min/activity.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying tableCommon.js
call terser script/tableCommon.js -o min/tableCommon.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying common.js
call terser script/common.js -o min/common.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying overlay.js
call terser script/overlay.js -o min/overlay.min.js %OPTIONS_KEEPTOP%
echo.

echo Minifying forgot.js
call terser script/forgot.js -o min/forgot.min.js %OPTIONS%
echo.

echo Minifying reset.js
call terser script/reset.js -o min/reset.min.js %OPTIONS%
echo.

echo Minifying library.js
call terser script/library.js -o min/library.min.js %OPTIONS%
echo.

echo Minifying password_reset.js
call terser script/password_reset.js -o min/password_reset.min.js %OPTIONS%
echo.

echo Done!
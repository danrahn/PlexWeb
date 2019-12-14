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
call terser script/requests.js -o min/requests.min.js %OPTIONS%
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

echo Done!
@echo off
title Cow Visioning Server (Port 2609)
color 0a
cd /d "%~dp0"
echo ===========================================
echo Starting Cow Visioning Server...
echo Connecting to Database and opening Port 2609...
echo ===========================================
node server.js
pause

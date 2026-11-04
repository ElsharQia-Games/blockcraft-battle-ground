@echo off
title Blockcraft Battle Ground
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to host a LAN game: https://nodejs.org
  echo You can still double-click index.html and play solo or join an online room.
  pause
  exit /b 1
)
start "" http://localhost:8080
node "%~dp0server.js"
pause

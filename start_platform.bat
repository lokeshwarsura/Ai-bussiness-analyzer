@echo off
title AI Business Analytics & Marketing Platform Launcher
echo ====================================================================
echo      Starting AI Business Analytics & Marketing Intelligence Platform
echo ====================================================================
echo.

:: 1. Start FastAPI Backend in a new background window
echo [1/3] Launching FastAPI Backend on Port 8000...
start "FastAPI Backend" cmd /k "python -m uvicorn backend.app.main:app --reload --port 8000"

:: 2. Start Vite React Frontend in a new background window
echo [2/3] Launching Vite React Frontend on Port 5174...
start "Vite React Frontend" cmd /k "cd frontend && npm run dev"

:: 3. Wait 3 seconds for servers to initialize
echo.
echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

:: 4. Open the browser to the local frontend address
echo opening dashboard in browser...
start http://localhost:5174/

echo.
echo ====================================================================
echo  Platform is now running!
echo  - Backend API: http://localhost:8000
echo  - Frontend UI: http://localhost:5174
echo.
echo  Keep the terminal windows open while using the platform.
echo ====================================================================
echo.
pause

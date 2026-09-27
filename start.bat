@echo off
echo Starting Python Web Application for SKPT Computer Lab...
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" app.py
) else (
    python app.py
)
pause

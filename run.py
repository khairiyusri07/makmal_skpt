"""
Starter script for SKPT Computer Lab Python Web Application
Runs app.py using the Python virtual environment (.venv) if available.
"""
import os
import sys
import subprocess

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(base_dir, '.venv', 'Scripts', 'python.exe')
    
    if os.path.exists(venv_python):
        python_exe = venv_python
    else:
        python_exe = sys.executable

    app_py = os.path.join(base_dir, 'app.py')
    print(f"Starting Python Web Application with: {python_exe}")
    subprocess.run([python_exe, app_py])

if __name__ == '__main__':
    main()

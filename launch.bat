@echo off

:: Opens Windows Terminal, sets the title, starts the backend, 
:: then adds a new tab for the frontend.
wt -w 0 nt -d "M:\Projects\PFE\backend" --title "Backend" cmd /k "python main.py" ; nt -d "M:\Projects\PFE\frontend" --title "Frontend" cmd /k "npm run dev"
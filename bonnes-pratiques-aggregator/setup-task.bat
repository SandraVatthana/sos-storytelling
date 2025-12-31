@echo off
echo ========================================
echo   Configuration Tache Planifiee
echo ========================================
echo.

:: Creer la tache planifiee
schtasks /create /tn "Bonnes Pratiques Aggregator" /tr "wscript.exe \"C:\Users\sandr\OneDrive\Bureau\SOS STORYTELLING&PERSONAL BRANDING\bonnes-pratiques-aggregator\run-silent.vbs\"" /sc daily /st 08:00 /f

echo.
if %errorlevel% == 0 (
    echo ✅ Tache planifiee creee avec succes !
    echo.
    echo La tache s'executera tous les jours a 8h00
    echo.
    echo Pour modifier l'heure :
    echo   - Ouvre "Planificateur de taches" (taskschd.msc)
    echo   - Trouve "Bonnes Pratiques Aggregator"
    echo   - Double-clic pour modifier
) else (
    echo ❌ Erreur lors de la creation
    echo Essaie de lancer ce script en tant qu'administrateur
)

echo.
pause

@echo off
echo ========================================
echo    Bonnes Pratiques Aggregator
echo ========================================
echo.

cd /d "C:\Users\sandr\OneDrive\Bureau\SOS STORYTELLING&PERSONAL BRANDING\bonnes-pratiques-aggregator"

echo Lancement du traitement...
echo.

node index.js

echo.
echo ========================================
echo Traitement termine !
echo ========================================

:: Garde la fenetre ouverte 5 secondes pour voir le resultat
timeout /t 5

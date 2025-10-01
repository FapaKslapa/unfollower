@echo off
setlocal enabledelayedexpansion

echo ===================================
echo Instagram Unfollower - Installer
echo ===================================
echo.

:: Verifica se Node.js è installato
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js non trovato. Installazione in corso...
    
    :: Crea cartella temporanea
    mkdir "%TEMP%\node-install" 2>nul
    cd /d "%TEMP%\node-install"
    
    :: Scarica Node.js LTS
    echo Scaricamento di Node.js...
    curl -L -o node-setup.msi https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi
    
    :: Installa Node.js
    echo Installazione di Node.js...
    start /wait msiexec /i node-setup.msi /quiet /norestart
    
    :: Pulisci i file temporanei
    cd /d "%~dp0"
    rmdir /s /q "%TEMP%\node-install"
    
    :: Aggiorna il PATH per questa sessione
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
    echo Node.js installato con successo!
) else (
    echo Node.js già installato.
)

:: Verifica la versione di Node.js
for /f "tokens=*" %%a in ('node --version') do set NODE_VERSION=%%a
echo Versione Node.js: %NODE_VERSION%
echo.

:: Verifica se pnpm è installato
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo pnpm non trovato. Installazione in corso...
    npm install -g pnpm
    echo pnpm installato con successo!
) else (
    echo pnpm già installato.
)

:: Verifica la versione di pnpm
for /f "tokens=*" %%a in ('pnpm --version') do set PNPM_VERSION=%%a
echo Versione pnpm: %PNPM_VERSION%
echo.

:: Vai alla directory del progetto
cd /d "%~dp0"

:: Verifica se node_modules esiste
if not exist "node_modules\" (
    echo Installazione delle dipendenze...
    pnpm install
    if %ERRORLEVEL% NEQ 0 (
        echo Errore nell'installazione delle dipendenze. Provo con npm...
        npm install
    )
    echo Dipendenze installate con successo!
) else (
    echo Le dipendenze sono già installate.
    echo Per reinstallare, eliminare la cartella node_modules e rieseguire questo script.
)
echo.

echo ===================================
echo Avvio Instagram Unfollower...
echo ===================================
echo.

:: Esegui il programma
pnpm start

:: Mantieni aperta la finestra alla fine dell'esecuzione
echo.
echo Esecuzione terminata. Premi un tasto per chiudere questa finestra.
pause > nul
endlocal
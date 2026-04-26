# Opens three terminal windows running backend, ngrok, and frontend
$root = $PSScriptRoot

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\ecoclaim-backend'; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "ngrok http 8000"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\ecoclaim-frontend'; npm run dev"
)

Write-Host "Started backend, ngrok, and frontend in separate windows."
Write-Host "Don't forget to update ecoclaim-frontend\.env if the ngrok URL changed."
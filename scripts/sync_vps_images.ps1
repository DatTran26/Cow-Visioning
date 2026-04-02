# Sync Images from VPS to Local (Cow-Visioning)
# Run from within the project root folder (d:\Projects\Git Public\Cow-Visioning)

$VPS_IP = "180.93.2.32"       # From .env
$VPS_USER = "cowapp"         # From docs/VPS_QUICKSTART.md
$VPS_PATH = "/home/cowapp/myapp/uploads" # From docs/VPS_QUICKSTART.md Step 150
$LOCAL_PATH = ".\uploads"

Write-Host "`n---[ Cow-Visioning Image Sync ]---" -ForegroundColor Cyan
Write-Host "Syncing from: ${VPS_USER}@${VPS_IP}:${VPS_PATH}" -ForegroundColor Cyan
Write-Host "Local destination: (Get-Location)\${LOCAL_PATH}`n" -ForegroundColor Cyan

# Check if scp is available
if (!(Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'scp' not found. Please install OpenSSH or run from Git Bash." -ForegroundColor Red
    exit 1
}

# Use scp to recursively copy all files from VPS uploads to local uploads
# This will ask for the password for user 'cowapp'
Write-Host "Running: scp -r ${VPS_USER}@${VPS_IP}:${VPS_PATH}/* $LOCAL_PATH" -ForegroundColor Gray
scp -r "${VPS_USER}@${VPS_IP}:${VPS_PATH}/*" $LOCAL_PATH

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Sync completed successfully!" -ForegroundColor Green
    Write-Host "Now you can refresh your local Gallery and see images correctly." -ForegroundColor Green
} else {
    Write-Host "`n❌ Error: Sync failed. Please check your SSH connection or password." -ForegroundColor Red
    Write-Host "Hint: Try ssh ${VPS_USER}@${VPS_IP} first to test access." -ForegroundColor Yellow
}

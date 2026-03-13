@echo off
echo Starting Secure File Storage System (Node + React)...

REM Build and run Node backend
start cmd /k "cd backend_node && title Node.js Backend && echo Installing dependencies... && npm install && echo Starting backend... && npm run dev"

REM Run React frontend
start cmd /k "cd frontend_react && title Vite React Frontend && echo Installing dependencies... && npm install && echo Starting frontend... && npm run dev"

echo Both servers are starting!
echo Node.js Backend will be running at: http://localhost:8000
echo React Frontend will be available at: http://localhost:5173
echo.
echo Make sure PostgreSQL is running on localhost (postgres:postgres@localhost:5432/securevault)
echo If your credentials differ, please update backend_node/.env
echo.
echo Demo Instructions:
echo 1. Open http://localhost:5173
echo 2. Click "Create Account" and make an admin account (Role: Admin)
echo 3. Login to your account
echo 4. Upload a file on the Dashboard
echo 5. View Activity Logs and Users in the Admin Panel

pause

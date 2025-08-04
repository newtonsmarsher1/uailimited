@echo off
echo Setting up investments table...
node create-investments-table.js
echo.
echo Adding savings balance column...
node add-savings-balance.js
echo.
echo Fixing investment durations...
node fix-investment-durations.js
echo.
echo Investment system setup completed!
pause 
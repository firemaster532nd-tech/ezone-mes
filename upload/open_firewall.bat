@echo off
echo ====================================================
echo EZONE MES 로컬 LAN 다른 PC 접속용 방화벽 포트(5173, 3000) 개방
echo ====================================================

netsh advfirewall firewall add rule name="EZONE MES Vite 5173" protocol=TCP dir=in action=allow localport=5173
netsh advfirewall firewall add rule name="EZONE MES Backend 3000" protocol=TCP dir=in action=allow localport=3000

echo.
echo [성공] 포트 5173 및 3000 개방 완료!
echo 다른 PC 브라우저에서 아래 주소로 접속하세요:
echo http://172.30.1.51:5173
echo.
pause

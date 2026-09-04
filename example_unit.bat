@echo off
set "LOG_FILE=%~dp0execucao_mrp.log"

echo =================================================== >> "%LOG_FILE%"
echo [%DATE% %TIME%] Iniciando rotina de MRP (Usuario: manager) >> "%LOG_FILE%"

:: Muda para a pasta do Beas
cd /d "C:\Program Files\beas software\beas"

:: O uso do 'start /wait' garante que o script do DOS espere o BEAS terminar de processar antes de ir para a próxima linha
start /wait "" beas.exe server=NDB@cobrah:30013 db=SBO_COBRA_PRD user=manager pw=B1admin@ /inservermode script="<cr_lf>object=ue_mrp=calc=1<cr_lf>app=close<cr_lf>"

echo [%DATE% %TIME%] Rotina finalizada >> "%LOG_FILE%"

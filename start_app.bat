rem
rem starting app ...
rem
docker run -d --rm ^
--name app ^
-p 0.0.0.0:5000:5000 ^
-v "%CD%\dbhist_viewer":/app ^
-e db_ora122="system/Oradoc_db1@oradb:1521/ORCLCDB.localdomain" ^
-e PYTHONUNBUFFERED=1 ^
--link ora122:oradb ^
flask_cx_oracle:dev

rem 
rem app started !
rem
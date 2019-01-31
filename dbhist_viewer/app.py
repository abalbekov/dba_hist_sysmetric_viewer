import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from build_detail_sql_str import *
from build_summary_sql_str import *
from time import sleep
import datetime
import os

app = Flask(__name__, static_url_path='/static')


# function to return connection from global object if connection exist;
# otherwise, open connection and save it in the g object for later use
conn_dict = {}
def get_db_connection(conn_name):
    if conn_name not in conn_dict:
        conn_dict[conn_name] = cx_Oracle.connect(os.environ[conn_name], threaded=True)
    return conn_dict[conn_name]

@app.route('/get_credentials')
def get_credentials():
    # extract from env variables those starting with "db"
    return jsonify(
       [ conn_name for conn_name in list(os.environ) if conn_name.lower().startswith("db") ])


#--
# generate DBMS_SQLTUNE report_sql_monitor report
#--
@app.route('/dbms_sqltune_report_sql_monitor', methods = ['POST'])
def dbms_sqltune_report_sql_monitor():
    
    print('dbms_sqltune_report_sql_monitor(): request.form: ', request.form)
	
    v_conn_name     =request.form['conn_name']
    v_sql_id        =request.form['sql_id']
    v_sql_exec_start=request.form['sql_exec_start'] 
    # incoming format: '2017-11-08T11:36:42'
    v_sql_exec_start=datetime.datetime.strptime(v_sql_exec_start, '%Y-%m-%dT%H:%M:%S')
    v_sql_exec_id   =request.form['sql_exec_id']
	
    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    if not con:
       return []
       
    cursor = con.cursor()
    v_sql_str = """
                SELECT DBMS_SQLTUNE.report_sql_monitor(
                 sql_id => :1
                ,sql_exec_start=>:2
                ,sql_exec_id=>:3
                ,report_level => 'all') from dual
                """

    cursor.execute(v_sql_str, (v_sql_id,v_sql_exec_start,v_sql_exec_id))
    report = cursor.fetchone()
    report = str(report[0])
    print ('report:', report)
    cursor.close()
#    con.close()
    return report



#--
# provide number of RAC instances
#--
@app.route('/rac_instances', methods = ['POST'])
def rac_instances():

    #v_conn_name=request.args.get('conn_name')
    print('rac_instances(): request.form : ', request.form)
    print('rac_instances(): request : ', request)
    
    v_conn_name=request.form.get('conn_name')
    print('rac_instances(): v_conn_name : ', v_conn_name)

    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    print ('rac_instances(): ', con.version)
    
    if not con:
       return []
       
    cursor = con.cursor()
    cursor.execute("""select count(1) from gv$instance""")
    inst_cnt = cursor.fetchone()
    print ('inst_cnt:', inst_cnt)
    cursor.close()
#    con.close()
    return str(inst_cnt[0])
        
#--
# provide unique metric names data from DBA_HIST_SYSMETRIC_HISTORY
#--  
@app.route('/metric_names')
def metric_names():
    v_conn_name=request.args.get('conn_name')
    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    
    print (con.version)
    
    if not con:
       return [] #need to return error here and display the error in ajax error handle ..
    
    cursor = con.cursor()
    cursor.execute("""-- below is to get derived metric names (ones where there is 'Per Txn' but there is no matching 'Per Sec' metric)
                      -- these will be derived from 'Per Txn' knowing Txn per Sec
                      with A as (
                      select distinct
                      metric_unit
                      ,substr(metric_name, -7) as PER
                      ,substr(metric_name, 1, instr(metric_name, 'Per', -1) -2 ) as metric_name_substr
                      from DBA_HIST_SYSMETRIC_HISTORY
                      where begin_time between sysdate-3 and sysdate
                      and (metric_name like '%Per Txn' or metric_name like '%Per Sec')
                      )
                      -- derived metrics
                      select null as metric_id
                      , metric_name_substr || ' Per Sec - Derived' as metric_name 
                      , replace(metric_unit,'Per Txn','Per Second') as metric_unit
                      from a where per='Per Txn'
                      minus
                      select null as metric_id
                      ,metric_name_substr || ' Per Sec - Derived' as metric_name 
                      ,metric_unit
                      from a where per='Per Sec'
                      UNION ALL
                      -- normal metrics
                      select distinct metric_id, metric_name, metric_unit from DBA_HIST_SYSMETRIC_HISTORY
                      where begin_time between sysdate-3 and sysdate
                   """)
			   
    columns = [i[0] for i in cursor.description]
    ret=[dict(zip(columns, row)) for row in cursor]

    cursor.close()   
    return jsonify (ret)

#--
# provide unique metric names data from DBA_HIST_SYSMETRIC_SUMMARY
#--  
@app.route('/summary_metric_names')
def summary_metric_names():
    v_conn_name=request.args.get('conn_name')
    con = get_db_connection(v_conn_name)
    
    print (con.version)
    
    if not con:
       return [] #need to return error here and display the error in ajax error handle ..
    
    cursor = con.cursor()
    cursor.execute("""
                    -- below is to get derived metric names (ones where there is 'Per Txn' but there is no matching 'Per Sec' metric)
                    -- these will be derived from 'Per Txn' knowing Txn per Sec
                    with A as (
                    select distinct
                    metric_unit
                    ,substr(metric_name, -7) as PER
                    ,substr(metric_name, 1, instr(metric_name, 'Per', -1) -2 ) as metric_name_substr
                    from DBA_HIST_SYSMETRIC_SUMMARY
                    where begin_time between sysdate-3 and sysdate
                    and (metric_name like '%Per Txn' or metric_name like '%Per Sec')
                    )
                    -- derived metrics
                    select null as metric_id
                    , metric_name_substr || ' Per Sec - Derived' as metric_name 
                    , replace(metric_unit,'Per Txn','Per Second') as metric_unit
                    from a where per='Per Txn'
                    minus
                    select null as metric_id
                    ,metric_name_substr || ' Per Sec - Derived' as metric_name 
                    ,metric_unit
                    from a where per='Per Sec'
                    UNION ALL
                    -- normal metrics
                    select distinct metric_id, metric_name, metric_unit from DBA_HIST_SYSMETRIC_SUMMARY
                    where begin_time between sysdate-3 and sysdate
                   """)
               
    columns = [i[0] for i in cursor.description]
    ret=[dict(zip(columns, row)) for row in cursor]

    cursor.close()  
    
    return jsonify (ret)

#--
# provide data from SQL_MONITOR
#--  
@app.route('/get_sql_monitor_object', methods = ['POST'])
def get_sql_monitor_object():

    print("get_sql_monitor_object() request.form['conn_name']: ", request.form['conn_name'])
    v_conn_name=request.form['conn_name']
    browzer_tz_name=request.form['browzer_tz_name']
    
    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    print (con.version)
    
    if not con:
       return [] #need to return error here and display the error in ajax error handle ..
    
    cursor = con.cursor()
    cursor.arraysize = 500
    
    # Using "select *" to be flexible with different oracle versions 
    # having different columns in gv$sql_monitor.
    # cx_Oracle will get all columns with select "*" and send it to browser in JSON.
    # Browser's javascript will display all received fields as datatables's child row
    v_sql="""select 
				cast((from_tz(cast(SQL_EXEC_START as timestamp),DBTIMEZONE) at time zone '{str5}') as date) as SQL_EXEC_START_browser_tz
				,m.* 
			from gv$sql_monitor m order by sql_exec_start, elapsed_time""".format(str5=browzer_tz_name)
    
    print(v_sql)
    cursor.execute(v_sql)
    
    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage
    def generate():
        columns = [i[0] for i in cursor.description]
        row = cursor.fetchone()
        #ret=dict(zip(columns, row)) if (row != None) else None
        #ret=dict(zip_longest(columns, row if (row != None) else []))
        if row == None:
            ret=dict.fromkeys(columns)
        else:
            ret=dict(zip(columns, row))
        
        # json.dumps helper to convert 
        # "json-unfriendly" columns (date, clob, raw) to string 
        def dthandler(obj):
           # convert oracle's DATE to string
           if isinstance(obj, datetime.datetime): 
               return obj.isoformat() 
           # simulate oracle's RAWTOHEX
           elif isinstance(obj, bytes): 
               return obj.hex()
           # simulate oracle's TO_CHAR
           elif isinstance(obj, cx_Oracle.LOB): 
               return str(obj)
           # otherwise original default
           else: 
               return json.JSONEncoder().default(obj)

        ret="[\n"+json.dumps(ret,default=dthandler)+"\n"
        yield ret
        # 50 ms sleep is a workaround for issue with response occasionally 
        # streaming first yield (containing opening bracket)
        # out of order, after couple of first rows
        # which breaks json syntax in browser ajax
        sleep(0.05) 
        for row in cursor:
            if row == None:
                ret=dict.fromkeys(columns)
            else:
                ret=dict(zip(columns, row))

            ret=","+json.dumps(ret,default=dthandler)+"\n"
            yield ret
        yield "]"
        
    return Response(generate(), mimetype='application/json')

#--
# provide detailed chart data sourced from DBA_HIST_SYSMETRIC_HISTORY
#--  
@app.route('/chart_data_detail', methods = ['POST'])
def chart_data_detail():
    post_data_dict=request.get_json()
    print(post_data_dict)
        # this gives {'conn_name': 'ewdb_ste_system', 'selected_instance':'1' ,'metric_names': ['some metric_name','DB Block Changes Per Sec - Derived']}
    v_conn_name=post_data_dict['conn_name']
    v_selected_instance=post_data_dict['selected_instance']
    metric_list=post_data_dict['metric_names']
    start_date=post_data_dict['date_range'][0]
    end_date=post_data_dict['date_range'][1]
    print("date_range : ", start_date, end_date)
    browser_tz_offset_sec=post_data_dict['browser_tz_offset_sec']
    browzer_tz_name=post_data_dict['browzer_tz_name']
    print("browzer_tz_name : ", browzer_tz_name)
    print("browser_tz_offset_sec :", browser_tz_offset_sec)
    
    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    print (con.version)
       
    cursor = con.cursor()
    cursor.arraysize = 50
    
    # determine how many instances are there
    cursor.execute("""select count(1) from gv$instance""")
    rec = cursor.fetchone()
    v_rac_instances = rec[0]
    print ('v_rac_instances:', v_rac_instances)

    v_sql_str=build_detail_sql(v_rac_instances, v_selected_instance, metric_list,browzer_tz_name)

    print(v_sql_str)
    cursor.execute(v_sql_str, (start_date, end_date) )

    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage
	
    # returning Array-formatted stream
    def generate():
        row = cursor.fetchone()
        ret="[\n"+json.dumps(row)+"\n"
        yield ret
        sleep(0.05)         
        for row in cursor:
            ret=","+json.dumps(row)+"\n"
            yield ret
        yield "]"
    return Response(generate(), mimetype='application/json')
	
#--
# provide summary chart data sourced from DBA_HIST_SYSMETRIC_SUMMARY
#--
@app.route('/chart_data_summary', methods = ['POST'])
def chart_data_summary():
    post_data_dict=request.get_json()
    print(post_data_dict)
        # this gives {'conn_name': 'ewdb_ste_system', 'selected_instance':'1' ,'metric_names': ['some metric_name','DB Block Changes Per Sec - Derived']}
    
    v_conn_name=post_data_dict['conn_name']
    v_selected_instance=post_data_dict['selected_instance']
    metric_list=post_data_dict['metric_names']
    browzer_tz_name=post_data_dict['browzer_tz_name']

    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    print (con.version)
   
    cursor = con.cursor()
    cursor.arraysize = 50
    
    v_selected_instance=post_data_dict['selected_instance']
    
    # determine how many instances are there
    cursor.execute("""select count(1) from gv$instance""")
    rec = cursor.fetchone()
    v_rac_instances = rec[0]
    print ('v_rac_instances:', v_rac_instances)

    v_sql_str=build_summary_sql(v_rac_instances, v_selected_instance, metric_list,browzer_tz_name)

    print(v_sql_str)
    cursor.execute(v_sql_str)

    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage
    
    # returning Array-formatted stream
    def generate():
        row = cursor.fetchone()
        ret="[\n"+json.dumps(row)+"\n"
        yield ret
        sleep(0.05)         
        for row in cursor:
            ret=","+json.dumps(row)+"\n"
            yield ret
        yield "]"
    return Response(generate(), mimetype='application/json')
    
# for testing:
if __name__ == '__main__':
    #(host='0.0.0.0') below is to bind it to all interfaces
    app.run(host='0.0.0.0', threaded=True)
    # app.run(debug=False, threaded=True)
    # Alternatively
    #app.run(processes=3)

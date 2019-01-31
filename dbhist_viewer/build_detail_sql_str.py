def build_detail_sql(rac_instances, selected_instance, metric_list, browzer_tz_name):
    
    # Algorithm to aggregate *Derived metrics over all instances:
    #
    # we can not sum records over all instances "*Per Txn" and "User Txn Per Sec" metrics then multiply
    # the formula should be sum(a*b)+sum(c*d) and not sum(a)*sum(b) + sum(c)*sum(d)
    #
    # "*- Derived" metric name is converted to "*Per Txn" metric name
    # and converted to sum of products of "*Per Txn" by "User Txn Per Sec"
    #
    # 
    str1_list=[]; str2_list=[]; str3_list=[]
    m_cnt = 0
    for metric in metric_list:
        m_cnt += 1
        base_metric = metric.replace('Per Sec - Derived','Per Txn')
        str1_list.append(base_metric)
        str2_instance_list=[]
        str3_instance_list=[]
        inst_range=range(rac_instances) if 'all' in str(selected_instance) else [selected_instance-1]
        for inst in inst_range:
            str2_instance_list.append('f'+str(m_cnt)+str(inst+1)+('*TPS'+str(inst+1) if 'Derived' in metric else ''))
            str3_instance_list.append("'"+base_metric+" - instance"+str(inst+1)+"' as f"+str(m_cnt)+str(inst+1))            

        if selected_instance == 'all-aggregate':
            str2_list.append('+'.join(str2_instance_list))
        else:
            str2_list.append(','.join(str2_instance_list))
            
        str3_list.append(",".join(str3_instance_list))
    
    str1_with_in  = "'"+"','".join(str1_list)+"'"
    str2_pivot_select = "begin_time,"+",".join(str2_list)
    str3_pivot_in = ",".join(str3_list)
    str4_instance = "" if 'all' in str(selected_instance) else "and instance_number = "+str(selected_instance)
    # adding TPS
    str1_with_in+= ",'User Transaction Per Sec'"
    str3_instance_list=[]
    for inst in range(rac_instances):
        str3_instance_list.append("'User Transaction Per Sec - instance"+str(inst+1)+"' as TPS"+str(inst+1))
    str3_pivot_in += ","+",".join(str3_instance_list)
    
    #print ('str1_with_in     : ', str1_with_in )
    #print ('str2_pivot_select: ', str2_pivot_select)
    #print ('str3_pivot_in    : ', str3_pivot_in )
    #print ('str4_instance    : ', str4_instance )


    v_sql = """
                with pivot_data AS (
                select to_char(round(
                            cast((from_tz(cast(begin_time as timestamp),DBTIMEZONE) at time zone '{str5}') as date)
                            ,'MI'),'YYYY/MM/DD HH24:MI:SS') as begin_time
                    , trunc(value,2) as value
                    , metric_name || ' - instance' || instance_number as metric_name
                from DBA_HIST_SYSMETRIC_HISTORY
                where metric_name in ( {str1} )
                {str4}
                and begin_time between 
                    cast((from_tz(cast(DATE '1970-01-01' as timestamp),'{str5}') at time zone DBTIMEZONE) as date)
                      + ( 1 / 24 / 60 / 60 )/1000 * :1 
                    and 
                    cast((from_tz(cast(DATE '1970-01-01' as timestamp),'{str5}') at time zone DBTIMEZONE) as date)
                      + ( 1 / 24 / 60 / 60 )/1000 * :2 
                )
                select {str2}
                from pivot_data
                pivot
                    ( sum(value)
                    for metric_name
                    in ( {str3} )
                    )
                order by begin_time desc""".format(str1=str1_with_in, str2=str2_pivot_select, str3=str3_pivot_in, str4=str4_instance, str5=browzer_tz_name)
               
    return v_sql


# below is for testing
if __name__ == '__main__':
    rac_instances=2
    metric_list=["Logical Reads Per Sec - Derived","Redo Generated Per Sec"]
    
    selected_instance='all-stacked'
    v_sql = build_sql(rac_instances, selected_instance, metric_list)
    print(selected_instance,v_sql)

    selected_instance='all-aggregate'
    v_sql = build_sql(rac_instances, selected_instance, metric_list)
    print(selected_instance,v_sql)

    selected_instance=1
    v_sql = build_sql(rac_instances, selected_instance, metric_list)
    print(selected_instance,v_sql)

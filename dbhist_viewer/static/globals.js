// store and exchange Globals between modules
let gl={ 
         'gDbCredential'        : ""
		,'gRacInstSelected'     : 'all-aggregate'	// can be 'all-aggregate','all-stacked' or instance number
		,'gRacInstanceCnt'      : 1
		,'gSelectedMetrics'     : []
		,'gSelectedMetricUnits' : []
		,'gSqlMonitorData'      : []
		,'gDataTbl'             : undefined
		,'gDbaHistSource'       : 'dba_hist_sysmetric_history' // can also be "dba_hist_sysmetric_summary"
		//,'gDbaHistSourcexAxisRange':[]
		,'gChartDataDetail'     : [] // data loaded so far from dba_hist_sysmetric_history
		,'dg'                   : {} // dygraph object
		,'maxDownloadedDate'    : undefined
		,'minDownloadedDate'    : undefined
		,'api_root'				: ''
		//,'api_root'				: 'https://u6pic3x198.execute-api.us-east-1.amazonaws.com/dev'
		,'summary_metric_names' : []
		,'detail_metric_names'  : []
};
export default gl;
import gl           from "./globals.js"
import {emptyGraph, buildGraph} from "./graph.js"
import {getMetricNames} from "./metricsSelector.js"

// define chart source selector behavior
export function defineChartSrcSel(){

	// initially disable
	$('#chart_source option').prop('disabled',true);
	$('#chart_source').select2({minimumResultsForSearch: Infinity});
	
	/* when metric source is changed : 
		 toggle chart data source title on web page 
	     clear downloaded data 
	     replace available metrics list
		 remove metrics no longer available from list of selected metrics and from graph legend
	     change visible chart date window
	     and redraw graph
	*/
	$('#chart_source').on('select2:select', function (e) {
		// toggle chart data source title on web page
		var selectedValue = e.params.data["text"];
		gl.gDbaHistSource=selectedValue;
		$('.chart h2').text(selectedValue);

		// clear downloaded data
		gl.gChartDataDetail=[];
		gl.minDownloadedDate=gl.maxDownloadedDate;

		// replace available metrics list
		getMetricNames();

		// remove selected metrics no longer available in list of metrics
		if (selectedValue=='dba_hist_sysmetric_history'){
			gl.gSelectedMetrics=
				gl.gSelectedMetrics.filter(function(metric) {
					return gl.detail_metric_names.find(
									function(item){
										return item.METRIC_NAME === metric;}
								);
				});
		}
		else if (selectedValue=='dba_hist_sysmetric_summary'){
			gl.gSelectedMetrics=
				gl.gSelectedMetrics.filter(function(metric) {
					return gl.summary_metric_names.find(
									function(item){
										return item.METRIC_NAME === metric;}
								);
				});
		}
		// remove from graph legend metrics no longer available 
		var legendMetric;
		$('form.form_chart_items label')
			.each(function(){
				var $label=$(this);
				var legendMetric=$(this)[0].children[0].value;
				gl.gSelectedMetrics.forEach(
					function(item,idx){
						if ( item != legendMetric ){
							$label.remove();
						}
					}
				);
			});
		
		// change visible chart date window
		var newEnd=new Date();
		if (selectedValue=='dba_hist_sysmetric_history'){
			// for details the source resolution is 1 mins
			// set window to 240*1 mins
			var newBegin=new Date( newEnd.getTime()-240*60*1000);
			var newRollPeriod=10;
			//var newEnd  =new Date( curRange[0].getTime()+curWidthMs+240*60*1000);
		} else {
			// for summary the source resolution is about 30min-1hr
			// set window to 240*30 mins
			var newBegin=new Date( newEnd.getTime()-240*30*60*1000);
			var newRollPeriod=3;
		}

		// and redraw graph
		gl.dg.updateOptions({
						 file      : [[newBegin,0],[newEnd,0]]
						,dateWindow: [newBegin,newEnd]
						,rollPeriod: newRollPeriod});
		buildGraph();
		//createSqlMonitorDataTable();
	});
	
}

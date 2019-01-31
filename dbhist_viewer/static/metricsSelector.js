import gl           from "./globals.js"
import {buildGraph,emptyGraph} from "./graph.js"
import {createSqlMonDataTable} from "./sqlMonitorDataTable.js"

// module to define behaviour for metrics selector:
// - adding selected metrics to chart
// - adding seleced metric to chart legend
// - unselecting metric


// function download list of metric_names, store it and populate metrics dropdown
export function getMetricNames(){
	if (gl.gDbaHistSource == "dba_hist_sysmetric_history" && gl.detail_metric_names.length == 0){
		// detail metric names
		$.getJSON(gl.api_root+'/metric_names', 
				{conn_name: gl.gDbCredential},
				function(data) {
					gl.detail_metric_names=data;
					var select2Data = [];
					data.forEach(function(item,idx){select2Data.push({id:idx, text:item["METRIC_NAME"],metric_unit:item["METRIC_UNIT"]})});
					$('#chart_stats').empty().select2({data: select2Data,  placeholder: "2. Pick metric to add to chart ..."});
					$('#chart_stats').on('select2:select', function (e) {
						addSelectedMetrics(e.params.data["text"], e.params.data["metric_unit"]);
					});
				});
		// summary metric names
		$.getJSON(gl.api_root+'/summary_metric_names', 
				{conn_name: gl.gDbCredential},
				function(data) {
					gl.summary_metric_names=data;
				});
	}
	else if (gl.gDbaHistSource == "dba_hist_sysmetric_summary" && gl.summary_metric_names.length == 0){
		// summary metric names
		$.getJSON(gl.api_root+'/summary_metric_names', 
				{conn_name: gl.gDbCredential},
				function(data) {
					gl.summary_metric_names=data;
					var select2Data = [];
					data.forEach(function(item,idx){select2Data.push({id:idx, text:item["METRIC_NAME"],metric_unit:item["METRIC_UNIT"]})});
					$('#chart_stats').empty().select2({data: select2Data,  placeholder: "2. Pick metric to add to chart ..."});
					$('#chart_stats').on('select2:select', function (e) {
						addSelectedMetrics(e.params.data["text"], e.params.data["metric_unit"]);
					});
				});
		// detail metric names
		$.getJSON(gl.api_root+'/metric_names', 
				{conn_name: gl.gDbCredential},
				function(data) {
					gl.detail_metric_names=data;
				});
	}
	else if (((gl.gDbaHistSource == "dba_hist_sysmetric_history") && (gl.detail_metric_names.length > 0))
		  || ((gl.gDbaHistSource == "dba_hist_sysmetric_summary") && (gl.summary_metric_names.length > 0)))
	{
		// metrics were downloaded already
		if (gl.gDbaHistSource == "dba_hist_sysmetric_summary") {
			var data =gl.summary_metric_names;
		}
		else {
			var data =gl.detail_metric_names;
		}
		var select2Data = [];
		data.forEach(function(item,idx){select2Data.push({id:idx, text:item["METRIC_NAME"],metric_unit:item["METRIC_UNIT"]})});
		$('#chart_stats').empty().select2({data: select2Data,  placeholder: "2. Pick metric to add to chart ..."});
		$('#chart_stats').on('select2:select', function (e) {
			addSelectedMetrics(e.params.data["text"], e.params.data["metric_unit"]);
		});
	}
};

// function to add selected metrics to chart
function addSelectedMetrics(metricName, metricUnit) {
	
	// check if this metric is already in selected list
	if ( gl.gSelectedMetrics.indexOf(metricName) >= 0 ) {
		// do nothing
		return;
	} else {
		gl.gSelectedMetrics.push(metricName);
		gl.gSelectedMetricUnits.push(metricUnit);
		if (gl.gRacInstSelected == 'all-stacked') {
			stackMetric();
		} else {
			// non-stacked instances:
			// create new html element with selected metric
			var $newMetricItem = $('<label>'
								+'<input type="checkbox" name="metric_name" value="'+metricName+'" checked/>'
								+'<span class="metric_name">'+metricName+'</span>'
								+'<span class="metric_unit">&nbsp;('+metricUnit+')</span>'
								+'</label>');
			// on new element set element removal handler
			$newMetricItem.change(function(){
									// remove this metric from global arrays
									var metricName=$(this).children()[0].value;
									gl.gSelectedMetricUnits.splice( gl.gSelectedMetrics.indexOf(metricName), 1 );
									gl.gSelectedMetrics.splice( gl.gSelectedMetrics.indexOf(metricName), 1 );
									// remove this metric from web page
									$(this).remove();
									// if there is just one selected metrics left - enable "all-stacked" option
									if ( $('form.form_chart_items input[type="checkbox"]').size() == 1 ) {
										$('form#rac_instance input[type="radio"][value="all-stacked"] ').attr('disabled', false) ;
									}
									// since it is going to be a new chart, 
									// clear previously downloaded data
									gl.maxDownloadedDate=(new Date()).getTime()+30*24*60*60*1000; // fake date in the future
									gl.minDownloadedDate=gl.maxDownloadedDate;
									gl.gChartDataDetail=[];
									// if there are no more selected metrics left then empty graph
									if ( $('form.form_chart_items label').length == 0 ) {
										emptyGraph();
										createSqlMonDataTable();
									}
									else {
										buildGraph();
									}
								});
			// add the new element to web page
			$('form.form_chart_items').append($newMetricItem);
		}
		// redraw chart
		// since it is going to be a new chart, 
		// clear previously downloaded data
		gl.maxDownloadedDate=(new Date()).getTime()+30*24*60*60*1000; // fake date in the future
		gl.minDownloadedDate=gl.maxDownloadedDate;
		gl.gChartDataDetail=[];
		buildGraph();
	}
};


// function to unstack metric name in the chart subscript
export function unstackMetric(){
	// unstack metric means that when RAC Instance selection changes from 
	// "all-stacked" to anything else,
	// several per-instance series for a metric needs to be replaced
	// by one series representing this metrics
	$('form.form_chart_items label').remove();			
	for (var m=0; m<gl.gSelectedMetrics.length; m++) {
		var metricName=gl.gSelectedMetrics[m];
		var metricUnit=gl.gSelectedMetricUnits[m];
		var $newMetricItem = $('<label>'
								+'<input type="checkbox" name="metric_name" value="'+metricName+'"/>'
								+'<span class="metric_name">'+metricName+'</span>'
								+'<span class="metric_unit">&nbsp;('+metricUnit+')</span>'
								+'</label>');
								
		// on new element set element removal handler
		$newMetricItem.change(function(){
								// remove this metric from global arrays
								gl.gSelectedMetricUnits.splice( gl.gSelectedMetrics.indexOf(metricName), 1 );
								gl.gSelectedMetrics.splice( gl.gSelectedMetrics.indexOf(metricName), 1 );
								// remove this metric from web page
								$(this).remove();
								// if there is just one selected metrics left - enable "all-stacked" option
								if ( $('form.form_chart_items input[type="checkbox"]').size() == 1 ) {
									$('form#rac_instance input[type="radio"][value="all-stacked"] ').attr('disabled', false) ;
								}
								// if there are no more selected metrics left then empty graph
								if ( $('form.form_chart_items label').length == 0 ) {
									emptyGraph();
								}
								else { 
									buildGraph();
								}
							});
		$('form.form_chart_items').append($newMetricItem);
	};
};

// function to stack metric name in the chart subscript
export function stackMetric(){
	// for "all-stacked" instance selection
	// there should be separate series per instance
	// will show series as "metrics name (units) - instance#"
	// with no removal event handler (otherwise it would be confusing to let remove one instance series 
	// while on top it shows "all-stacked")
		
	$('form.form_chart_items label').remove();			
	for (var m=0; m<gl.gSelectedMetrics.length; m++) {
		var metricName=gl.gSelectedMetrics[m];
		var metricUnit=gl.gSelectedMetricUnits[m];
		for (var i=1; i<=gl.gRacInstanceCnt; i++) {
			var $newMetricItem = $('<label>'
								+'<input type="checkbox" name="metric_name" value="'
								+ metricName + " - instance"+String(i)+'"/>'
								+'<span class="metric_name">'+metricName+'</span>'
								+'<span class="metric_unit">&nbsp;('+metricUnit+')</span>'
								+'<span class="metric_name">&nbsp;-&nbsp;instance'+ String(i) +'</span>'
								+'</label>');
			$('form.form_chart_items').append($newMetricItem);
		};
	};
};
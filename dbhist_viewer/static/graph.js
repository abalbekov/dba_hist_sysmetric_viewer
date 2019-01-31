// module to define graph behaviour

import gl           from "./globals.js"
import {createSqlMonDataTable} from "./sqlMonitorDataTable.js"

// function to draw empty starter graph
export function emptyGraph() {
	
	// initial data is two zero points 6 hours apart for detailed ...
	if (gl.gDbaHistSource == "dba_hist_sysmetric_history"){
		var startTime=new Date( (new Date()).getTime()-60*60*6*1000 );
		var endTime=new Date();
	} else if (gl.gDbaHistSource == "dba_hist_sysmetric_summary"){
		// or 1 week apart if summary ...
		var startTime=new Date( (new Date()).getTime()-60*60*24*7*1000 );
		var endTime=new Date();
	}

	gl.maxDownloadedDate=startTime.getTime()+30*24*60*60*1000; // fake date in the future
	gl.minDownloadedDate=startTime.getTime()+30*24*60*60*1000;
	
	gl.dg = new Dygraph(
		document.getElementById("chart_dygraph")
		,[[startTime,0],[endTime,0]]
		,{title: "No Metric Selected ..."
		 ,ylabel: 'Some Units'
		 //,legend: 'always',
		 ,dateWindow: [startTime,endTime]
		 ,showRangeSelector: true
		 ,showRoller: true
		 ,rollPeriod: 10
		 ,fillGraph : true
		 ,showLabelsOnHighlight: false
		 ,panEdgeFraction: 0.1
//		 ,width:"100%"
		}
	);
	// add custom mouseup handler to synchronize sqlmonitor datatable
	$("#chart_dygraph canvas, .dygraph-rangesel-fgcanvas, .dygraph-rangesel-zoomhandle")
		.mouseup(function(e) {
            //console.log("mouseup detected");
            createSqlMonDataTable(); 
			// if datasource is history
			// and if the pan action moved chart to the edge beyond 
			// data received from datasource so far,
			// then request more data
			if (gl.gDbaHistSource=='dba_hist_sysmetric_history'
				&&
				( gl.dg.xAxisRange()[0]<gl.minDownloadedDate
				  || 
				  gl.dg.xAxisRange()[0]>gl.maxDownloadedDate )
				){
				buildGraph();
			};
		});
}

// function to download chart data and re-render graph
export function buildGraph(){
		// title and y-label will be displayed only 
		// when there is just one series on the chart
		var vTitle = " ";	var vyLabel = " ";
		if (gl.gSelectedMetrics.length == 1) {
			vTitle =gl.gSelectedMetrics[0]; 
			vyLabel=gl.gSelectedMetricUnits[0]; 
		} else if (gl.gSelectedMetrics.length == 0) {
			// metrics list empty - nothing to display
			return;
		};

		// Labels:
		// if RAC Instaces is set to "all-stacked", 
		// one metric translates to one series per each RAC instance
		var labelsArr=[];
		if (gl.gRacInstSelected=='all-stacked'){
			for (var m=0; m<gl.gSelectedMetrics.length; m++) {
				var metricName=gl.gSelectedMetrics[m];
				for (var i=1;i<=gl.gRacInstanceCnt;i++){
					labelsArr.push(metricName+' - instance'+String(i));
				};
			};
		} else {
			// for non-stacked cases labels match metrics
			// clone array:
			labelsArr=gl.gSelectedMetrics.slice(0); 
		};
		labelsArr.unshift("Date");

		// prepare POST parameters for Ajax request
		var metricsObj = {};
		metricsObj["conn_name"]        =gl.gDbCredential;
		metricsObj["selected_instance"]=gl.gRacInstSelected;
		metricsObj["metric_names"]     =gl.gSelectedMetrics;
		metricsObj["metric_units"]     =gl.gSelectedMetricUnits;
		metricsObj["date_range"]       =getDateRangeMs();
		metricsObj["browser_tz_offset_sec"] =new Date().getTimezoneOffset()*60;
		metricsObj["browzer_tz_name"]       =Intl.DateTimeFormat().resolvedOptions().timeZone;
		
		if (gl.gDbaHistSource=='dba_hist_sysmetric_history'){
			var url=gl.api_root+"/chart_data_detail";
		} else {var url=gl.api_root+"/chart_data_summary";};
		
		var xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.setRequestHeader('Content-Type','application/json');
		// update graph display along the way
		xhr.onprogress = function (e) {
			$(".loader").hide();
			var displayData;
			var newData=csvToArray(this.responseText);
			if (gl.gDbaHistSource=='dba_hist_sysmetric_history'){
				// for detailed chart we download only portion
				// since full range may take too long
				// here we splice newly downloaded data with previously downloaded 
				// (stored in gChartDataDetail)
				// and display spliced data 
				displayData=spliceData(newData,gl.gChartDataDetail);
			} else {displayData=newData;};
			// update chart if there is anything to display
			if (displayData.length > 0){
				gl.dg.updateOptions({
					file: 				displayData
					,title: 			vTitle
					,labels: 			labelsArr
					,showRangeSelector: true
					,ylabel: 			vyLabel
					,fillGraph: 		true
					,stepPlot: 			true
				});
				// give selected items same color as on graph;
				// will skip first array element which is "Date"
				for (let i=1; i<labelsArr.length; i++){
					var clr=gl.dg.getPropertiesForSeries(labelsArr[i])["color"];
					$('form.form_chart_items input[type="checkbox"][value="'+labelsArr[i]+'"]').next().css("color",clr);
				};
			}
		};
						
		xhr.onloadstart = function (e) {
			createSqlMonDataTable();
		}
		
		// in case "onprogress" was not called for last few bits of incoming data
		xhr.onloadend = function (e) {
			var displayData;
			var newData=csvToArray(this.responseText);
			if (gl.gDbaHistSource=='dba_hist_sysmetric_history'){
				gl.gChartDataDetail=spliceData(newData,gl.gChartDataDetail);
				displayData=gl.gChartDataDetail;
			} else {displayData=newData;};
			if (displayData.length > 0){
				gl.dg.updateOptions({file: displayData});
			}
		}
	
		$(".loader").show();
		xhr.send(JSON.stringify(metricsObj));
		//console.log(JSON.stringify(metricsObj));
}

// function to extract visible chart date range
// and return as javascript dates
export function getDateRange() {
	var visibleBeginDate=gl.dg.xAxisRange()[0];
	var visibleEndDate=gl.dg.xAxisRange()[1];
	// initially dateWindow is defined as Date
	// but then if chart range was manually moved on the screen
	// dateWindow boundaries become number of epoch millisec (duh..)
	// convert millisec to Date
	if (visibleBeginDate.toFixed) {
		visibleBeginDate=new Date(visibleBeginDate);
		visibleEndDate=new Date(visibleEndDate);
	}
	return [visibleBeginDate, visibleEndDate];
}
	
// Function to determine chart date range to extract from backend.
// This is different from visible chart date range
// because we will pre-fetch data.
// As first approach we will expand the visible range by its width on left and right.
// Then we will determine if part of this range was already loaded
// and if it was then adjust to reduce the range for subsequent splice.
//
// This splicing approach will be used with detailed chart (DBA_HIST_SYSMETRIC_HISTORY)
// because to retrieve full range may be too long
// For summary chart (DBA_HIST_SYSMETRIC_SUMMARY) splicing is not necessary 
// as full range can be retrieved in resonable time
//
// Returns millisec since epoch in browser timezone
//
function getDateRangeMs() {
	var tzOffsetMs=new Date().getTimezoneOffset()*60*1000;
	//tzOffsetMs=0;
	// following https://danielcompton.net/2017/07/06/detect-user-timezone-javascript
	//tzName=Intl.DateTimeFormat().resolvedOptions().timeZone;
	
	// for summary datasource we retrieve full available date range (1 month )
	if (gl.gDbaHistSource=='dba_hist_sysmetric_summary') {
		var endDate  =(new Date()).getTime();
		var beginDate=endDate-30*24*60*60*1000;
		return [beginDate, endDate]
	}

	// for detail datasource we retrieve only add-on date range
	if (gl.gDbaHistSource=='dba_hist_sysmetric_history') {
		var b=gl.dg.xAxisRange()[0];
		var e=gl.dg.xAxisRange()[1];
		var width=e-b;

		// initially dateWindow is defined as Date
		// but then if chart range was manually moved on the screen
		// dateWindow boundaries become number of epoch millisec (duh..)
		// convert Date to millisec
		if (b.getTime) {
			var beginDate=b.getTime();
			var endDate  =e.getTime();
		} else {
			var beginDate=b;
			var endDate  =e;		
		}
		// expand range by window width
		beginDate-=2*width;
		endDate  +=2*width;
		// reduce range by amount of already downloaded data
		if (beginDate < gl.minDownloadedDate) {
			endDate  = Math.min(endDate,   gl.minDownloadedDate-1000);
		}
		if (endDate > gl.maxDownloadedDate) {
			beginDate  = Math.max(beginDate,   gl.maxDownloadedDate+1000);
		}
		// end date can not be in the future
		endDate = Math.min(endDate, (new Date()).getTime());

		return [beginDate-tzOffsetMs, endDate-tzOffsetMs];
	}
}
	
// convert CSV text to array
function csvToArray(csvData) {					
	try { 
		var csvData = JSON.parse(csvData);
	} catch(e) {
		// for incomplete stream discard anything after last new line
		// and add closing "]"
		csvData=csvData
				.substring(0,csvData.lastIndexOf('\n'))
				+"]";
		csvData = JSON.parse(csvData);
	}
	// remove "falsy" items
	csvData=csvData.filter(Boolean);
	
	// convert string to Date
	csvData.forEach(function(s){ 
		// (s!=null) to prevent "Cannot read property '0' of null"
		//if(s==null){s} else {s[0]=new Date(s[0]);};
		s[0]=new Date(s[0]);
	} )
	// sort by Date
	csvData.sort(function(a,b){return a[0]-b[0];})
	return csvData;
}
    
// function to splice new detail data and previously downloaded data arrays
function spliceData(newData,oldData) {
	
	if (newData.length == 0) { 
		//new data is empty - nothing to splice
		return oldData;
	}
	if (oldData.length == 0) { 
		//old data is empty - return new data
	} else {
		// both old and new data are not empty
	
		// find min/max dates in newData
		// dates are in the first element of the 2d array
		var newDateArr=newData.map(function(value,index) { return value[0]; });
		var newDateMin=Math.min.apply(null,newDateArr);
		var newDateMax=Math.max.apply(null,newDateArr);
		
		// remove range from oldData
		oldData.filter(function(item){
			return (item[0] < newDateMin || item[0] > newDateMax)
		});
		
		// combine and sort by Date
		newData=newData.concat(oldData)
			.sort(function(a,b){
						return a[0]-b[0];
					});
	}			
	// save new min/max downloaded dates
	gl.maxDownloadedDate=(newData[newData.length-1][0]).getTime();
	gl.minDownloadedDate=(newData[0][0]).getTime();
	return newData;
}
	

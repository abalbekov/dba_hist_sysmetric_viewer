import gl                      from "./globals.js"
import {getRACInstances}       from "./racInstanceSelector.js"
import {emptyGraph,buildGraph} from "./graph.js"
import {getMetricNames}        from "./metricsSelector.js"
import {loadSqlMonData,createSqlMonDataTable} from "./sqlMonitorDataTable.js"

export function defineConnections(){
	$.getJSON(gl.api_root+'/get_credentials', 
			  {},
			  function(data) {
				var select2Data = [];
				data.forEach(function(item,idx){select2Data.push({id:idx, text:item})});
				$('#conn_selector').select2({data: select2Data,  placeholder: "1. Pick database connection..."});
				
				$('#conn_selector').on('select2:select', function (e) {
					gl.gDbCredential = e.params.data["text"];
					$('#chart_stats').select2({placeholder: "... loading metrics ..."});
					// check how many RAC instances this connection has
					getRACInstances();
					// when connection is selected, 
					// clear prior metrics selections, clear chart
					// then retrieve metrics list from the db
					// clear previously downloaded data
					gl.maxDownloadedDate=(new Date()).getTime()+30*24*60*60*1000; // fake date in the future
					gl.minDownloadedDate=gl.maxDownloadedDate;
					gl.gChartDataDetail=[];
					buildGraph();
					getMetricNames();
					// enable chart source select (it is initially disabled)
					$('#chart_source option').removeProp('disabled');
					$('#chart_source').select2('destroy').select2();
					loadSqlMonData();
				});

			  })
};

import gl             from "./globals.js"
import {getDateRange} from "./graph.js"

// set of functions to define sql_mointor datatable behaviour

export function loadSqlMonData() {
	$.post(gl.api_root+'/get_sql_monitor_object', 
		  {conn_name: gl.gDbCredential
		  ,browzer_tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone
		  },
		  function(data) {
			gl.gSqlMonitorData=data;
			createSqlMonDataTable();
		  });
}
	
export function createSqlMonDataTable() {
	// match sql monitor date range with chart visible date range
	var [visibleBeginDate,visibleEndDate]=getDateRange();
	// extract from gSqlMonitorData rows falling into visible chart range
	var dataRange=gl.gSqlMonitorData
				.filter(function(row){
					//var rowDate=new Date(row[0]);
					var rowDate=new Date(row.SQL_EXEC_START_BROWSER_TZ);
					return (rowDate > visibleBeginDate 
							&&
							rowDate < visibleEndDate)
				});

	// create sql monitor data table and show it on page
	if (gl.gDataTbl) {
		gl.gDataTbl.destroy();
	}
	gl.gDataTbl= new $("table.sqlmonitor_datatable")
	.DataTable(
			{data: dataRange
			,columns: [
				 {className:      'details-control'
				 ,orderable:      false
				 ,data     :      null
				 ,defaultContent: ''
				 ,render   :      function () {
						return '<i class="fa fa-plus-square" aria-hidden="true"></i>';
				  }
				 ,"width":"15px"
				 }
				,{ "data": "SQL_EXEC_START_BROWSER_TZ" }
				,{ "data": "ELAPSED_TIME"   }
				,{ "data": "STATUS"         }
				,{ "data": "SQL_ID"         }
				,{ "data": "SQL_TEXT"       } 
			]
			,ordering:      	false 
			,searching:			false
			,deferRender:		true
			,scrollY:			300
			,scrollX:			true
			,scroller:			false
			,paging:			false
		} 
	);
	
	// if chart non-empty then show; otherwise keep hidden
	if (gl.gSelectedMetrics.length > 0) {
		$(".sqlmonitor_datatable").show();
	} else {
		$(".sqlmonitor_datatable, .dataTables_info").hide();
	}

	// for hovered over sql row highlight corresponding range on the chart
	$('.sqlmonitor_datatable tbody')
		.off('mouseenter')
		.on( 'mouseenter', 'tr.odd, tr.even', function () {
			var sqlExecStart=gl.gDataTbl.row(this).data()["SQL_EXEC_START_BROWSER_TZ"];
			sqlExecStart=new Date(sqlExecStart).getTime();
			var elapsedTime=gl.gDataTbl.row(this).data()["ELAPSED_TIME"];
			gl.dg.updateOptions(
				{underlayCallback: 
					function(canvas, area, g) {
						var left  = Math.round( gl.dg.toDomXCoord(sqlExecStart) );
						var right = Math.round( gl.dg.toDomXCoord(sqlExecStart+elapsedTime/1000) );
						canvas.fillStyle = "rgba(255, 0, 0, 1.0)";
						canvas.fillRect(left, area.y, right-left+1, area.h);
					}
				}
			);
		} );
		
	// Add event listener for opening and closing details
	$(".sqlmonitor_datatable tbody > tr")
	.off('click')
	//.on('click', 'tr', function () {
	.on('click', function () {
		var tr = $(this).closest('tr');
		var tdi = tr.find("i.fa");
		var row = gl.gDataTbl.row( tr );
	
		if ( row.child.isShown() ) {
			// This row is already open - close it
			row.child.hide();
			tr.removeClass('shown');
			tdi.first().removeClass('fa-minus-square');
			tdi.first().addClass('fa-plus-square');
		}
		else {
			// Open this row
	        tdi.first().removeClass('fa-plus-square');
			tdi.first().addClass('fa-refresh fa-spin');
			row.child( formatDataTableChildRow1(row.data(),tdi.first()) ).show();
			tr.addClass('shown');
	        //tdi.first().removeClass('fa-refresh fa-spin');
			//tdi.first().addClass('fa-minus-square');
		}
	} );			
};
	
//function formatDataTableChildRow(d){
//	// `d` is the original data object for the row
//	var ret='<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">\n';
//	Object.keys(d).forEach(function(key,index) {
//		// key: the name of the object key
//		// index: the ordinal position of the key within the object 
//		ret+='<tr><td>'+key+':</td><td>'+d[key]+'</td></tr>\n'
//	});
//	ret+='</table>';  
//	return ret;	
//}

// this function returnes DBMS_SQLTUNE.report_sql_monitor as datatable child row
function formatDataTableChildRow1(rowData, rowIcon){

	var $div = $('<div/>')
        .addClass( 'loading' )
		.css({"padding-left":"50px"
			 ,"white-space": "pre"
			 ,"font-family": "monospace"})
        .text( 'Loading...' );
	
	$.post(gl.api_root+'/dbms_sqltune_report_sql_monitor', 
		{conn_name     : gl.gDbCredential
	    ,sql_id        : rowData["SQL_ID"]
	    ,sql_exec_start: rowData["SQL_EXEC_START"]
	    ,sql_exec_id   : rowData["SQL_EXEC_ID"]
	    },
		function(data) {
			$div
			.text(data)
			.removeClass( 'loading' );
			
			rowIcon
			.removeClass('fa-refresh fa-spin')
			.addClass('fa-minus-square');
			
			var $expandIcon = $('<div class="childrow-expand-icon"><i class="fa fa-expand"></i></div>')
				.on('click',function(){
					let $txtArea=$('<textarea readonly/>')
					.css({"white-space": "pre"
						,"font-family": "monospace"
						,"width"      : "80%"
						,"height"     : "80%"})
					.text(data)
					.popup('show');
							
					// give 80ms for popup to draw before scrolling to the top
		            setTimeout(function() {
						$txtArea.animate({ scrollTop: 0, scrollLeft: 0 });
					}, 80);

					//$("textarea .popup_content")
					//.scrollTop(0)
					//.scrollLeft(0);
				});
			
			$div.prepend($expandIcon);
		}
	);
	
	return $div;
}

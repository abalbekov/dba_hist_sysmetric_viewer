import gl                      from "./globals.js"
import {defineTabs}            from "./tabs.js"
import {defineChartSrcSel}     from "./chartSourceSelector.js"
import {emptyGraph,buildGraph} from "./graph.js"
import {defineConnections}     from "./dbConnectionSelector.js"

jQuery(document).ready(function() {
	
	defineTabs();
	defineConnections()
	$('#chart_stats').select2({placeholder: "2. Pick metric to add to chart ..."});
	emptyGraph();
	defineChartSrcSel();
	
	// make RAC instance selection element initially invisible
	$("form#rac_instance").hide();
	
	// make SQL Monitor element initially invisible
	$(".sqlmonitor_datatable").hide();
	
	// position and hide spinner-loader
	var loaderTop =gl.dg.height_/2 - $(".loader").outerHeight()/2 - gl.dg.attrs_.xLabelHeight ;
	var loaderLeft=gl.dg.width_/2  - $(".loader").outerWidth()/2  + gl.dg.attrs_.yLabelWidth  ;
	$(".loader").css({ left: loaderLeft });
	$(".loader").css({ top : loaderTop  });
	$(".loader").hide();
	
});
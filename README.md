### Oracle Sysmetric History Viewer

This is a single page web application to diplay timeseries data from Oracle's 
DBA_HIST_SYSMETRIC_HISTORY and DBA_HIST_SYSMETRIC_SUMMARY views.

Example screenshot:

![alt text](https://github.com/abalbekov/dba_hist_sysmetric_viewer/blob/master/screenshot1.png "Oracle Sysmetric History Viewer")

Left side is a scrollable sysmetrics chart.

Right side shows v$sqlmonitor table content with sqlid executions falling within sysmetrics chart window.

A specific sqlid line on the v$sqlmonitor table can be expanded to open a SQLTUNE sqlmonitor report:

![alt text](https://github.com/abalbekov/dba_hist_sysmetric_viewer/blob/master/screenshot2.png)

Application architecture consists of following components:

- Javacript and CSS in client browser
- Server side Python Flask application 
- Target database(s)  

### Deployment options
1. Application can be run on a laptop: 
Pyhon Flask is run from CMD prompt and then web page is opened in a browser.
Target Database connections are set via environment variables.
See <here> for instructions.

2. Application can also run in Docker container.
See <here> for instructions.

3. Application can also be deployed severless onto AWS Lambda and S3 bucket.
Running example is located at <here>
See <here> for instructions.

### Browser side implementation details
  
Javascript code in browser uses several jQuery plugins.

- Database connection selection dropdown and metrics selection dropdown 
uses <here> plugin which shortens dropdown selection list as you type.
This greatly helps with long selection lists which would otherwise require
lots of scrolling. 

	
![alt text](https://github.com/abalbekov/dba_hist_sysmetric_viewer/blob/master/screenshot3-4.png)

- Charts are built with "dyGraph" object.
This provides highly performant interactive charts capable of handling 
large amounts of timeseries data. dyGraph provides built-in scrolling, 
panning and range selector among other features.

Timeseries data is received asynchronously from the server side Python Flask application using Ajax.
To reduce database workload only portion of timeseries data is requested, enough to fill
selected time window plus some buffer. Then when user does scrolling and panning, additional 
data is asynchronously requested and spliced with already downloaded data. 
	
### Server side implementation details

Server side is using Python Flask to expose endpoint URL supplying timeseries data.
Python uses cx_Oracle module to connect to target database and extract data 
from DBA_SYSMETRIC_HISTORY and DBA_SYSMETRIC_SUMMARY views.

When making database connections, the connection objects are preserved in a top-level 
dictionary so that established connections can be reused by subsequent browser requests.

When sending data, Python code is using streaming technique so that browser 
does not wait until complete dataset is retrieved from database.
	
Both Flask and cx_Oracle are running with threading option so that multiple async 
requests can be processed at the same time and multiple browsers can make requests.

When retrieving data from database, database timestamps are converted to browser time zone in SQL.

When retrieving sysmetrics data, SQL also generates "derived" timeseries for cases
when "per sec" metrics is not available. The derived data are based on 
available "Per Txn" metrics multiplied by "User Transactions Per Sec" metrics. 
See details here ...

For RAC targets, client browser can request data either combined across all instances
or per-instance data. See formulas here ...

### Serverless AWS Lambda and S3 deployment

Application Python/Flask code can be deployed in AWS Lambda. 
Zappa project <here> greatly simplifies Flask deployment to AWS Lambda.

The Lambda endpoint URL is exposed via API Gateway.
Static HTML, CSS and Javascript files are stored in S3 bucket.
S3 bucket is configured with Static Web Hosting.

When client browser accesses S3 URL, HTML/CSS/Javascript are sent to the browser 
and then browser javascript retrieves data from API gateway endpoint.
See details here ...
	

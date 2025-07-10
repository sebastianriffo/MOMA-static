/* PENDING
- adapt table width to screen (pending)

- hide ORCHIDEE boxes unless a filter concerning this data is selected, or put these boxes apart (pending)

- hide No Data cells (pending)
ALTERNATIVE 1: QUERY and change its attributes
ALTERNATIVE 2: set classes for empty rows ("No data"), however that needs the labels in advance
ALTERNATIVE 3: explore "table" using the API
*/

/* SOURCES : 
- https://live.datatables.net/jorexujo/678/edit 
- https://datatables.net/examples/api/row_details.html
- https://datatables.net/extensions/searchpanes/examples/
- https://datatables.net/forums/discussion/71938/loop-with-columns-searchpanes-options
- https://stackoverflow.com/questions/10041998/how-can-i-use-backslashes-in-a-string

- predetermined array of years
*/

var searchArr_1 = [];
var year_initial = 1700
var year_final = moment().year();

for (var i = year_initial; i <= year_final; i++) {
    searchArr_1.push(i);
}
function buildCustomSearchPane(searchArr) {
	let options = []
	searchArr.forEach(function (singleLabel) {
		options.push({
			label: String(singleLabel),
			value: function (rowData, rowIdx) {
				var temporal_min = String(rowData["temporal range (min)"]).split('-')
				var temporal_max = String(rowData["temporal range (max)"]).split('-')
				
				return (((singleLabel >= Number(temporal_min[0])) && (singleLabel <= Number(temporal_max[0]))) ? Array(String(singleLabel)) : null);
			},
		});
	});
	return options
}

var table = $('#catalog').DataTable({
	ajax: {
//		url:'catalog.json',
	        url: 'https://raw.githubusercontent.com/sebastianriffo/sebastianriffo.github.io/main/docs/raw_data/catalog.json',
//	        url: 'https://thredds-su.ipsl.fr/thredds/fileServer/ipsl_thredds/sreyes/catalog/catalog.json',
	        type: 'GET',
        	dataType: 'json',
        	dataSrc:"",
        	error: function (err) {
		        console.log("AJAX error in request");
		}
      	},      	
	processing: true,
	serverSide: false,   

	/*
	language: {
	        url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/es-CL.json',
	},
	*/
	language: {
	        searchPlaceholder: "Search...",
	        search:"",
	},

	layout: {
    		topStart: null,
    		topEnd: null,
    		bottomStart: null,
    		bottomEnd: null,
    		top: [
			'search',
	    		'paging',
	    		'pageLength',
    		], 
    		bottom: [
			'info',
		]
	},

	lengthMenu: [ [5,10, 25, 50, 100, -1], [5, 10, 25, 50, 100, "All"] ],	
	pageLength: 10,
	searching: true,
	
	paging: true,
	deferRender: true,
	scrollY: '75vh', 
	        
      	columns: [
		{
		    className: 'dt-control',
		    orderable: false,
		    data: null,
		    defaultContent: ''
		},      	
      		
  		/*1*/
    	{ 
    		data: 'surface component', 
    	        searchPanes: {
        			initCollapsed: false,
        		},
        	},
		{ data: 'name'},
		{ data: 'budget'},
		{ data: 'variable'},
		{ data: 'spatial resolution'},
		{ data: 'spatial extent'},
		{ data: 'temporal range (min)'},
		{ data: 'temporal range (max)'},
		{ data: 'temporal resolution'},
		
		/*10*/
		{ data: 'units',
			visible: false,
           		searchable: true,
           	},
		{ data: 'approach',
			visible: false,
           		searchable: true,
           	},
		{ data: 'format',
			visible: false,
           		searchable: true,
           	},
		{ data: 'DOI (reference)',
			visible: false,
           		searchable: true,
           	},
		{ data: 'DOI (repository)',
			visible: false,
           		searchable: true,
           	},
		{ data: 'repository',
			visible: false,
           		searchable: true,
           	},
		{ data: 'data policy',
			visible: false,
           		searchable: true,
           	},
		{ data: 'acknowledgments',
			visible: false,
           		searchable: true,
           	},
		{ data: 'contact',
			visible: false,
           		searchable: true,
           	},           	
		/*19*/          	
		{ 
			data: 'version',
			title: 'ORCHIDEE version',
			visible: false,
           		searchable: true,
            		searchPanes: {
		            	className: 'ORCHIDEEsearch',
				dtOpts: {
		      			order: [[0, 'desc']]
				},            	
            		},           		
           	},            	
		{ 
			data: 'revision',
			title: 'ORCHIDEE revision',
			visible: false,
           		searchable: true,
            		searchPanes: {
				className: 'ORCHIDEEsearch',          	
				dtOpts: {
		      			order: [[0, 'desc']]
				},
            		},           		
           	},            	
		{ 
			data: 'mode',
			title: 'ORCHIDEE mode',
			visible: false,
           		searchable: true,
	            	searchPanes: {
            			className: 'ORCHIDEEsearch',
            		},           		
           	},
		{ 
			data: 'configuration',
			title: 'ORCHIDEE configuration',
			visible: false,
           		searchable: true,
			searchPanes: {
            			className: 'ORCHIDEEsearch',
            		},
           	},  
		{ 
			data: 'experience',
			title: 'ORCHIDEE experience',
			visible: false,
           		searchable: true,			
			searchPanes: {
            			className: 'ORCHIDEEsearch',
            		},		
           	},  
		{ data: 'path',
			visible: false,
           		searchable: true,
           	},            	          	          	           	
           	], 
        
                 
	columnDefs: [
		{	/*
			render: function (data, type, row){
					if (type === 'filter') {
						var u = (data+'').split('-');
						return Number(u[0]);
				        } else {
						return data;
					}
			},
			*/
			searchPanes: {
    				options: buildCustomSearchPane(searchArr_1), 
    				dtOpts: {
		      			order: [[0, 'desc']]
				},      				
  			},
			targets: [7, 8]
		},
		{
		}],
	
    	searchPanes: {
        	layout: 'columns-1',
        	
        	order: ['surface component', 
        		'name', 'budget', 'variable', 
        		'spatial resolution', 'spatial extent', 
        		'temporal range (min)', 'temporal range (max)', 
        		'temporal resolution',
        		'ORCHIDEE version', 
        		'ORCHIDEE revision',
        		'ORCHIDEE mode',
        		'ORCHIDEE configuration',
        		'ORCHIDEE experience'
        		], 
        		
        	initCollapsed: true,
        	viewTotal: true,
        	cascadePanes: true, 
        	        	
        	orderable: false,
    	},    
});


function format(d) {
    	// `d` is the original data object for the row
    	
    	if (d['surface component'] == 'observations'){
    	var a = `<dl> 
    		<dt>units</dt> <dd> ${d.units}</dd>
    		<dt>approach</dt> <dd> ${d.approach} </dd>
		<dt>format</dt> <dd> ${d.format} </dd>`
		+((d['DOI (reference)'] !== null) ? `<dt>DOI (reference)</dt> <dd> <a href=https://doi.org/${d['DOI (reference)']} target="_blank"> ${d['DOI (reference)']} </a></dd>` : ``)
		+((d['DOI (repository)'] !== null) ? `<dt>DOI (repository)</dt> <dd> <a href=${d.repository} target="_blank"> ${d['DOI (repository)']} </a></dd>` : `<dt>repository</dt> <dd> <a href=${d.repository} target="_blank"> ${d.repository} </a></dd>`)
		+((d['DOI (repository)'] !== null) ? `<dt>data policy</dt> <dd> <a href=https://doi.org/${d['data policy']} target="_blank"> ${d['data policy']} </a></dd>`: ``)
		+`<dt>acknowledgments</dt> <dd>`+((!d.acknowledgments.includes(" ")) ? `${d.acknowledgments} </dd>`: `TEXT TO BE DEFINED </dd>`)
		+`<dt>contact</dt> <dd> ${d.contact} </dd>
		<\dl> `
	} else if (d.name.includes("ORCHIDEE")) {
	var a = `<dl>
	    	<dt>version</dt> <dd> ${d.version}</dd>
	    	<dt>revision</dt> <dd> ${d.revision}</dd>
		<dt>mode</dt> <dd> ${d.mode}</dd>
		<dt>configuration</dt> <dd> ${d.configuration}</dd>
		<dt>experience</dt> <dd> ${d.experience}</dd>
		<dt>path (spirit)</dt> <dd> ${d.path}</dd>
		<\dl>`
	}

    return a
}
// Add event listener for opening and closing details
table.on('click', 'td.dt-control', function (e) {
    let tr = e.target.closest('tr');
    let row = table.row(tr);
 
    if (row.child.isShown()) {
        // This row is already open - close it
        row.child.hide();
    }
    else {
        // Open this row
        row.child(format(row.data())).show();
    }
});

// SEARCH PANE TO THE LEFT
document
    .querySelector('div.dtsp-verticalPanes')
    .appendChild(table.searchPanes.container().get(0));
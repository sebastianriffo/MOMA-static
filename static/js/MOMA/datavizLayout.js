function getStaticFileUrl(filename, config, datasetType) {

  const base = 'static/data';
  const folder = [
    datasetType,
    config.experience,
    config.variableName,
    filename,
    config.plot
  ].join('/');

  let f;
  if (config.plot === 'TS') {
    f = [config.variableName, filename, config.experience, config.timeResolution, config.spatialExtent[0], 'mean.nc'].join('_');
  } else if (config.plot === 'maps') {
    f = [config.variableName, filename, config.experience, config.spatialExtent[0], 'mean.nc'].join('_');
  }

  return `${base}/${folder}/${f}`;
}

/*---------------------------- PACKAGES -------------------------------------*/
// grid (API : https://github.com/gridstack/gridstack.js/tree/master/doc)
import { GridStack } from 'https://cdn.jsdelivr.net/npm/gridstack@11.1.1/+esm';

// import and post-treatment of netcdf files
import { NetCDFReader } from 'https://cdn.jsdelivr.net/npm/netcdfjs@3.0.0/+esm';

/*---------------------------- FUNCTIONS ------------------------------------*/
import { selectmenuFormatted, resourceList, setDatasetList, setRegionList } from './dataviz/selectors.js'
import { gridOn, addWidget, widgetTitle } from './dataviz/widgets.js'
import { flaskCommunication } from './dataviz/communication.js'

import { timeSeries, parsingTime } from './figures/timeSeries.js';
import { maps, polygons } from './figures/maps.js'

/*---------------------------- GLOBAL VARIABLES -----------------------------*/
export { grid } 
export { config, svg_id }

// grid
let widget_id = 0;  // number of widgets created so far
let svg_id;         // current svg 

// attributes of existent widgets
let config = [];    
let cache = []

// MOMA figure types
const map_type = $('.D3button').find('#maps')[0].id
const ts_type = $('.D3button').find('#TS')[0].id

/*---------------------------------------------------------------------------*/
/*---------------------------- GRID (RHS widgets) ---------------------------*/
/*---------------------------------------------------------------------------*/

let grid = GridStack.init({ cellHeight: 'auto',
                            width: 12,
                            disableOneColumnMode: true,
                            handle: '.content-header', // drag on title only
                            resizable: { handles: "sw, se" },
                            float: false, 
                            }) 

// grid behavior : focus on element to recover its svg_id
$('.grid-stack').on('click', (event) => {
    const widget = event.target.closest('.grid-stack-item'); 
    
    svg_id = (widget) ? ('#' +$(widget).find('svg')[0].id) : svg_id;
})

grid.on('added dragstop resizestop removed', (event, item) => {
    
    let [svg_id, deleted_id] = gridOn(event, item)  
    
    if (deleted_id !== undefined)  {
        config = config.filter(function (d) { return d.id !== deleted_id })
        cache = cache.filter(function (d) { return d.id !== deleted_id })
        
        $('.dataset').prop('checked', false);
    }    
});

/*---------------------------------------------------------------------------*/
/*---------------------------- LHS selectors --------------------------------*/
/*---------------------------------------------------------------------------*/

/* 'choose a plot' buttons */
$('.widget_add').on('click', event => {    
    widget_id += 1;
    const plot = event.currentTarget.id;
            
    // add new config, THEN add widget   
    addConfig(plot, widget_id)   
    addWidget({id:widget_id, plot: plot, h:4, w:6});         
    
    // create (empty) figure
    svg_id = config[config.length-1].svg;    
    drawFigures(plot, svg_id, event);
})

/*---------------------------------------------------------------------------*/
/* visibility of horizontal buttons (datasets, customization, export) */
$('.tablinks').on('click', function(event) {
	$('.tabcontent').css('display', 'none');
	$('#ta'+event.target.id).css('display', 'flex');
	
	$('.tablinks').css('background-color', 'inherit')
    $('#'+event.target.id).css('background-color', '#fff');
})

/*---------------------------------------------------------------------------*/
/* dropdown menu format : selectmenu from JQuery UI */
$(".specSelector:not(#startDate, #endDate)").selectmenu();
$(".exportSelector").selectmenu();

/* variable selector */
// resourceList yields a list of available variables/json files/datasets
resourceList("spirit", "variables").then(function(elements) {
    $.each(elements, function (index, elt) { 
        $('#variableName').append(new Option(elt, elt)) 
    })
});

/* world map selector */
resourceList("spirit", "worldMap").then(function(elements) {
    $.each(elements, function (index, elt) { 
        $('#worldMap').append(new Option(elt, index, (elt === "TRANSCOM-11 L2") ? true : false, (elt === "TRANSCOM-11 L2") ? true : false))
    })
});

/*---------------------------------------------------------------------------*/
/* region selector */
// PENDING : zoom when clicking
$('#spatialExtent').on('change', 'input', async function(event) {
 	const datasets = $('input.dataset:checkbox:checked').map(function() { return this.id }).get() 	
 	
    $('.region').prop('checked', false);
    $('#'+event.target.id).prop('checked', true);
    updateConfig(svg_id, "spatialExtent", $('input.region:checkbox:checked').map(function() { return this.id }).get())   
        
 	// update data selection to region
 	/*
 	const experience = $('#experience').find(':selected').val();
	const variableName = $('#variableName').find(':selected').val();     	 	
 	setDatasetList(experience, variableName, datasets)    		  
    */		  
        
 	// trigger event on datasetlist
 	// see: https://stackoverflow.com/questions/21984872/jquery-trigger-delegated-event
    $('.dataset').attr("disabled", false)    
    const idx = config.findIndex( d => d.svg === svg_id)
        
    if (idx >= 0) { 
        cache[idx].dataset = [{}] 
        
        if (datasets.length > 0){
         	$('input.dataset:checkbox:checked').each(function(idx, target){
                let e = jQuery.Event('change')
                e.target = target        
                e.target.checked = true  
                $('.datasetList').trigger(e) 	
         	});
        } else {
            flaskCommunication(config[idx])
        }
         	
 	} else {
        drawFigures('none')
    }    

    // widget title	
    // $(svg_id).closest('.grid-stack-item-content').find('.content-header').text(widgetTitle(svg_id))
})

/*---------------------------------------------------------------------------*/
// PLOT SELECTORS (jqueryUI compatible)
$('.specSelector').on('selectmenuchange change', async function(event) {

    const idx = config.findIndex( d => d.svg === svg_id )
    const plot = (config.length > 0) ? config[idx].plot : 'none';
    	
	const experience = $('#experience').find(':selected').val();
	const variableName = $('#variableName').find(':selected').val();	     	
	const timeResolution = $('#timeResolution').find(':selected').val();	
    const worldMap = $('#worldMap').find(':selected').val(); 

    // update figures, communicate with flask    
 	const datasets = $('input.dataset:checkbox:checked').not(":disabled").map(function() { return this.id }).get()

    if ( (plot === map_type) && ((event.target.id === 'worldMap') || (event.target.id === 'projection')) ){
        updateConfig(svg_id, event.target.id, event.target.value)
        drawFigures(plot, svg_id, event)

    } else if (datasets.length > 0){
//        cache[idx].dataset = [{}] 
        
       	$('input.dataset:checkbox:checked').each(function(idx, target){
              updateConfig(svg_id, event.target.id, event.target.value)
              
              let e = jQuery.Event('change')
              e.target = target        
              e.target.checked = true  
              $('.datasetList').trigger(e) 	
       	}); 
    } else {
        updateConfig(svg_id, event.target.id, event.target.value)
    }
        
	// update selectors, list of regions, list of observations
    selectmenuFormatted('#'+event.target.id)

    if (event.target.id === "worldMap") {
        setRegionList(worldMap, $('input.region:checkbox:checked').map(function() { return this.id }).get())
    }
		
	if (!$(event.target).hasClass('custom')) { 
    	setDatasetList(experience, variableName, $('input.dataset:checkbox:checked').not(":disabled").map(function() { return this.id }).get())
    }
});

/*---------------------------------------------------------------------------*/
/* datasets search bar */
$('#dataSearch').on('input', (event) => {

    const search = $('#dataSearch');		
    const labels = $('.datasetList').find('div > label')

    let removeAccents = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    Array.from(labels).forEach( (element) => 
        $(element).css('display', removeAccents(element.childNodes[0].id.toLowerCase()).includes(removeAccents(search.val().toLowerCase())) ? "inline" : "none")
    )
})

/*---------------------------------------------------------------------------*/
/* dataset selector */
// remark: listeners are added with event delegation, since input elements were created after DOM (D3 function .on('change', async function()) does not catch anything)
$('.datasetList').on('change', 'input', async function(event) {

if (event.target.tagName.toLowerCase() === 'input') {
    const idx = config.findIndex( d => d.svg === svg_id)
	const plot = (config.length > 0) ? config[idx].plot : 'none';
	    
	// retrieve/discard data
	let netcdfFile;	
    const datasetName = event.target.name; 
    	
	if (event.target.checked) {	
    	const filename = event.target.id; 
        const datasetType = event.target.className.replace('dataset ','')
		
		try {
        	const response = await fetch(getStaticFileUrl(filename, config[idx], datasetType))
        	
			const blob = await response.blob();
			const arrayBuffer = await blob.arrayBuffer();			
			netcdfFile = new NetCDFReader(arrayBuffer);

            updateConfig(svg_id, "dataset", netcdfFile, [datasetName, datasetType])
                	
    		if (plot === ts_type) {
                if(event.target.className == 'obs'){
                    cache[idx].dataset = cache[idx].dataset.filter(function (d) { return d.type !== 'obs'; });
                
                    $('.obs').prop('checked', false);
                    $('#'+filename).prop('checked', true)
        		}
    		} else if (plot === map_type) {
    			// uncheck remaining data
                $('.dataset').prop('checked', false);
                $('#'+filename).prop('checked', true).attr("disabled", false);
        	}       
        	    	
		} catch(error) {
    		$('.datasetList').find('#'+filename).attr("disabled", true)
        		//.attr('onclick','return false')
        	
        	updateConfig(svg_id, "dataset", netcdfFile, [datasetName])
        }

	} else {	
        updateConfig(svg_id, "dataset", netcdfFile, [datasetName])

	}

    // draw/update figures, communication via Flask
    drawFigures(plot, svg_id, event)	
}
});

/*---------------------------------------------------------------------------*/
/*---------------------------- CONFIG ---------------------------------------*/
/*---------------------------------------------------------------------------*/

function addConfig(plot, id){
    const selected_regions = $('input.region:checkbox:checked').map(function() { return this.id }).get(); 

    if (plot === map_type){
        config.push({   id : widget_id,                     
                        svg : '#dataviz_'+widget_id,
                        plot : plot,
                        //                     
                        experience : $('#experience').find(':selected').val(),
                        variableName : $('#variableName').find(':selected').val(), 
                        worldMap : $('#worldMap').find(':selected').val(),
                        spatialExtent : (selected_regions.length > 0) ? selected_regions : ['global'],
                        //
                        projection :  $('#projection').find(':selected').val(), 
                        color : $('#color').find(':selected').val(),
                        //
                        dataset : [],
                        range : [],
        })    
                
    } else if (plot === ts_type) {
        config.push({   id : widget_id,                     
                        svg : '#dataviz_'+widget_id,
                        plot : plot,
                        //                     
                        experience : $('#experience').find(':selected').val(),
                        variableName : $('#variableName').find(':selected').val(), 
                        timeResolution : $('#timeResolution').find(':selected').val(), 
                        worldMap : $('#worldMap').find(':selected').val(),
                        spatialExtent : (selected_regions.length > 0) ? selected_regions : ['global'],
                        //
                        dataset : [],                        
        })
    }

    const idx = config.findIndex( d => d.svg === svg_id )  
    if ((cache.length > 0) && (plot === config[idx].plot)){
        cache.push({id : widget_id, 
                    dataset : cache[idx].dataset,
                    })
        config[config.length-1].dataset = cache[idx].dataset.map(function (d) { return d.name })               
        
    } else {
        cache.push({id : widget_id, 
                    dataset : [{}], // [{name : filename, data : data, range : range}]
                    })
    } 
}

function updateConfig(svg_id, property, value, datasetAttrs) {
    const idx = config.findIndex( d => d.svg === svg_id )
                
    // check widget existence, properties defined in addConfig
    if (!(idx >= 0) || ((Object.keys(config[idx])).indexOf(property) === -1) ){
        return ; 
    }

    if (property === 'dataset'){ 
        const [datasetName, datasetType] = datasetAttrs    

        // format and then add data to cache array		
        if (typeof value !== 'undefined'){
            let netcdfFile = value;            
        
            if (config[idx].plot === ts_type) {    		
      	        // zip time and process coordinates, add standard deviation
                const variableName = $('#variableName').find(':selected').val();      		
                const process = new Array(netcdfFile.getDataVariable(variableName))[0];
          		const time = parsingTime(netcdfFile)	
             	let data_parsed; 
          		
          		if (netcdfFile.header.variables.map(d => d.name).includes(variableName+"_sd")){
                    const sd = new Array(netcdfFile.getDataVariable(variableName+"_sd"))[0];
    
                    data_parsed = time.map((e, i) => [e, process[i], sd[i]]).map(function(d) { return {x: d[0], y: d[1], sd: d[2] }; })                      
          		} else {
          		    data_parsed = time.map((e, i) => [e, process[i]]).map(function(d) { return {x: d[0], y: d[1] }; });
          		}
       		
          		let units = netcdfFile.header.variables
                     					.find((val) => {return val.name === variableName; }).attributes
                     					.find((attr) => {return attr.name === 'units'; }).value
                
                // check if there are repeated datasets
                cache[idx].dataset = cache[idx].dataset.filter(function (d) { return d.name !== datasetName; });                

          		// nested array containing each line and its attributes
                if ((cache[idx].dataset.length === 0) || (Object.keys(cache[idx].dataset[0]).length === 0)) {
              		cache[idx]["dataset"] = [{  name : datasetName,
                                          		type : datasetType, 
                                                data : data_parsed, 
                                                units : units}]
                                                  		
          		} else {
              		cache[idx].dataset = cache[idx].dataset.concat({    name : datasetName, 
                                                                  		type : datasetType, 
                                                                        data : data_parsed, 
                                                                        units : units,
                                                                  });
          		}                             		
      		} else if (config[idx].plot === map_type) {  		
                let data, range; 
                [data, range] = polygons(netcdfFile)
    
            	cache[idx].dataset = [{name : datasetName, data : data}]
        		config[idx].range = range
          	}
          	               
        // remove data from 
        } else { 
        	if (config[idx].plot === map_type) {
            	cache[idx].dataset = [{}]
            	
        	} else if (config[idx].plot === ts_type) {
            	if (Object.keys(cache[idx].dataset[0]).length === 1) {
                	cache[idx].dataset = [{}]
            	} else {
                    cache[idx].dataset = cache[idx].dataset.filter(function (d) { return d.name !== datasetName; });   
                }             
            } 
        }
        
        config[idx].dataset = cache[idx].dataset.map(function (d) { return d.name })
                
    // handle other properties 
    } else {
        config[idx][property] = value
    }
}

/*---------------------------------------------------------------------------*/
function drawFigures(plot, svg_id, event, data){

    // draw/update figures
    let iterator;
    let idx;  
    
    if (plot === map_type){
        iterator = config.filter(function (d) { return (event.target.id === 'projection') ? (d.plot === map_type):(d.svg === svg_id) }).entries()

        for (const [i, element] of iterator) {
      		idx = config.findIndex( d => d.svg === element.svg )

            updateConfig(element.svg, event.target.id, event.target.value);
      		maps(element.svg, cache[idx].dataset[0].data, event.target.id);
      		
            // widget title	
            $(element.svg).closest('.grid-stack-item-content').find('.content-header').text(widgetTitle(element.svg))
            
            flaskCommunication(config[idx])
      	}
      			
	} else if (plot === ts_type) {
    	// problem : when cache is empty 
    	// problem : lines in black
        iterator = config.filter(function (d) { return ((event.target.id === 'startDate') || (event.target.id == 'endDate')) ? (d.plot === ts_type):(d.svg === svg_id) }).entries()

        for (const [i, element] of iterator) {	
            idx = config.findIndex(d => d.svg === element.svg )
            		               	
        	let xLim0 = new Date($('#startDate').val()); 
        	let xLim1 = new Date($('#endDate').val()); 
    	    
    	    updateConfig(element.svg, event.target.id, event.target.value);	
            timeSeries(element.svg, cache[idx].dataset, (!isNaN(xLim0) || !isNaN(xLim1)) ? [xLim0, xLim1] : undefined)

            // widget title	
            $(element.svg).closest('.grid-stack-item-content').find('.content-header').text(widgetTitle(element.svg))  
            /*            
    		if ((event.target.id !== 'startDate') && (event.target.id !== 'endDate')) {
    			$(svg_id).empty();
    			updateConfig(svg_id, event.target.id, event.target.value)			
    			cache[idx].dataset = [{}]
    
                timeSeries(svg_id, [{}])
            */
            flaskCommunication(config[idx])            
        }
                       
    } else {
    }
    
    // flask communication (if everything else fails)
    if (typeof idx === 'undefined') {
        flaskCommunication({plot: 'none',
                            experience : $('#experience').find(':selected').val(),
                            variableName : $('#variableName').find(':selected').val(), 
                            timeResolution : $('#timeResolution').find(':selected').val(), 
                            worldMap : $('#worldMap').find(':selected').val(),
                            spatialExtent : $('input.region:checkbox:checked').map(function() { return this.id }).get(),
                            })    
    }
}
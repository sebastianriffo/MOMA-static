/* UPCOMING FEATURES
- tooltip depending on mouse's x-coordinate (pending : 17/10/24)
- clickable legend 
- legend, mousehover (as this ? https://observablehq.com/@d3/multi-line-chart/2 or https://observablehq.com/@geofduf/simple-dashboard-line-charts), 
- uncertainties (check evaluation datasets first)
*/

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm'

import { flaskCommunication } from './../dataviz/communication.js'

import { config } from './../datavizLayout.js'

/* SVG CONTAINER */
const width_initial = 1200; 
const height_initial = 700;

let margin = {top: 20, right: 275, bottom: 30, left: 75};
const width = width_initial - margin.left - margin.right;
const height = height_initial - margin.top - margin.bottom;

/* individual brush */
let brushFunctions = {};  
let axisLimits = {}; 

/* color palette */
let globalPalette = [];
const [darkColor, lightColor] = coloring();

/* FUNCTIONS */
export function timeSeries(svg_id, data, xLimNew=undefined, yLimNew=undefined){
/* Sources
- https://d3-graph-gallery.com/graph/line_change_data.html
- https://jsfiddle.net/jaimem/T546B/
*/
    // axis
    let x = d3.scaleTime().range([0, width]);
    let y = d3.scaleLinear().range([height, 0]);
    
    // drawing for the first time
    if (d3.selectAll(svg_id).select(".myXaxis").empty()) {
		let svg = d3.select(svg_id)
        		.attr("class", "D3TS")
				.attr("preserveAspectRatio", "xMinYMin meet")
				.attr("viewBox", `0 0 ${width_initial} ${height_initial}`)
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);	
        
        // set axis
		let xAxis = svg.append("g")
			.attr("transform", `translate(0, ${height})`)
			.attr("class","myXaxis")
			.call(d3.axisBottom().scale(x).tickFormat(d3.timeFormat("%Y")));

		let yAxis = svg.append("g")
			.attr("class","myYaxis")
			.call(d3.axisLeft().scale(y));

		// customization			
		xAxis.style('font-size', '1rem')
		yAxis.style('font-size', '1rem')

		// legend element
		svg.append('g')
			.attr("class", "legend-TS")
			.attr("transform", `translate(${width},${0})`);			
		
		// Add a clipPath: everything out of this area won't be drawn (used for brushing)
		let defs = svg.append("defs")		
		
		defs.append("svg:clipPath")
			.attr("id", "clipD3TS")
			.append("svg:rect")
			.attr("width", width )
			.attr("height", height )
			.attr("x", 0)
			.attr("y", 0);

        // flask communication
        const idx = config.findIndex(d => d.svg === svg_id)
        flaskCommunication(config[idx])        
	}			
    
    /* check change of axis*/
    let svg = d3.selectAll(svg_id+" > g")
    const [xLim, yLim, adjustBrush] = setAxisLimits(svg_id, data, xLimNew, yLimNew);
        
	if ((data.length > 0) && (Object.keys(data[0]).length > 0)){
    	/*
		// add axis labels (units), possible title, etc
		if (svg.select(".yLabel").empty()){
			svg.append('g')
				.attr("class", "yLabel")		
				.append("text")
					.attr("transform", "rotate(-90)")
					.attr("y", 0 - margin.left)
					.attr("x",0 - (height / 2))
					.attr("dy", "1em")
					.attr("font-size", "20px")
					.style("text-anchor", "middle")
					.text(data[0].units);	
		}
        */
        
        /* check change of axis*/
        // const [xLim, yLim, adjustBrush] = setAxisLimits(svg_id, data, xLimNew, yLimNew); 

  		// set axis
        x.domain(xLim);
        y.domain(yLim);
  		
  		let xAxis = svg.selectAll(".myXaxis")
  				.transition().duration(1000)
  				.call(d3.axisBottom().scale(x));
  				
  		let yAxis = svg.selectAll(".myYaxis")
  				.transition().duration(1000)
  				.call(d3.axisLeft().scale(y));
  
          // Add brushing
      	if (svg.select(".brush").empty()){     		
      		let brush = d3.brushX()                   
      			.extent( [ [0,0], [width, height] ] )          
      			.on("end", (event) => brushed(event, x, svg_id))
      			
      		let context = svg.append('g')
      				.attr("class", "contextTS")
      				.attr("clip-path", "url(#clipD3TS)");
      				
          	context.append("g").attr("class", "uncertainty");
            context.append("g").attr("class", "lineplot");
      		context.append('g').attr("class", "brush").call(brush);  
      		          			
          	brushFunctions[svg_id] = brush; 
      	}
    }
    
    if (!(svg.select(".brush").empty())){      	
        let currentLines = (svg.selectAll(".timeSeries").nodes().map(d => d.id))
        let drawingLines = data.map(d => d.name);  
        let leavingLines = (currentLines).filter(x => !drawingLines.includes(x))    
        let draw = (drawingLines.filter(x => !currentLines.includes(x))).length + leavingLines.length
    
        if (!adjustBrush || draw) {

            if ((data.length > 0) && (Object.keys(data[0]).length > 0)){            
            /* add color attributes to data*/
            updateLineColors(data)
                    
      		/* (re)drawing lines for each group */
      		// source : https://stackoverflow.com/questions/52028595/how-to-use-enter-data-join-for-d3-line-graphs
          	          
            // drawing            
          		for(const [i, element] of data.entries()) {
           		
           			if (svg.selectAll("#"+element.name).empty()) {
           				var lines = svg.select(".lineplot").append("g")		
           						.attr("id", element.name)
           						.attr("class", "timeSeries")
    
           				var areas = svg.select(".uncertainty").append("g")		
           						.attr("id", element.name)
           			} else { 
           				var lines = svg.select(".lineplot").selectAll('#'+element.name);
               			var areas = svg.select(".uncertainty").selectAll('#'+element.name);
           			}
        		
           			// create/update lines and uncertainty regions with new data       			
           			lines.selectAll("path")
           				.data([element.data])
           				.join(
           					enter => enter.append("path"),
           					update => update,
           					exit => exit.remove()
           					)
           				// all this applies to enter/update
           				.attr("class", "line")
           				.attr("d", d3.line().x(d => x(d.x)).y(d => y(d.y)) )
           				.transition().duration(1000)			
           				.attr("fill", "none")		
           				.attr("stroke-width", 1.5)
           				.attr("stroke", element.darkColor);                 		
    
         			areas.selectAll("path")
         				.data([element.data])
         				.join(
         					enter => enter.append("path"),
         					update => update,
         					exit => exit.remove()
         					)
         				.attr("class", "area")
         				.attr("d", d3.area(d => x(d.x), d => y(d.y -d.sd), d => y(d.y +d.sd)).defined(d => !isNaN(d.sd)) )
         				.transition().duration(0)			
         				.attr("fill", element.lightColor)
         				.attr("fill-opacity", "0.5");  
              	}
          	}
          		
      		// removing
      		for(const dataset of leavingLines) {
      			svg.selectAll('#'+dataset.replace('.','\\.'))
      				.attr("fill-opacity", 1)
      				.attr("stroke-opacity", 1)
      				.transition().duration(1000)	
      				.attr("fill-opacity", 0)
      				.attr("stroke-opacity", 0)
      				.remove(); 
      		}
        
            if ((data.length > 0) && (Object.keys(data[0]).length > 0)) {           
                // compute average, max, min 
                statistics(svg, x, y, xLim, data)  
            } else {
                svg.selectAll("#average, #minimum, #maximum").remove()
            }
            
            
      		// add legend
      		legend(svg, data)                                      
          		
        } else if(adjustBrush) {
            // Manually added temporal range does not modify any data, but it requires to readjust the brush            
            svg.select(".brush").call(brushFunctions[svg_id].move, null);
        }
	} 
}

/* AXIS */
function setAxisLimits(svg_id, data, xLimNew, yLimNew){
/* axis limits can change according to the dataset (data), brushing (stored as
brushX in axisLimits), or setting a temporal range manually (xLimNew). 
For the latter, brush has to be updated manually (adjustBrush is a flag indicating this).
*/
	let minX, maxX, minY, maxY; 
	if ((data.length > 0) && (Object.keys(data[0]).length > 0)) {
		minX = d3.min(data, function (d) { return d3.min(d.data, d => d.x) });
		maxX = d3.max(data, function (d) { return d3.max(d.data, d => d.x) });
		minY = d3.min(data, function (d) { return d3.min([d3.min(d.data, d => d.y), d3.min(d.data, d => d.y0), d3.min(d.data, d => d.y1)]) });
		maxY = d3.max(data, function (d) { return d3.max([d3.max(d.data, d => d.y), d3.max(d.data, d => d.y0), d3.max(d.data, d => d.y1)]) });
    } 

    let globalX;                 
    let brushX = (typeof axisLimits[svg_id] !== 'undefined') ? axisLimits[svg_id].brushX : undefined; 
     
    if (typeof xLimNew !== 'undefined') {          
        globalX = [!isNaN(xLimNew[0]) ? xLimNew[0] : minX, !isNaN(xLimNew[1]) ? xLimNew[1] : maxX];
    } else {
        globalX = [minX, maxX];
    }
    
    axisLimits[svg_id] = { globalX : globalX, 
                           globalY : [minY, maxY], 
                           brushX : brushX,                            
                           brushY : undefined, 
                           }
    
    let xLim = (typeof brushX !== 'undefined') ? brushX : globalX;  //unless data is empty
    let yLim = [minY, maxY]; 
    let adjustBrush = (typeof xLimNew !== 'undefined'); 
    
    return [xLim, yLim, adjustBrush]
}

/* BRUSHING
Each plot has its own brush range xLimBrush (stored as currentX in axisLimits). 
The x-axis, and hence the different curves, need to be redrawn accordingly.

Since brushing is the only change made to the plot, this function also takes 
care of the communication with the Flask server.

- sources
    https://d3-graph-gallery.com/graph/line_brushZoom.html
    https://krisrs1128.github.io/stat679_notes/2022/06/01/week6-4.html
*/
function brushed(event, x, svg_id) {
	// selected boundaries
	let extent = event.selection;	

    // svg associated to brush element
	let svg = d3.selectAll(svg_id+" > g");
    
    // set x-axis
    let brushX; 
    
	if(extent !== null){		
		svg.select(".brush").attr("pointer-events","none")
		
		// x.invert() relates the mouse selection with the axis
		brushX = [x.invert(extent[0]), x.invert(extent[1])];
		x.domain(brushX);
	} else {
		// a click zoom out the chart
		let [minX, maxX] = axisLimits[svg_id].globalX
		
        brushX = undefined; 
        x.domain([minX, maxX]);
	}		
	axisLimits[svg_id].brushX = brushX;

    let xAxis = svg.selectAll(".myXaxis")
        	.transition().duration(1000)
        	.call(d3.axisBottom(x));

    // set y-axis
    let y = d3.scaleLinear().range([height, 0]);
    y.domain(axisLimits[svg_id].globalY);
		
	// redraw lines on selected area
	d3.selectAll(".selection").attr("fill-opacity", 0).attr("width","0")	
	
	let context = svg.select(".contextTS")	
	context.selectAll('.line')
		.transition().duration(1000)
		.attr("d", d3.line().x(d => x(d.x)).y(d => y(d.y)) )

    context.selectAll(".area")
		.transition().duration(1000)    
        .attr("d", d3.area(d => x(d.x), d => y(d.y -d.sd), d => y(d.y +d.sd)).defined(d => !isNaN(d.sd)) )
        
	d3.selectAll(".selection").attr("fill-opacity", "0.3")

	// update min max
	statistics(svg, x, y, (brushX !== undefined) ? brushX : axisLimits[svg_id].globalX)
	
    // flask communication
    const idx = config.findIndex(d => d.svg === svg_id)
    flaskCommunication(config[idx])
}

/* STATS */
function statistics(svg, x, y, xLim, data=undefined) {

    let dataEntry_flag = Boolean(data); 
    let dataLength_flag = (data !== undefined) ? (data.length > 1) : (svg.selectAll(".timeSeries").nodes().length > 1);
        
    data = (data !== undefined) ? d3.merge(data.map(d => d.data)) : d3.merge(svg.selectAll('.timeSeries').select(".line").data()); 

    // compute average, sort by time, transform into an array of objects    
    let stats; 
    let avg = d3.rollups(data, v => d3.mean(v, d => d.y), d => d.x).sort(function(a, b){ return d3.ascending(a[0], b[0]) });
    
    const rollupArraytoObj = (array, value) => array.map(function(d) { return {x: d[0], y: (value !== undefined) ? value : d[1] }})

    if (dataEntry_flag && dataLength_flag){        
    	// set min/max/avg		
		stats = [{name: "minimum", 
            		data : rollupArraytoObj(avg, d3.min(data.filter(function (d) {return ((d.x >= xLim[0]) && (d.x <= xLim[1]))}), d => d.y) ),
            		strokeDasharray : "2"},                 
                 {name: "maximum", 
                    data : rollupArraytoObj(avg, d3.max(data.filter(function (d) {return ((d.x >= xLim[0]) && (d.x <= xLim[1]))}), d => d.y) ),
                    strokeDasharray : "6"},
                 {name: "average", 
                    data : rollupArraytoObj(avg), 
                    strokeDasharray : "none"}
                 ];	
    }
    else {       
        // brush : set min/max, redraw average
		stats = [{name: "minimum", 
            		data : rollupArraytoObj(avg, d3.min(data.filter(function (d) {return ((d.x >= xLim[0]) && (d.x <= xLim[1]))}), d => d.y) ), 
            		strokeDasharray : "2"}, 
                 {name: "maximum", 
            		data : rollupArraytoObj(avg, d3.max(data.filter(function (d) {return ((d.x >= xLim[0]) && (d.x <= xLim[1]))}), d => d.y) ),
            		strokeDasharray : "6"},            		
                ];   
                
        if (dataLength_flag){  
        	svg.selectAll('#average').select(".line")
        		.transition().duration(1000)
        		.attr("d", d3.line().x(d => x(d.x)).y(d => y(d.y)) )
        } else {
            svg.selectAll("#average").remove()
        }
    }

   	for(const [i, element] of stats.entries()) { 
   		svg.selectAll("#"+element.name).remove()
   	
   		var lines = svg.select(".lineplot").append("g")		
   					.attr("id", element.name)
   					.attr("class", "stats")

   		lines.selectAll("path")
   			.data([element.data])
   			.join(
   				enter => enter.append("path"),
   				update => update,
   				exit => exit.remove()
   				)
   			.attr("class", "line")
   			.attr("d", d3.line().x(d => x(d.x)).y(d => y(d.y)) )
   			.transition().duration(1000)
   			.attr("fill", "none")		
   			.attr("stroke-width", 1)
   			.attr("stroke", "#899499")
   			.attr("stroke-dasharray", element.strokeDasharray);
   	}
}

/* LEGEND */
function legend(svg, data) {
	const fontSize = 16;
    
    // filter by type and name, then sort
    const mapWith = (array, keys) => array.map(o => Object.fromEntries(keys.map(k => [k, o[k]])));     
    
    const datasetLegend = mapWith(data, ['name', 'type', 'darkColor']).sort(function (a,b) {return d3.descending(a.type, b.type) || d3.ascending(a.name, b.name);})    
    const statsLegend = svg.selectAll(".stats").nodes().map(function(d) { return {"name": d.id, darkColor: "#899499"}}); 

    const legendItems = datasetLegend.concat(statsLegend)

    // remove and (re)create legend element		
	let legendContainer = svg.select(".legend-TS");		
		
	legendContainer.selectAll("line").remove();
    legendContainer.selectAll("text.label").remove();	
             
   	legendContainer.selectAll("mydots").data(legendItems)
   		.enter().append("line")
   		.attr("x1", 20).attr("y1", function(d,i){ return (16 + i*25) })
   		.attr("x2", 20+30).attr("y2", function(d,i){ return (16 + i*25) })
   		.attr("stroke-width", 2.5)
   		.attr("stroke", d => d.darkColor)
//   		.attr("stroke-dasharray", "none")
   		.attr("stroke-dasharray", function(d) { return (d.name === "maximum") ? "6": ((d.name === "minimum") ? "2":"none") })
   		.attr("class", "legend-box");                

	legendContainer.selectAll("mylabels").data(legendItems)
		.enter().append("text").attr("class", "label")
		.attr("x", 30+ 1.6*fontSize )
		.attr("y", function(d,i){return (22 + i*25)}) 
		.style("fill",d => d.darkColor)
		.text(d => d.name)
		.attr("text-anchor", "left")
		.style("font-size", fontSize+"px")
		.style("alignment-baseline", "middle");	

}


/*---------------------------------------------------------------------------*/
/*------------------------------ COLORING -----------------------------------*/
/*---------------------------------------------------------------------------*/
 function coloring(){
/* strong and light versions of a color palette, based on tableau20 */

	const color = [ "#1f77b4", "#aec7e8", //blue
        			"#ff7f0e", "#ffbb78", //orange
        			"#2ca02c", "#98df8a", //green
        			"#d62728", "#ff9896", //red
        			"#9467bd", "#c5b0d5", //purple
        			"#8c564b", "#c49c94", //brown
        			"#e377c2", "#f7b6d2", //pink
        			"#7f7f7f", "#c7c7c7", //grey
        			"#bcbd22", "#dbdb8d", //olive green
        			"#17becf", "#9edae5"  //cyan 
			]
	
	const darkColor = color.filter(function(element, index, array) { return (index % 2 == 0);});
	const lightColor = color.filter(function(element, index, array) { return (index % 2 == 1);});
	
	return [darkColor, lightColor]
}

function updateLineColors(data){
/* constructs a global color palette, adds colors to data accordingly */
    let palette = [...new Set(globalPalette.map(d => d.name))]
	
	for (const [i, element] of data.entries()) {
	
    	if (palette.includes(element.name)){
        	element.darkColor = globalPalette.filter(x => x.name === element.name)[0].darkColor
        	element.lightColor = globalPalette.filter(x => x.name === element.name)[0].lightColor 

        } else {
        	element.darkColor = (element.type === "sim") ? darkColor.filter(x => !(globalPalette.map(d => d.darkColor)).includes(x))[0] : "#000000"; 
        	element.lightColor = (element.type === "sim") ? lightColor.filter(x => !(globalPalette.map(d => d.lightColor)).includes(x))[0] :  "#cccccc"; 
        				 		
        	globalPalette.push({name: element.name, type: element.type, darkColor: element.darkColor, lightColor: element.lightColor})      
        }
    }
}

/*---------------------------------------------------------------------------*/
/*-------------------- POST-PROCESSING OF NETCDF FILES  ---------------------*/
/*---------------------------------------------------------------------------*/

export function parsingTime(netcdfFile) {
/* It finds and transforms the time coordinate into a Date object */
// pending: we must consider calendars ! (gregorian, noleap)
		
	let index_time = netcdfFile.variables.map(function(e) { return e.name; }).indexOf("time");
	let time = netcdfFile.variables[index_time];
	
	let index_calendar = (time.attributes).map(function(e) { return e.name; }).indexOf("calendar");

//	if (time.attributes[index_calendar].value === "gregorian"){
	let index_units = (time.attributes).map(function(e) { return e.name; }).indexOf("units");
	
	let ref_date = new Date((time.attributes[index_units].value).match(/\d{4}-\d{1,2}-\d{1,2}/)[0]);
	
	let ref_unit = (time.attributes[index_units].value).split(' ')[0];
	
	if (ref_unit === "days") {
		var ms = 24*60*60*1000;
	} else if (ref_unit === "seconds") {
		var ms = 1000;
	} else {
		var ms = 0;
	}
	
	let time_axis = new Array(netcdfFile.getDataVariable("time"))[0]

	// dates needs to be converted to miliseconds first
	return time_axis.map(x => new Date(parseInt(x)*ms + ref_date.getTime()))
}

/*---------------------------------------------------------------------------*/
		/*
		pending : arrow at the end
							
		xAxis.select("path.domain").attr("marker-end","url(#markerArrow)")
		yAxis.select("path.domain").attr("marker-end","url(#markerArrow)")
								
		defs.append("svg:marker")
			.attr("id", "markerArrow")
			.attr("refX", 0)
			.attr("refY", 6)
			.attr("orient", "auto")
			.attr("markerWidth", 13)
			.attr("markerHeight", 13)
			.append("svg:path")
			.attr("d","M 0 0 L 10 5 L 0 10 z") //.attr("d","M2,2 L2,11 L10,6 L2,2")	
		*/
/*---------------------------------------------------------------------------*/

		// tooltip must be on top (i.e., it's the last element) but why ?
		// it has to be removed, otherwise we repeat it when re-adding an element
		// also : each time we add/remove a line we repeat this element
		// we lost brushing too 
		// needs width and height
		
		/*
		svg.append('rect')
			.attr('width', width)
			.attr('height', height)
			.style('opacity', 0)
			.on('touchmouse mousemove', function(event){
				const date = xScale.invert(d3.pointer(event, this))

				const dateBisector = d3.bisector(d => d.x).left;
				
				
				var ds = data.map(function(e) {
					var i = dateBisector(e.data, date, 1),
					d0 = e.data[i - 1],
					d1 = e.data[i];
					return date - d0.x > d1.x - date ? d1 : d0;
				});
				console.log(ds)
				console.log([...new Set(ds.map(d => d.x))]) // just the date...

			})
			.on('mouseleave', function(event){
			})
		*/
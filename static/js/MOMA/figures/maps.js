import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import * as d3geoProj from "https://cdn.skypack.dev/d3-geo-projection@4";
import { geoContour, geoVoronoi } from "https://cdn.skypack.dev/d3-geo-voronoi@2";
import { default as d3geoZoom } from "https://cdn.jsdelivr.net/npm/d3-geo-zoom@1.5.1/+esm"; 

import * as topojson from "https://cdn.jsdelivr.net/npm/topojson@3.0.2/+esm"; 
import * as geotoolbox  from 'https://cdn.jsdelivr.net/npm/geotoolbox@2.0.3/+esm'; 

import { flaskCommunication } from './../dataviz/communication.js'

import { config } from './../datavizLayout.js'

/* SVG CONTAINER */
const width_initial = 1200; 
const height_initial = 700; 

let margin =  {top: 10, right: 50, bottom: 10, left: 10};
const width = width_initial - margin.left - margin.right;
const height = height_initial - margin.top - margin.bottom;

/* projection attributes */
// currently all figures use the same projection and zoom element
let projectionName; 

let projection, refScale, geoGenerator; 
let width_bb, height_bb; 

/* FUNCTIONS */
export async function maps(svg_id, data, event_id){

/* source
- https://observablehq.observablehq.cloud/framework-example-netcdf-contours/
- https://observablehq.com/@d3/world-map-svg
- https://github.com/d3/d3-geo-projection
*/
    let svg = d3.select(svg_id+" > g");
    let context = d3.select(svg_id).select(".contextMap > g");    

    const idx = config.findIndex(d => d.svg === svg_id)

    let worldMap = config[idx].worldMap;
    let currentProjection = config[idx].projection;
    let colorName = config[idx].color; 
    let colorBarRange = config[idx].range; 

    //
    let propertiesList = ["color", "colorbarPosition", "worldMap"]; //, "projection"];
    
    if (propertiesList.indexOf(event_id) === -1) {
        // draw for the first time        
        if (d3.selectAll(svg_id+" > g").select(".graticule").empty() || (event_id === "projection")) {
            d3.selectAll(svg_id+" > g").remove();    
            
            svg = d3.select(svg_id)
                            .attr("class", "D3map")
            				.attr("preserveAspectRatio", "xMinYMin meet")
            				.attr("viewBox", `0 0 ${width_initial} ${height_initial}`)
            				.append("g")
            				.attr("transform", `translate(${margin.left},${margin.top})`); 
            				
            const defs = svg.append("defs");

    		// clipPath: everything out of this area won't be drawn (used for zooming)
    		defs.append("svg:clipPath")
    			.attr("id", "clipD3map")
    			.append("svg:rect")
    			.attr("width", width)
    			.attr("height", height)
    			.attr("x", 0)
    			.attr("y", 0);
    				    			
    		context = svg.append('g')
    				.attr("class", "contextMap")
    				.attr("clip-path", "url(#clipD3map)")
    				.append("g");

            /* graticule and projection (defined only once) */
            let graticule = d3.geoGraticule();
            const sphere = {type: "Sphere"};

            let currentScale; 
            
            if ((typeof projection === 'undefined') || ((event_id === "projection") && (projectionName !== currentProjection)) ){     
                projectionName = currentProjection; 
                   
                try { 
                    projection = d3[projectionName](sphere)                
                    } 
                catch (error) {
                    projection = d3geoProj[projectionName](sphere)
                }
                projection.fitSize([width, height], graticule.outline())

                refScale = projection.scale();  
                currentScale = projection.scale(); 
                
            } else if (currentProjection === "geoOrthographic"){                     
                currentScale = projection.scale();                
                projection.scale(refScale)
            }

            /* plot figure (using refScale)*/
            geoGenerator = d3.geoPath().projection(projection)

            // map borders and sphere color
            context.append("g")
                .attr("class", "mapBorder-container")            
                .append("path").attr("class", "geo-feature sphere")
                .datum(sphere)                
                .attr("d", geoGenerator)
                .attr("fill", "#ededed") // light gray with opacity 0.4
                .attr("stroke", '#000000')
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 1);

            // ocean
            context.append("g")
                .attr("class", "ocean-container")
            
            // lat/lon
            context.append("g")
                .attr("class", "graticule-container")
                .append("path").attr("class", "geo-feature graticule")                
                .datum(graticule)
                .attr("d", geoGenerator)
                .attr("fill", "none")
                .attr("stroke", '#000000') 
                .attr("stroke-dasharray", "2")
                .attr("stroke-width", 0.3)
                .attr("stroke-opacity", 1);  
            
            // future variable    
            context.append("g")
                .attr("class", "variable-container");
            
            // land
            context.append("g")
                .attr("class", "land-container")
            
            // fill ocean and land
            world_decomposition(context, currentProjection, worldMap); 
            
            // bounding box           
            width_bb = svg.select('.contextMap').node().getBBox()['width'];
            height_bb = svg.select('.contextMap').node().getBBox()['height']; 
            
            /* ZOOM */            
            if (currentProjection === "geoOrthographic"){
                d3geoZoom()
                    .projection(projection)                    
                    .scaleExtent([1, 20])
                    .onMove(zoomAzimuthal)(svg.node())
               
                // current zoom level     
                svg.node().__zoom.k = currentScale/refScale; 
                
                // rendering
                projection.scale(currentScale)
                zoomAzimuthal({scale : currentScale})

            } else {
                let zoom = d3.zoom()
                                .scaleExtent([1, 20])
                                .extent([[0, 0], [width, height]])
                                .translateExtent([[(width-width_bb)/2, (height-height_bb)/2], [width-(width-width_bb)/2, height-(height-height_bb)/2]])
                                .on("zoom", zoomCylindrical);
                
                // remark : must be called on svg, not context !                
                svg.call(zoom)

                // update new figure to current zoom transformation (we choose the first svg)
                let transform = (event_id === "projection") ? d3.zoomIdentity.translate(0,0).scale(1/d3.select(".D3map > g").node().__zoom.k) : d3.select(".D3map > g").node().__zoom;
                                                 
                zoomCylindrical({"transform" : transform}, svg) 
                
            }
            // zoom level track
            zoomTrack(svg, svg.node().__zoom.k, false)
        }
                     
        /* plot figure */
        // variable    
        context.selectAll(".variable-container").selectAll("path").remove() 

        if ((data) && (data.length !== 0)) {

            /* plot properties */
            let extent = d3.extent(data.features, d => d.properties.site.value)
            let colorScale = d3.scaleSequential(d3[colorName]).domain(extent)

            /* plot variable */
            context.selectAll(".variable-container")
                .selectAll("path")
                .data(data.features)
                .join("path")
                .attr("class", "geo-feature variable")
                .attr("d", d3.geoPath().projection(projection))
                .attr("fill", d => d ? colorScale(d.properties.site.value) : null); 
            
            context.selectAll(".land-container").selectAll("path").attr("fill-opacity", "0") 
             
            // colorbar
            colorbar(svg_id, colorScale, "right");                      
        } else {
            svg.selectAll(".bar, .ticks").remove();
            context.selectAll(".land-container").selectAll("path").attr("fill-opacity", "1")
        }
    } 
    // UPDATES
    // projection change is still pending
    else {                    
        if (event_id === "worldMap") {
            context.selectAll(".land-container").selectAll("path").remove();

            world_decomposition(context, currentProjection, worldMap);            
        }
        else if (event_id === "color") {
            let colorScale = d3.scaleSequential(d3[colorName]).domain(colorBarRange)     
        
            // color
            let colorScaleNew = d3.scaleSequential(d3[colorName]).domain(colorBarRange)    
            let gradient_name = "linear-gradient-"+svg_id.split('#')[1]
        
            // transition in variable color   
        	svg.select(".variable-container").selectAll('path')
        		.transition().duration(1000)     
        		.attr("fill", d => d ? colorScaleNew(d.properties.site.value) : null);  

            // transition in colorbar 
            // source : https://stackoverflow.com/questions/54470589/why-doesnt-my-transition-for-gradient-color-work
            svg.selectAll("#"+gradient_name).remove();
            
            let linearGradient = d3.selectAll(svg_id+" > g").select("defs")
                                    .append("linearGradient").attr("id", gradient_name);

            let stops = linearGradient.selectAll("stop")
                            .data(colorScale.ticks().map((t, i, n) => ({offset: `${100*i/n.length}%`, color: colorScale(t), color2: colorScaleNew(t) })))
                            .enter().append("stop")
                            .attr("offset", d => d.offset)
                            .attr("stop-color", d => d.color);

            svg.selectAll(".colorbar > g").select("rect").style("fill", "url(#"+gradient_name+")");

            stops.transition()
                .attr("stop-color", d => d.color2 )
                .duration(1000);
                   
            colorScale = colorScaleNew;                
        }
        else if (event_id === "colorbarPosition") {
            let colorScale = d3.scaleSequential(d3[colorName]).domain(colorBarRange)     
        
            // move colorbar  
            colorbar(svg_id, colorScale, "right", 1000);
        }
    }
}

/* WORLD DECOMPOSITION 
sources : 
- https://github.com/nvkelso/natural-earth-vector/tree/master
- https://github.com/topojson/world-atlas
- https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-ocean/
- https://observablehq.com/@d3/oceans
*/
async function world_decomposition(context, currentProjection, worldMap){

    // ocean
    // temporary fix (https://observablehq.com/@fil/ocean) we must create our json ocean files
    const world = await d3.json(`static/world-atlas/countries-110m.json`);    

    let objects_ocean = ({
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          arcs: world.objects.land.geometries
            .map(polygon => polygon.arcs).flat(2)
            .map(arcs => arcs.map(s => ~s).reverse())
        }
      ]
    })
    let ocean = topojson.feature(world, objects_ocean);
    
    context.selectAll(".ocean-container").selectAll("path").remove()
    context.selectAll(".ocean-container")
        .append("path").attr("class", "geo-feature ocean")
        .datum(ocean)
        .attr("d", geoGenerator)
        .attr("fill", "#dae6f0") // steelblue with opacity 0.2
        .style("stroke", "none"); 
    
    // land
    worldMap = (typeof worldMap === 'undefined') ? 'countries-110m' : worldMap;
    let land; 
    
    if (worldMap === 'countries-110m') {
        land = topojson.feature(world, world.objects.countries)
    } else {
        land = await d3.json(`static/world-atlas/${worldMap}.json`);
    }

    let tooltip = d3.select("body")
                    .append("div")
                    .style("position", "absolute")
                    .style("z-index", "10")
                    .style("visibility", "hidden")
                    //
                    .attr("class", "tooltip")
                    .style("background-color", "white")
                    .style("border", "solid")
                    .style("border-width", "2px")
                    .style("border-radius", "5px")
                    .style("padding", "5px")
                    //
                    .text("a simple tooltip");

    context.selectAll(".land-container").selectAll("path").remove()
    context.selectAll(".land-container")
        .selectAll("path")
        .data(land.features)
        .join("path").attr("class", "geo-feature land")
        .attr("d", geoGenerator)
        .attr("fill", "transparent")
        .style("stroke", "#000")
        //
        .on("mouseover", function(d){
                            tooltip.style("visibility", "visible");
                            })
        .on("mousemove", function(event, d){
                            let title = d.properties.region_name
        
                            tooltip.html(title)
                                .style("top",(event.pageY-10)+"px")
                                .style("left",(event.pageX+10)+"px");

                            d3.select(this).attr("fill", "#ffcccc");
                            })
        .on("mouseleave", function(d){
                            d3.select(this).attr("fill", "transparent");
                            tooltip.style("visibility", "hidden");
                            })
        //                
        .on("click", (currentProjection === "geoOrthographic") ? AzimuthalClick : CylindricalClick); 


    if (!context.selectAll(".variable-container").selectAll("path").empty()){
        context.selectAll(".land-container").selectAll("path").attr("fill-opacity", "0")
    }
} 


/* COLORBAR */
function colorbar(svg_id, colorScale, orientation, transition){
/* 
orientation : bottom, right

source : 
- https://observablehq.com/@tmcw/d3-scalesequential-continuous-color-legend-example
*/
    let svg = d3.select(svg_id+" > g");
    
    if (typeof transition === 'undefined') {
        svg.selectAll(".bar, .ticks").remove();    
           
    } else {
        svg.selectAll(".bar, .ticks")
				.attr("fill-opacity", 1)
				.attr("stroke-opacity", 1)
				.transition().duration(transition/3)	
				.attr("fill-opacity", 0)
				.attr("stroke-opacity", 0)
				.remove();        
    }
    svg.selectAll(".colorbar").remove(); 

    let colorbar = svg.append('g').attr("class", "colorbar");
    
    let gradient_name = "linear-gradient-"+svg_id.split('#')[1]
    svg.selectAll("#"+gradient_name).remove(); 
    
    let side = (orientation === "right") ? "width" : "height";
    let sideLength = (side === "width") ? height : width;
    
    // dimensions
    let barHeight = 20;
    let barLength = d3.min([d3.select('.sphere').node().getBBox()[side], sideLength]); 
    let offset = 10;      
    let ds = (sideLength - barLength)/2;
        
    // coloring        
    let axisScale = d3.scaleLinear().domain(colorScale.domain())
    let linearGradient = d3.selectAll(svg_id+" > g").select("defs")
                            .append("linearGradient").attr("id", gradient_name);

    linearGradient.selectAll("stop")
        .data(colorScale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: colorScale(t) })))
        .enter().append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);

    // positioning properties
    let position = {    translateX : (orientation === 'bottom') ? ds : width + offset - barLength, 
                        translateY : (orientation === 'bottom') ? height + offset : ds, 
                        rotate : (orientation === 'bottom') ? 0 : -90, 
                        axisTranslateX : (orientation === 'bottom') ? 0 : width + offset + barHeight,
                        axisTranslateY : (orientation === 'bottom') ? height + offset + barHeight : 0,
                        axisOrientation : (orientation === 'bottom') ? 'axisBottom' : 'axisRight',
                        axisRange : (orientation === 'bottom') ? [ds, sideLength -ds] : [sideLength -ds, ds], 
                        }
    // drawing border
    colorbar.append('g')
        .attr("class", "bar")
        .attr("transform", `translate(${position.translateX},${position.translateY})`)
        .append("rect")
        .attr("width", barLength)
        .attr("height", barHeight)
        .attr("fill", "url(#"+gradient_name+")")
        .attr('transform', `rotate(${position.rotate}, ${barLength}, 0)`)
        //
        .attr("fill-opacity", ((typeof transition === 'undefined') ? 1 : 0))
		.attr("stroke-opacity", ((typeof transition === 'undefined') ? 1 : 0))
		.transition().duration((typeof transition === 'undefined') ? 0 : transition)	
		.attr("fill-opacity", 1)
		.attr("stroke-opacity", 1)		

    
    // see https://d3js.org/d3-axis#axis_ticks
    let axis;  
    axis = g => g
        .attr("class", "ticks")
        .attr("transform", `translate(${position.axisTranslateX},${position.axisTranslateY})`)
        .call(d3[position.axisOrientation](axisScale.range(position.axisRange))
            .ticks(sideLength / 80)
            .tickSize(-barHeight));
    
    colorbar.append('g').call(axis)
        //
        .attr("fill-opacity", ((typeof transition === 'undefined') ? 1 : 0))
		.attr("stroke-opacity", ((typeof transition === 'undefined') ? 1 : 0))
		.transition().duration((typeof transition === 'undefined') ? 0 : transition)	
		.attr("fill-opacity", 1)
		.attr("stroke-opacity", 1);
}

/* ZOOM */
   
/* CYLINDRICAL ZOOM */
function zoomCylindrical(event, selection) {
    let transform = event.transform;        
    selection = (typeof selection === 'undefined') ? d3.selectAll('.D3map > g') : selection; 
    
    renderCylindrical(transform, selection)
    
    // update each svg __zoom property (to keep them syncronized)
    // https://stackoverflow.com/questions/61071276/d3-synchronizing-2-separate-zoom-behaviors 
    // https://stackoverflow.com/questions/54890294/i-cant-access-the-groups-property-in-angular-d3js
    selection.each(function(d) {
        d3.select(this).node().__zoom = transform; 
        
        mapCommunication(d3.select(this), d3.select(this).node().__zoom.k);        
    })
}

function renderCylindrical(transform, selection){
    // zoom
    selection.selectAll(".contextMap > g").attr("transform", transform);
        
    // can we retrieve their initial values ?
    let scale = (typeof transform.k !== 'undefined') ? transform.k : Number(new RegExp("scale\\((.*?)\\,", "g").exec(transform)[1]);
    
    selection.selectAll('path.graticule').attr("stroke-dasharray", 2 / scale);
    selection.selectAll('path.graticule').attr("stroke-width", 0.3 / scale);    
    selection.selectAll('path.land').attr("stroke-width", 1 / scale);         
    selection.selectAll('path.map-border').attr("stroke-width", 1 / scale);
}

/* country interaction
- https://gist.github.com/mbostock/5e81cc677d186b6845cb00676758a339
- https://gist.github.com/mbostock/4699541
*/

function CylindricalClick(event, country) {
    let svg = d3.select(".D3map > g");
    let t0 = d3.zoomTransform(svg.node());

    let currentScale = t0.k;
    let bounds = geoGenerator.bounds(country);
        
    /* new transform */
    let x = (bounds[0][0] + bounds[1][0]) / 2;
    let y = (bounds[0][1] + bounds[1][1]) / 2;
    let nextScale = d3.max([0.95/d3.max([(bounds[1][0] - bounds[0][0])/ (width/2), (bounds[1][1] - bounds[0][1])/(height/2)]), 1]);
    
    let t1 = (d3.zoomIdentity.scale(1/d3.zoomIdentity.k)).translate(width/2 - nextScale*x, height/2 -nextScale*y).scale(nextScale)
 
    // check/adjust boundaries
    if (t1.invertX(0) < (width-width_bb)/2) {
        t1.x = -(width-width_bb)/2 * t1.k;
    } else if (t1.invertX(width) > width-(width-width_bb)/2) { 
        t1.x = width - (width-(width-width_bb)/2)*t1.k;
    }
    
    if (t1.invertY(0) < (height-height_bb)/2) {
        t1.y = -(height-height_bb)/2 * t1.k;
    } else if (t1.invertY(height) > height-(height-height_bb)/2) {
        t1.y = height - (height-(height-height_bb)/2)*t1.k;
    }

    // transition
    let T = d3.interpolateTransformSvg(t0, t1)

    d3.transition()
                .tween("render", () => t => { renderCylindrical(T(t), d3.selectAll('.D3map > g')) })
                .duration(1250);
   
    d3.selectAll(".D3map > g").each(function(d) {
        d3.select(this).node().__zoom = t1; 
        
        mapCommunication(d3.select(this), d3.select(this).node().__zoom.k)      
    })
    
}
    
/*AZIMUTHAL ZOOM*/
// https://github.com/vasturiano/d3-geo-zoom
// https://github.com/vasturiano/d3-geo-zoom/blob/master/example/svg/index.html

/*
to keep in mind : 
- d3.geoZoom tracks different widgets if they use THE SAME projection element
- d3.selectAll() allows to syncronize these maps
*/

function zoomAzimuthal(transform){
    d3.selectAll('path.geo-feature').attr('d', geoGenerator);
    
    // update each svg __zoom property (to keep them syncronized)
    // projection coordinates rotation, scale need to be updated on each map
    d3.selectAll(".D3map > g").each(function(d) {
        d3.select(this).node().__zoom.k = transform.scale/refScale; 
        
        mapCommunication(d3.select(this), transform.scale/refScale);
    })
}
 
/* country interaction
- https://observablehq.com/@d3/world-tour
- https://stackoverflow.com/questions/45595422/d3-world-map-with-country-click-and-zoom-almost-working-not-quite
*/
    
function AzimuthalClick(event, country) {
    // rotation
    let p1 = [0, 0], p2 = d3.geoCentroid(country);
    let r1 = projection.rotate(), r2 = [-p2[0], -p2[1], 0];
    
    const iv = Versor.interpolateAngles(r1, r2);

    // scaling to box
    let bounds = geoGenerator.bounds(country);
    
    let initialScale = projection.scale();    
    let scaleFactor = 1/d3.max([(bounds[1][0] - bounds[0][0])/ (width/2), (bounds[1][1] - bounds[0][1])/(height/2)]); 
        
    let s = d3.interpolate(1*initialScale, scaleFactor*initialScale);
    
    d3.transition()
                .tween("render", () => t => {   projection.rotate(iv(t)).scale(s(t));                                             
                                                d3.selectAll('path.geo-feature').attr('d', geoGenerator);
                                                })                                        
                .duration(1250);
                
    d3.selectAll(".D3map > g").each(function(d) {
        d3.select(this).node().__zoom.k = scaleFactor*initialScale/refScale; 
        
        mapCommunication(d3.select(this), scaleFactor*initialScale/refScale);
    })
    
    // $('#'+country.properties.region_name).prop('checked', true);
}

/* COMMUNICATION */
// display zoom for visual purposes
function zoomTrack(svg, value, display){
    if (false || display) { 
        svg.append("g").append("text")
            .attr("class", "zoomScale")
    		.attr("y", 0)
    		.attr("x", 0)
    		.attr("dy", "1em")
    		.attr("font-size", "30px")
    		.style("text-anchor", "left")
    		.text(value);	
    }
}

// flask
function mapCommunication(selection, zoomScale){

    // zoomScale verification
    selection.selectAll(".zoomScale").text(zoomScale)
    
    // communication    
    const svg_id = '#'+selection.node().ownerSVGElement.id;
    const idx = config.findIndex(d => d.svg === svg_id)
    
    flaskCommunication(config[idx])
}

/* AZIMUTHAL FUNCTIONS */
class Versor {
  static fromAngles([l, p, g]) {
    l *= Math.PI / 360;
    p *= Math.PI / 360;
    g *= Math.PI / 360;
    const sl = Math.sin(l), cl = Math.cos(l);
    const sp = Math.sin(p), cp = Math.cos(p);
    const sg = Math.sin(g), cg = Math.cos(g);
    return [
      cl * cp * cg + sl * sp * sg,
      sl * cp * cg - cl * sp * sg,
      cl * sp * cg + sl * cp * sg,
      cl * cp * sg - sl * sp * cg
    ];
  }
  static toAngles([a, b, c, d]) {
    return [
      Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * 180 / Math.PI,
      Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * 180 / Math.PI,
      Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * 180 / Math.PI
    ];
  }
  static interpolateAngles(a, b) {
    const i = Versor.interpolate(Versor.fromAngles(a), Versor.fromAngles(b));
    return t => Versor.toAngles(i(t));
  }
  static interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    a2 -= a1, b2 -= b1, c2 -= c1, d2 -= d1;
    const x = new Array(4);
    return t => {
      const l = Math.hypot(x[0] = a1 + a2 * t, x[1] = b1 + b2 * t, x[2] = c1 + c2 * t, x[3] = d1 + d2 * t);
      x[0] /= l, x[1] /= l, x[2] /= l, x[3] /= l;
      return x;
    };
  }
  static interpolate([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    let dot = a1 * a2 + b1 * b2 + c1 * c2 + d1 * d2;
    if (dot < 0) a2 = -a2, b2 = -b2, c2 = -c2, d2 = -d2, dot = -dot;
    if (dot > 0.9995) return Versor.interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]); 
    const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
    const x = new Array(4);
    const l = Math.hypot(a2 -= a1 * dot, b2 -= b1 * dot, c2 -= c1 * dot, d2 -= d1 * dot);
    a2 /= l, b2 /= l, c2 /= l, d2 /= l;
    return t => {
      const theta = theta0 * t;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      x[0] = a1 * c + a2 * s;
      x[1] = b1 * c + b2 * s;
      x[2] = c1 * c + c2 * s;
      x[3] = d1 * c + d2 * s;
      return x;
    };
  }
}

/*---------------------------------------------------------------------------*/
/*-------------------- POST-PROCESSING OF NETCDF FILES  ---------------------*/
/*---------------------------------------------------------------------------*/

export function polygons(netcdfFile) {    
    /*
    Produces a json file of polygons, either a voronoi tesselation or contour levels
    */
    let shapes; 
    
    let values = new Array(netcdfFile.getDataVariable("gpp"))[0];
    
    let lat = new Array(netcdfFile.getDataVariable("lat"))[0];
    let lon = new Array(netcdfFile.getDataVariable("lon"))[0];
    
    const m = lat.length; 
    const n = lon.length; 

    if (true){
        // CREATE A VORONOI TESSELATION AS GRID
        // source https://observablehq.com/@fil/d3-geo-voronoi-and-gridded-data
        // bottleneck : takes approx 3.5 secs for a larger dataset. Solution : use already masked data, that includes a "boundary" layer filled with zeros.
    
        const points = values.map((d, i) => {
          return {
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [+((360+lon[i%n])%360), lat[Math.floor(i/n)]]
            },
            "value": +(d ? d : null),
            "index": i
          }
        });         
    
        const startTime = performance.now()
             
        shapes = geoVoronoi(points).polygons() 
    
        const endTime = performance.now()        
        // console.log(`voronoi polygons took ${endTime -startTime} milliseconds`)    

    } else {
        /* CREATE A CONTOUR GENERATOR
        remarks :   
            - we had to replace NaN values with 0 
            - threshold yields the number of level curves
        */
        const contourFunction = geoContour().thresholds(50)
                              .x((_, i) => ((i % n) * 2 - n + 1) * 180 / n)
                              .y((_, i) => -(Math.floor(i / n) * 2 - m + 1) * 90 / m)
                              .value((d) => d ? d : 0);
                                        
        const startTime = performance.now()   

        shapes = geotoolbox.featurecollection(contourFunction(values));         
        shapes.features.forEach(function(d){
            d.properties.site = {}
            d.properties.site.value = d.geometry.value
        })
        
        const endTime = performance.now()        
        // console.log(`contour polygons took ${endTime -startTime} milliseconds`)            
    }
    
    return [geotoolbox.filter(shapes, d => d.site.value > 0), d3.extent(values)];    
}
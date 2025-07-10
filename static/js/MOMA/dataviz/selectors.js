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

import { config, svg_id } from './../datavizLayout.js'

/*---------------------------------------------------------------------------*/
export function selectmenuFormatted(id) {
    const formatted = ['#timeResolution', '#experience', '#variableName', '#worldMap'];
	
	let filter = (Array.isArray(id)) ? formatted.filter(x => id.includes(x)) : formatted.filter(x => [id].includes(x))
		
    for (let selector of filter) {            
        const title = $((selector+'-button')).attr('title');
    	const label = $((selector+'-button')).find('.ui-selectmenu-text').text().trim();

        $((selector+'-button')).find('.ui-selectmenu-text').text(`${title} (${label})`);
    }
}

export async function setRegionList(worldMap, checked){    
    worldMap = (typeof worldMap === 'undefined') ? 'countries-110m' : worldMap;
    checked = ((typeof checked === 'undefined') || (checked.length === 0)) ? ['global'] : checked;

    // dictionary of regions
	const land = await fetch(`${window.origin}/static/world-atlas/${worldMap}.json`, {method : 'GET'})
     							.then((response) => {
     								if (response.ok) {
     									return response.json();
     								}						
         							})
     							.catch((error) => { console.log(error) });

    let regions = {"global" : "Global"}; 
    if (worldMap !== 'countries-110m') {
        land.features.forEach(feature => regions[feature.properties.region_id] = feature.properties.region_name)
    }
    
    // checkboxes
	for (let form of $("#spatialExtent")){	
    	form.innerHTML = '';		    	

     	let v = "";		
     			
        for (const [key, value] of Object.entries(regions)) {            
            if (checked.includes(key)) {
				v += `<div class> <label for=${key}><input id=${key} name=${value} class="region" type="checkbox" checked> ${value} </label> </div>`
            } else {
				v += `<div class> <label for=${key}><input id=${key} name=${value} class="region" type="checkbox"> ${value} </label> </div>`
            }    
        }
     	
     	form.innerHTML = v ? v : '<div class="region" style="padding-left:10px;"> Not available </div>';
     }
}

export async function setDatasetList(experience, variableName, checked=[null]) {
	for (let datasetType of $(".datasetList")){	
		
		datasetType.innerHTML = '';	
	    	
 		let v = "";		
 		let type = datasetType.id.slice(0,3)
 		
 		/* testing on THREDDS with 
 		("THREDDS", "psepulchre/DeepMIP/deepmip-eocene-p1/CESM/CESM1.2-CAM5/deepmip-eocene-p1-PI/v1.0/climatology", ".nc")
 		("THREDDS", "sreyes/dataviz/"+variableName, ".nc")
 		*/
 		let path = [type, (type === "obs") ? "historical" : experience, variableName].join("/");     
 			
 		resourceList("spirit", path).then(function(elements) {
 			for (let id of elements){
                let label = new RegExp("^.+?(?=(\_\\d\\d\\d\\d))", "g").exec(id)[0]; 
 			
                if (checked.includes(id) || checked.includes(label)) {
     				v += `<div> <label for=${id}><input id=${id} name=${label} class="dataset ${type}" type="checkbox" checked> ${label} </label> </div>`
                } else {
     				v += `<div> <label for=${id}><input id=${id} name=${label} class="dataset ${type}" type="checkbox"> ${label} </label> </div>`
                }

 			}
 			datasetType.innerHTML = v ? v : '<div class="dataset" style="padding-left:10px;"> Not available </div>';
 		});
	}
}

export async function resourceList(source, directory, type=undefined) { 
	if (source === "spirit") {
		const flaskResponse = await fetch(`static/data/${directory}.json`)
							.then((response) => {
								if (response.ok) {
									return response.json();
								}						
							})
							.catch((error) => { console.log(error) });
							
		return flaskResponse;		
	}
	/* complete selectors using THREDDS
	source: https://observablehq.com/@pbrockmann/wms-leaflet-map-deepmip
	e.g.: url = "sreyes/dataviz/"
	*/
	else if (source === "THREDDS") {
		const xmlResponseDirectories = await fetch("https://thredds-su.ipsl.fr/thredds/catalog/ipsl_thredds/"+directory+"/catalog.xml")
							.then((response) => {
								if (response.ok) {
									return response.text();
								}						
							})
							.catch((error) => {
								console.log(error)
							});

		if (typeof xmlResponseDirectories !== 'undefined') {
			const catalog = new DOMParser().parseFromString(xmlResponseDirectories,"text/xml");
			
			if (type === "folder") {
				var ressourcesArray = Array.from(catalog.querySelectorAll("dataset > catalogRef"), 
									(n) => n.getAttribute("ID").replace("DatasetScanIPSLTHREDDS/" + directory +"/", ""));
			} else {
				var ressourcesArray = Array.from(catalog.querySelectorAll("dataset > dataset"),
									(n) => n.getAttribute("name")).filter((d) => d.endsWith(".nc"));	
			}
			return ressourcesArray;
		} else {
			return [];
		}
	}
    // development
	else {
	}
};
/*---------------------------- widget functions -----------------------------*/
import { grid, config } from './../datavizLayout.js'
import { selectmenuFormatted, resourceList, setDatasetList, setRegionList } from './selectors.js'
import { flaskCommunication } from './communication.js'

let widget_resized_id;
let maxCellHeight, maxCellWidth;

/*---------------------------------------------------------------------------*/
// MOMA figures
const map_type = $('.D3button').find('#maps')[0].id
const ts_type = $('.D3button').find('#TS')[0].id

/*---------------------------------------------------------------------------*/
export function addWidget(item) {
// - It creates a widget (window), 
// - adds the associated events to its buttons, 
// - enables Flask communication through focusOnGridElement

    [maxCellHeight, maxCellWidth] = widgetBounds(grid)
    
    const container = `<div class='grid-stack-item ui-resizable-autohide' 
                        id=${item.id} gs-id=${item.id}
                        gs-w=${item.w} gs-h=${item.h} 
                        gs-min-w="6" gs-max-w=${maxCellWidth} gs-min-h="4" gs-max-h=${maxCellHeight}>
                    <div class="grid-stack-item-content ui-draggable-handle">
                        <div class='item-header row' style='display:flex'> 
                            <div class="content-header" style="flex: 1; text-align: center; vertical-align: middle;"></div>
                            <div style='margin-left: auto'>
                            <button class='widget_buttons' id='widget_download'><ion-icon name="download-outline"></ion-icon></button>
                            <!--
                            <button class='widget_buttons' id='widget_chain'><ion-icon name="link"></ion-icon></button>                            
                            -->
                            <button class='widget_buttons' id='widget_resize'><ion-icon name="expand-outline"></ion-icon></button>
                            <button class='widget_buttons' id='widget_remove'><ion-icon name="close-outline"></ion-icon></button>
                            </div>
                        </div>
                        <div class="content" id="content_${item.id}"> <svg id="dataviz_${item.id}"></svg> </div>     
                    </div>
                    </div>`

    $('.grid-stack').append(container)
    grid.makeWidget('#'+item.id);    
    
    // focus on widget event
    $('#'+item.id).on('click', event => {
        let widget = $(event.target).closest('.grid-stack-item');    
        focusOnGridElement(widget)
    })
    
    // widget buttons events
    $('#'+item.id).find('.item-header').on('click', 'button', event => {
        event.stopPropagation()
        
        let buttonId = $(event.target).closest('button').attr('id'); 
        let widget = $(event.target).closest('.grid-stack-item');
        
        if (buttonId === 'widget_remove') {
            let el = $(event.target).closest('.grid-stack-item');       
            grid.removeWidget(widget[0]);      
              
        } else if (buttonId === 'widget_download') {
            focusOnGridElement(widget)
            downloadWidget(widget);
        
        } else if (buttonId === 'widget_resize') {
            focusOnGridElement(widget)
            resizeWidget(widget, true);
        }
    })   
}

/*---------------------------------------------------------------------------*/
export function focusOnGridElement(widget) {
// set widget's header color (to emphasize the current window),
// updates LHS selectors according to selection, 
// enables Flask communication

    const svg_id = '#' +$(widget).find('svg')[0].id;         
    const idx = config.findIndex( d => d.svg === svg_id )
    const plot = config[idx].plot
        
    // widget customization
    $('.item-header').css('background-color', 'rgb(234, 236, 239, 0.8)')
    $('.widget_buttons').css('background-color', 'rgb(234, 236, 239, 0.9)') 
    
    $(widget).find('.item-header').css('background-color', 'rgb(223, 239, 255, 0.8)')
    $(widget).find('.widget_buttons').css('background-color', 'rgb(223, 239, 255, 0.9)')    
    $(widget).find('.content-header').text(widgetTitle(svg_id))
    
    // Recover and display data configuration                
    $('#experience').val(config[idx].experience).selectmenu('refresh');
    $('#variableName').val(config[idx].variableName).selectmenu('refresh'); 
    $('#worldMap').val(config[idx].worldMap).selectmenu('refresh');         
    if (plot === map_type) {
        $('#projection').val(config[idx].projection).selectmenu('refresh');
        $('#color').val(config[idx].color).selectmenu('refresh');
    } else if (plot === ts_type){
        $('#timeResolution').val(config[idx].timeResolution).selectmenu('refresh');    
    }
    //brush : null
    
    // data filters    
    selectmenuFormatted(['#timeResolution', '#experience', '#variableName', '#worldMap']);    
    setRegionList(config[idx].worldMap, config[idx].spatialExtent);    
    setDatasetList(config[idx].experience, config[idx].variableName, config[idx].dataset)    

	// LHS panel visibility     	     
  	$('#allExceptPlotSelector').css('display', 'block');
  	$('#divTimeResolution, #divTemporalRange').css('display', (plot === 'TS') ? 'block' : 'none');	
  	$('#divGeoProjection, #divGeoColor').css('display', (plot === 'TS') ? 'none' : 'block');
  	
    // flask communication
    flaskCommunication(config[idx])  	
}

/*---------------------------------------------------------------------------*/
export function gridOn(event, item) {
    let widget, widget_svg, deleted_id; 

    if (event.type === 'added') {
        widget = item[0].el;        
    } else if (event.type === 'dragstop') { 
        widget = item;                
    } else if (event.type === 'resizestop') {  
        widget = item;                
        resizeWidget(widget, false)    
    } else if (event.type === 'removed') {
        widget = grid.el.lastElementChild;         
        deleted_id = Number(item[0].id)
    }
    
    if (grid.getGridItems().length >= 1) {
        focusOnGridElement(widget)
    }
    
    if ($(widget).find('svg').length > 0){
        widget_svg = '#' +$(widget).find('svg')[0].id
    }
    
    return [widget_svg, deleted_id]
}

/*---------------------------------------------------------------------------*/
export function widgetTitle(svg_id) {
    let title;
        
    const idx = config.findIndex( d => d.svg === svg_id )

    if (idx >= 0){    
        const plot = config[idx].plot; 
    
        if (plot === ts_type) {
            title = `${config[idx].variableName} (${config[idx].timeResolution})`
        } else if (plot === map_type) {
            title = `${config[idx].variableName} (${config[idx].spatialExtent})`
            
            if (typeof config[idx].dataset !== 'undefined') { title += ` - ${config[idx].dataset[0]}` }
        }
    
       return title; 
    }
}

/*---------------------------------------------------------------------------*/
function downloadWidget(widget){
    // source : https://stackoverflow.com/questions/28226677/save-inline-svg-as-jpeg-png-svg

    let svg = document.querySelector('#'+$(widget).find('svg').attr('id')) 
    let data = (new XMLSerializer()).serializeToString(svg)
    let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'})    
    let url = URL.createObjectURL(svgBlob)            
        
    const format = $('#format').find(':selected').val(); 
    
    if (format === 'svg') {
        let a = document.createElement('a')        
        a.setAttribute('download', 'image.svg')
        a.setAttribute('href', url)
        a.setAttribute('target', '_blank')
    
        a.click();
        a.remove();    
        
        URL.revokeObjectURL(url);
    } else {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // const {width, height} = svg.getBBox();
            
            const width = 1200, height = 700; 
                        
            canvas.width = 1200; //width;
            canvas.height = 700; //height;
    
            ctx.fillStyle = $('#background').find(':selected').val();
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            
            const imgURL = canvas.toDataURL(`image/${format}`).replace(`image/${format}`, 'octet/stream');
            
            // download(imgURI);
            let a = document.createElement('a')       
            a.setAttribute('download', `image.${format}`)
            a.setAttribute('href', imgURL)
            a.setAttribute('target', '_blank')
        
            a.click();
            a.remove();                            
        };      
        img.src = url;
    }  
}

/*---------------------------------------------------------------------------*/
export function widgetBounds(grid){
// REZISE

    // grid size (cell)
    let cellHeight = grid.opts.cellHeight
    let gridVisibleHeight = $('#right-hand-side-dataviz').height()        

    let maxCellHeight, maxCellWidth; 

    if (gridVisibleHeight >= cellHeight*8){        
        maxCellHeight = 8; 
    } else if (gridVisibleHeight >= cellHeight*6){
        maxCellHeight = 6;
    } else {
        maxCellHeight = 4; 
    }
    maxCellWidth = maxCellHeight*1.5;

    return [maxCellHeight, maxCellWidth]
}

/* awful, but it works */
function resizeWidget(widget, button){
    let current =  (button) ? widget[0] : $('#'+widget.id)[0];
    let widget_resized = $('.grid-stack').find('#'+widget_resized_id);
    
    // grid size (check possible window changes)
    let [maxCellHeight_id, maxCellWidth_id] = widgetBounds(grid)
        
    if ((maxCellHeight !== maxCellHeight_id) || (maxCellWidth !== maxCellWidth_id)){
        // update maxH, maxW for all widgets (except current), resize to minimum 
        
        for (let element of grid.el.children){
            if (element.id !== current.id) {
                grid.update(element, {h:4, w:6, maxH:maxCellHeight_id, maxW: maxCellWidth_id})
                $('#'+element.id).find('#widget_resize').children('ion-icon').attr('name', 'expand-outline') 
            }
        }

        maxCellHeight = maxCellHeight_id; 
        maxCellWidth = maxCellWidth_id; 
        
    } else if ((widget_resized.length > 0) && (widget_resized[0].id !== current.id)){
        // resize previous element (if needed)
        grid.update(widget_resized[0], {h:4, w:6})

        $(widget_resized).find('#widget_resize').children('ion-icon').attr('name', 'expand-outline')        
    }
    widget_resized_id = current.id;
    
    // resize current element (with buttons)  
    let icon = $(current).find('#widget_resize').children('ion-icon');

    if (button && (icon.attr('name') == 'expand-outline')) {
        grid.update(current, {x:0, y:0, h:maxCellHeight, w:maxCellWidth, maxH:maxCellHeight, maxW:maxCellWidth})        
        $(icon).attr('name', 'contract-outline')      
        
    } else if (button && (icon.attr('name') == 'contract-outline')) {
        grid.update(current, {h:4, w:6, maxH:maxCellHeight, maxW:maxCellWidth})
        $(icon).attr('name', 'expand-outline')    
    }
    
    // expanded by hand
    if (!button && (widget.gridstackNode.h == maxCellHeight) && (widget.gridstackNode.w == maxCellWidth)){
        $(icon).attr('name', 'contract-outline') 
    } else if (!button && (widget.gridstackNode.h != 4) && (widget.gridstackNode.w != 6)){
        $(icon).attr('name', 'expand-outline')
    }
}
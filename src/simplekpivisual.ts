/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";

    import tooltip = powerbi.extensibility.utils.tooltip;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;

    export class SimpleKpiData {
        public value: Field;
        public target: Field;

        public tooltipsData : Field[];

        public constructor() {
            this.tooltipsData = [];
        }

        public gapBetweenValueAndTarget(): Field {
            var ff = new Field(this.target.value - this.value.value, 
                               this.value.format,
                               "Gap - " + this.value.displayName + " & " + this.target.displayName)

            return ff;
        }
    }

    export class SimpleKpiVisualTransform {
        public data: SimpleKpiData;
        public statusMessage: string;
    }
    
    export class Field {
        public value: number;
        public format: string;
        public displayName: string;
        public displayUnits: number;

        public constructor(value: number, format:string, displayName: string, displayUnits? : number) {
            this.value = value;
            this.format = format;
            this.displayName = displayName;
            this.displayUnits = displayUnits ? displayUnits : 0;
        }

        public toString(withFormatting?: boolean, withDisplayUnits?: boolean) {
            var displayUnits = withDisplayUnits ? this.displayUnits : 0;            
            if (withFormatting) {
                return ValueFormatter.create({ format: this.format, value: displayUnits })
                                     .format(this.value)    
            }
            else {
                if (withDisplayUnits) {
                    return ValueFormatter.create({ value: displayUnits })
                                     .format(this.value)    
                } else {    
                    return this.value.toString();
                }                
            }
        }
    }

    export class Area {
        x_min:number;
        x_max:number;
        y_min:number;
        y_max:number;
        public constructor(x_min, x_max, y_min, y_max) {
            this.x_min = x_min;
            this.x_max = x_max;
            this.y_min = y_min;
            this.y_max = y_max;
        }
        public width(): number {
            return this.x_max - this.x_min;
        }
        public height(): number {
            return this.y_max - this.y_min;
        }
    }

    export class StatusColor {
        public barColor: string;
        public fontColor: string;
    }

    /**
     * Function that converts queried data into a view model that will be used by the visual
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     * @param {IVisualHost} host            - Contains references to the host which contains services
     */
    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): SimpleKpiVisualTransform {
        /*Convert dataView to your viewModel*/
        var skvt = new SimpleKpiVisualTransform();
        
        var values = options.dataViews[0].table.rows[0];

        //now set up my data
        //loop through the data set and set up a value mapping table
        var valueArray = []
        valueArray["tooltips"] = [];
        for (var i = 0; i < options.dataViews[0].table.columns.length; i++) {
            var columnRole = options.dataViews[0].table.columns[i].roles;
            if (columnRole["value"] == true) {
                valueArray["value"] = i;
            }
            if (columnRole["target"] == true) {
                valueArray["target"] = i;
            }
            if (columnRole["tooltips"] == true) {
                valueArray["tooltips"].push(i)
            }
        }       

        if (valueArray["value"] == undefined) {
            skvt.data = null;
            skvt.statusMessage = "The value field must be supplied";
            return skvt;
        } 
        
        //collect the data
        var data = new SimpleKpiData();

        var columnsRef = options.dataViews[0].table.columns;

        data.value = new Field(Number(values[valueArray["value"]].toString()),
                            columnsRef[valueArray["value"]].format,
                            columnsRef[valueArray["value"]].displayName);
        
        if (valueArray["target"] != undefined) {
            data.target = new Field(Number(values[valueArray["target"]].toString()),
                                columnsRef[valueArray["target"]].format,
                                columnsRef[valueArray["target"]].displayName); 
        } else {
            data.target = null;
        }

        // now process the tooltips
        for (var i = 0; i < valueArray["tooltips"].length; i++) {
            var toolTipIndex = valueArray["tooltips"][i];
            var tooltipF = new Field(
                Number(values[toolTipIndex].toString()),
                columnsRef[toolTipIndex].format,
                columnsRef[toolTipIndex].displayName,
                0
            );
            data.tooltipsData.push(tooltipF);
        }

        skvt.data = data;
        skvt.statusMessage = null;

        return skvt;
    }

    export class simplekpivisual implements IVisual {
        private settings: VisualSettings;
        private target: HTMLElement;

        private host: IVisualHost;
        private rectangleBackingElement;
        private metricTextElement;
        private headerElement;

        private svg: d3.Selection<any>;
        private selectionManager : ISelectionManager;
        private tooltipServiceWrapper: tooltip.ITooltipServiceWrapper;

        constructor(options: VisualConstructorOptions) {
            console.log('Visual constructor', options);
            this.target = options.element;
            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();

            this.tooltipServiceWrapper = tooltip.createTooltipServiceWrapper(
                                                options.host.tooltipService,
                                                options.element);
            
            this.canvas_setup();
        }

        public update(options: VisualUpdateOptions) {

            this.settings =  simplekpivisual.parseSettings(options && options.dataViews && options.dataViews[0]);
            console.log('Visual update', options);
            
            this.canvas_clear();
            
            var transform = visualTransform(options,this.host);

            if (transform.data == null) {
                //print out the error message
            } else {
                var data = transform.data;
                
                var fontFamily = "'Segoe UI', 'wf_segoe-ui_normal', helvetica, arial, sans-serif;";

                //now if the target has been set to be defined in the settings we need to update it
                if (this.settings.targetSettings.defineTarget) {
                    if (data.target == null) {
                        data.target = new Field(this.settings.targetSettings.value, data.value.format, "Target", 0)
                    } else {
                        data.target.value = this.settings.targetSettings.value;
                    }
                }

                //configure the display units based on the settings
                var tS = this.settings.textSettings;
                data.value.displayUnits = tS.displayUnitsForValue != 0 ? tS.displayUnitsForValue : tS.displayUnits;
                if (data.target != null) {
                    data.target.displayUnits = tS.displayUnitsForTarget != 0 ? tS.displayUnitsForTarget : tS.displayUnits;
                }

                for (var i = 0; i < data.tooltipsData.length; i++) {
                    data.tooltipsData[i].displayUnits = this.settings.textSettings.displayUnits;
                }                

                //we need to derive the backing rectangle colour
                var stColor = this.derive_status_color(data.value, data.target);

                //Let's derive some of the sizing

                var margin_between_items = this.settings.headerSettings.margin_between;

                var SquareArea = new Area(0, parseInt(this.svg.style("width")), 0, parseInt(this.svg.style("height")));

                if (this.settings.headerSettings.show == true) {
                    
                    var label = this.settings.headerSettings.value;
                    var font_size = this.settings.headerSettings.fontSize;          

                    //now do an adjustment to the number of characters shown - primarily for mobile visualisation
                    if (this.settings.headerWhenSmallSettings.show == true && this.settings.headerWhenSmallSettings.threshold != null) {
                        if (this.settings.headerWhenSmallSettings.threshold > SquareArea.width()) {
                            label = this.settings.headerWhenSmallSettings.value != null ? this.settings.headerWhenSmallSettings.value : label;
                            font_size = this.settings.headerWhenSmallSettings.fontSize != null ? this.settings.headerWhenSmallSettings.fontSize : font_size;
                        }
                    }

                    var header = this.headerElement.append("text")
                                .classed("headerText",true)
                                .text(label);

                    header.style("font-size",font_size + "pt")
                          .style("font-family",fontFamily);
                    
                    var position = this.settings.headerSettings.position;
                    var headerArea = this.position_header(position);
                    
                    header.attr("x", headerArea.x_min)
                          .attr("y", headerArea.y_max);

                    switch(this.settings.headerSettings.position) {
                        case "left": SquareArea.x_min = headerArea.x_max + margin_between_items;
                                     break;
                        case "right": SquareArea.x_max = SquareArea.width() - (headerArea.width() + margin_between_items);
                                     break;
                        case "top":  SquareArea.y_min = margin_between_items + headerArea.height() + margin_between_items;
                                     break;
                        case "bottom": SquareArea.y_max = SquareArea.height() - (margin_between_items + headerArea.height());
                                       break;   
                        default:
                            throw new Error("Somehow the position wasn't set to one of the available values.");
                    }                                        

                }
                
                if (data.target != null && this.settings.kpiStyleSettings.style == "background") {
                    this.rectangleBackingElement .append("rect")
                                                .classed("rectBacking",true)
                                                .attr("width", SquareArea.width())
                                                .attr("height", SquareArea.height())
                                                .attr("x", SquareArea.x_min)
                                                .attr("y", SquareArea.y_min)
                                                .style("fill", stColor.barColor);
                }

                this.metricTextElement  .selectAll(".metricText")
                                        .data([data])
                                        .enter()
                                        .append("text")
                                        .classed("metricTxt",true) 
                                        .text(data.value.toString(true, true))
                                        .style("font-family",fontFamily)
                                        .style("fill", stColor.fontColor)
                                        .style("font-size","1em");
                
                //if responsive resize the text to fit in the square area                
                if (this.settings.textSettings.responsive == true) {
                    var percentage = this.settings.textSettings.percentageOfArea > 1 ? 1 : this.settings.textSettings.percentageOfArea;
                    this.resize_text(SquareArea, percentage);
                } else {
                    this.metricTextElement.selectAll(".metricTxt")
                                          .style("font-size", this.settings.textSettings.fontSize + "px");
                }

                var horizontalCenterPoint_buffer = (SquareArea.width() / 2) - ((this.metricTextElement.node().getBBox().width) / 2);
                var x = SquareArea.x_min + horizontalCenterPoint_buffer;

                var verticalCenterPoint_buffer =  (SquareArea.height() / 2) + ((this.metricTextElement.node().getBBox().height) / 4);
                var y = SquareArea.y_min + verticalCenterPoint_buffer;

                this.metricTextElement.selectAll(".metricTxt").attr("x", x + "px")
                                                              .attr("y", y + "px");

                this.tooltipServiceWrapper.addTooltip(
                    this.metricTextElement,
                        (tooltipEvent: TooltipEventArgs<number>) => simplekpivisual.getToolTipDataForBar(tooltipEvent.data,this.settings),
                        (tooltipEvent: TooltipEventArgs<number>) => null);     

            }
        }

        public static getToolTipDataForBar(dataNonCasted: any, settings :VisualSettings) : VisualTooltipDataItem[] {
            var useDisplayUnits = !settings.textSettings.ignoreFormattingForTooltips;
            var data:SimpleKpiData = dataNonCasted;

            if (data != null) {

                var toolTipDataBegin = [data.value];
                if (data.target != null && settings.targetSettings.showhide == true) { toolTipDataBegin.push(data.target); }
                var tooltipDataFieldList = toolTipDataBegin.map(function(f) {
                    return { displayName: f.displayName, value: f.toString(true,useDisplayUnits) }
                })

                var percentageFormatter = ValueFormatter.create({ format: "0.00 %;-0.00 %;0.00 %", value: 1, allowFormatBeautification: true });

                if (data.target != null && settings.targetSettings.showhide == true) {
                    var formattedGapValueTarget = "";

                    var gapTargetField = data.gapBetweenValueAndTarget();
                    gapTargetField.displayUnits = useDisplayUnits ? settings.textSettings.displayUnits : 0;
                    
                    gapTargetField.value = settings.textSettings.repPositiveGapAsNegativeNumber == true ? gapTargetField.value * -1 : gapTargetField.value;

                    formattedGapValueTarget = gapTargetField.toString(true, useDisplayUnits);

                    if (settings.textSettings.showPercentagesOnGaps == true) {
                        var formattedPercent = percentageFormatter.format(Math.abs(gapTargetField.value) / data.target.value)
                        formattedGapValueTarget += "(" + formattedPercent + ")";
                    }

                    tooltipDataFieldList.push(
                        {
                            displayName: gapTargetField.displayName,
                            value: formattedGapValueTarget
                        }
                    );

                }

                //now let's push the tooltips
                for (var i = 0; i < data.tooltipsData.length; i++) {
                    var ttData = data.tooltipsData[i];
                    tooltipDataFieldList.push(
                        {
                            displayName: ttData.displayName,
                            value: ttData.toString(true, useDisplayUnits)
                        }
                    )
                }

                //now return the tooltip data
                return tooltipDataFieldList;
            } else {
                return null;
            }
        }

        private canvas_setup() {

            var container = d3.select(this.target)

            this.svg = container.append("svg")
                                .attr("width", "100%")
                                .attr("height", "100%")
            
            this.headerElement = this.svg.append("g")
                                     .classed("headerArea", true);

            //draw the text
            this.rectangleBackingElement = this.svg.append("g")
                                            .classed("rectangleBacking",true)

            this.metricTextElement = this.svg.append("g")
                                       .classed("metricText",true)
        }

        private canvas_clear() {
            //clear the visual canvas
            this.rectangleBackingElement.selectAll(".rectBacking").remove()
            this.metricTextElement.selectAll(".metricTxt").remove()
            this.headerElement.selectAll(".headerText").remove()

        }

        private position_header(position) : Area {           
            
            var horizontalAlign = this.settings.headerSettings.alignHorizontal;
            
            var svgWidth = parseInt(this.svg.style("width"));
            var svgHeight = parseInt(this.svg.style("height"));
            
            var headerElemWidth = this.headerElement.node().getBBox().width;
            var headerElemHeight = this.headerElement.node().getBBox().height;
            
            var headerTxtArea = new Area(0, headerElemWidth, 0, headerElemHeight);
            var headerXPx = null;
            var headerYPx = null;
            if (position == "left") {                        
                //align the y to be the center in terms of the
                headerXPx = 0;
                headerTxtArea.y_max = (svgHeight / 2) + (headerElemHeight / 4);
                headerTxtArea.y_min = headerTxtArea.y_max - headerElemHeight;
                //only need to set x_min for the square area
                                     
            } else if (position == "top") {
                //horizontal x needs to be at center
                headerTxtArea.x_min = (svgWidth / 2) - (headerElemWidth / 2)
                headerTxtArea.x_max = headerTxtArea.x_min + headerElemWidth;
                //only need to set y_min for the square area
                
            } else if (position == "right") {
                //align the y to be the center in terms of the
                headerTxtArea.x_min = svgWidth - headerTxtArea.width();
                headerTxtArea.x_max = svgWidth;
                headerTxtArea.y_max = (svgHeight / 2) + (headerTxtArea.height() / 4);
                headerTxtArea.y_min = headerTxtArea.y_max - headerElemHeight;
                //now we need to set x_max for the square area
                
            }
            else if (position == "bottom") {
                //horizontal x needs to be at center
                headerTxtArea.x_min = (svgWidth / 2) - (headerTxtArea.width() / 2);
                headerTxtArea.x_max = headerTxtArea.x_min + headerElemWidth;
                headerTxtArea.y_max = svgHeight - 5;
                headerTxtArea.y_min = headerTxtArea.y_max - headerElemHeight;
                //only need to set y_min for the square
                
            }

            return headerTxtArea;
        }

        private derive_status_color(value, target?): StatusColor {
            var stColor = new StatusColor();
            stColor.barColor = this.settings.colorSettings.equalToColor;
            stColor.fontColor = this.settings.colorSettings.textEqualToColor;

            if (target != null) {
                if (value.value > target.value) {
                    stColor.barColor = this.settings.colorSettings.greaterThanColor
                    stColor.fontColor = this.settings.colorSettings.textGreaterThanColor;
                } 
                else if (value.value < target.value) {
                    stColor.barColor = this.settings.colorSettings.lessThanColor;
                    stColor.fontColor = this.settings.colorSettings.textLessThanColor;
                }
            } else {
                stColor.fontColor = this.settings.colorSettings.targetNotDefinedTextColor;
            }
                
            if (this.settings.kpiStyleSettings.style == "text") {
                stColor.fontColor = stColor.barColor;
            }

            return stColor;
        }

        private resize_text(area_to_fit_in:Area, percentageOfArea: number) {
            var i = 2;
            var textAreaHeight = area_to_fit_in.height() * percentageOfArea;
            var textAreaWidth = area_to_fit_in.width() * percentageOfArea;
            //now scale the text based on the width / height                
            var txtHeight = this.metricTextElement.node().getBBox().height;
            var txtWidth = this.metricTextElement.node().getBBox().width;
            //artifically constrain it to do only 19 loops, so maximum is 19em
            while ((txtHeight <= textAreaHeight && txtWidth <= textAreaWidth) && i < 20) {
                this.metricTextElement.selectAll(".metricTxt")
                                        .style("font-size", i + "em");
                txtHeight = this.metricTextElement.node().getBBox().height;
                txtWidth = this.metricTextElement.node().getBBox().width;
                i++;
            }
            //now if either are greater reduce the text size
            if (txtHeight > textAreaHeight || txtWidth > textAreaWidth) {
                i--;
                this.metricTextElement.selectAll(".metricTxt")
                                        .style("font-size", i + "em");
                txtHeight = this.metricTextElement.node().getBBox().height;
                txtWidth = this.metricTextElement.node().getBBox().width;
            }
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}
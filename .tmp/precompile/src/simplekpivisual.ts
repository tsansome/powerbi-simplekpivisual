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

module powerbi.extensibility.visual.simpleKPI8834183003554B1586236E8CAC1ADBE2  {
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
                debugger;
                data.value.displayUnits = tS.displayUnitsForValue != 0 ? tS.displayUnitsForValue : tS.displayUnits;
                if (data.target != null) {
                    data.target.displayUnits = tS.displayUnitsForTarget != 0 ? tS.displayUnitsForTarget : tS.displayUnits;
                }

                for (var i = 0; i < data.tooltipsData.length; i++) {
                    data.tooltipsData[i].displayUnits = this.settings.textSettings.displayUnits;
                }                

                //we need to derive the backing rectangle colour
                var statusBarColor = this.settings.colorSettings.equalToColor;
                var statusFontColor = this.settings.colorSettings.textEqualToColor;

                if (data.target != null) {
                    if (data.value.value > data.target.value) {
                        statusBarColor = this.settings.colorSettings.greaterThanColor
                        statusFontColor = this.settings.colorSettings.textGreaterThanColor;
                    } 
                    else if (data.value.value < data.target.value) {
                        statusBarColor = this.settings.colorSettings.lessThanColor;
                        statusFontColor = this.settings.colorSettings.textLessThanColor;
                    }
                } else {
                    statusFontColor = this.settings.colorSettings.targetNotDefinedTextColor;
                }

                //Let's derive some of the sizing
                var svgWidth = parseInt(this.svg.style("width"))
                var svgHeight = parseInt(this.svg.style("height"))

                if (data.target != null) {
                    this.rectangleBackingElement .append("rect")
                                                .classed("rectBacking",true)
                                                .attr("width","100%")
                                                .attr("height","100%")
                                                .style("fill", statusBarColor);
                }
                
                this.metricTextElement  .selectAll(".metricText")
                                        .data([data])
                                        .enter()
                                        .append("text")
                                        .classed("metricTxt",true) 
                                        .text(data.value.toString(true, true))
                                        .style("font-family","'Segoe UI', 'wf_segoe-ui_normal', helvetica, arial, sans-serif;")
                                        .style("fill", statusFontColor)
                                        .style("font-size","1em");
                
                //now scale the text based on the width / height                
                var txtHeight = this.metricTextElement.node().getBBox().height;
                var txtWidth = this.metricTextElement.node().getBBox().width;

                var i = 2;
                var textAreaHeight = svgHeight * 0.6
                var textAreaWidth = svgWidth * 0.6
                //artifically constrain it to do only 19 loops, so maximum is 19em
                while ((txtHeight <= textAreaHeight && txtWidth <= textAreaWidth) && i < 19) {
                    this.metricTextElement.selectAll(".metricTxt").style("font-size", i + "em");
                    txtHeight = this.metricTextElement.node().getBBox().height;
                    txtWidth = this.metricTextElement.node().getBBox().width;
                    i++;
                }
                //now if either are greater reduce the text size
                if (txtHeight > textAreaHeight || txtWidth > textAreaWidth) {
                    i--;
                    this.metricTextElement.selectAll(".metricTxt").style("font-size", i + "em");
                    txtHeight = this.metricTextElement.node().getBBox().height;
                    txtWidth = this.metricTextElement.node().getBBox().width;
                }
                if (i > 18) {
                    this.metricTextElement.selectAll(".metricTxt").style("font-size", "1em");
                }
                
                var horizontalCenterPoint = svgWidth / 2;
                var x = horizontalCenterPoint - (txtWidth / 2);

                var verticalCenterPoint = svgHeight / 2;
                var y = verticalCenterPoint + (txtHeight / 4);

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
                if (data.target != null) { toolTipDataBegin.push(data.target); }
                var tooltipDataFieldList = toolTipDataBegin.map(function(f) {
                    return { displayName: f.displayName, value: f.toString(true,useDisplayUnits) }
                })

                var percentageFormatter = ValueFormatter.create({ format: "0.00 %;-0.00 %;0.00 %", value: 1, allowFormatBeautification: true });

                if (data.target != null) {
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
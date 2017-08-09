/*
 *  Power BI Visualizations
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
    import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;

    export class VisualSettings extends DataViewObjectsParser {
        public textSettings: textSettings = new textSettings();
        public kpiStyleSettings: kpiStyleSettings = new kpiStyleSettings();
        public colorSettings: colorSettings = new colorSettings();
        public targetSettings: targetSettings = new targetSettings();
        public headerSettings: headerSettings = new headerSettings();
        public headerWhenSmallSettings: headerWhenSmallSettings = new headerWhenSmallSettings();
    }

    export class textSettings {
     // Text Size
      public responsive: boolean = true;
      public percentageOfArea:number = 0.6;
      public fontSize: number = 12;
      public displayUnits: number = 0;
      public displayUnitsForValue: number = 0;
      public displayUnitsForTarget: number = 0;
      public repPositiveGapAsNegativeNumber: boolean = true;
      public showPercentagesOnGaps: boolean = true;
      public ignoreFormattingForTooltips: boolean = false;
    }
    
    export class kpiStyleSettings {
        public style: string = "background";
    }
    export class colorSettings {
      public lessThanColor: string = "#f44336";
      public equalToColor: string = "#4caf50";
      public greaterThanColor: string = "#4caf50";
      public textLessThanColor: string = "#FFFFFF";
      public textEqualToColor: string = "#FFFFFF";
      public textGreaterThanColor: string = "#FFFFFF";
      public targetNotDefinedTextColor: string = "#000000";
    }

    export class targetSettings {
        public showhide:boolean = true;
        public defineTarget: boolean = false;
        public value: number = 0;
    }

    export class headerSettings {
        public show:boolean = false;
        public position:string = "left";
        public alignHorizontal:number = 0;
        public value:string = "";
        public fontSize: number = 18;
    }

    export class headerWhenSmallSettings {
        public show:boolean = false;
        public threshold: number = 100;
        public numberOfCharacters: number = 2;
    }
}

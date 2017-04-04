define(['dojo/_base/declare',
        'jimu/BaseWidget',
        "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.5.0/Chart.js",
        "esri/graphic",
        "esri/graphicsUtils",
        "esri/geometry/Extent",
        "esri/geometry/geometryEngine",
        "esri/SpatialReference",
        "esri/symbols/SimpleFillSymbol",
        "esri/symbols/SimpleLineSymbol",
        "esri/renderers/SimpleRenderer",
        "esri/toolbars/draw",
        "esri/Color",
        "esri/layers/FeatureLayer",
        "esri/layers/layer",
        "dojo/on",
        "dojo/_base/array",
        "dojo/dom",
        "dojo/domReady!"],
    function (declare, BaseWidget, Chart, Graphic, graphicsUtils, Extent, geometryEngine, SpatialReference, SimpleFillSymbol, SimpleLineSymbol, SimpleRenderer, Draw, Color, FeatureLayer, Layer, on, array, dom) {
        //To create a widget, you need to derive from BaseWidget.
        return declare([BaseWidget], {
            // Custom widget code goes here

            baseClass: 'jimu-widget-geometrywidget',

            //this property is set by the framework when widget is loaded.
            //name: 'CustomWidget',


            //methods to communication with app container:

            // postCreate: function() {
            //   this.inherited(arguments);
            //   console.log('postCreate');
            // },

            startup: function () {
                this.inherited(arguments);
                this.mapIdNode.innerHTML = 'map id:' + this.map.id;
                this.createLayers.bind(this);
                this.createLayers();
            },

            createLayers: function () {
                var map = this.map;
                var buffOpt = this.buffOpt;
                var navOpt = this.navOpt;
                var drawOpt = this.drawOpt;
                var pvtPer = this.privatePer;
                var pubPer = this.publicPer;

                var landLyr, utahLyr, pieChart, buffGeom;
                var landUrl = "http://services.arcgis.com/ue9rwulIoeLEI9bj/arcgis/rest/services/Wilderness_BLMWSAs/FeatureServer/0";
                var statesUrl = "http://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/3";

                landLyr = new esri.layers.FeatureLayer(landUrl);
                utahLyr = new esri.layers.FeatureLayer(statesUrl, {
                    definitionExpression: "STATE_NAME = 'Utah'",
                    opacity: 0
                });


                var pvtRenderer = new esri.renderer.SimpleRenderer(new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID), new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new esri.Color("#ff0000")), new esri.Color("#ff0000"));

                landLyr.setRenderer(pvtRenderer);

                map.addLayers([utahLyr, landLyr]);


                //Layer symbology
                var buffSym = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NULL, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new esri.Color([255, 255, 255, 1]), 3), null);
                var buffSymFade = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NULL, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new esri.Color([255, 255, 255, 0.4]), 10), null);
                var privateSym = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new esri.Color([0, 0, 0]), 0), new esri.Color([138, 138, 138, 0.7]));
                var publicSym = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new esri.Color([0, 0, 0]), 0), new esri.Color([161, 255, 156, 0.7]));
                var update = 0;
                //map event handlers

                // on(map, 'click', createBuffer(buffOpt, drawOpt, map));
                on(map, 'click', function (evt) {
                    // console.log('hello', evt, buffOpt, drawOpt, map);
                    createBuffer(evt, buffOpt, drawOpt, map)
                });
                on(map, 'mouse-drag', function (evt) {
                    createBuffer(evt, buffOpt, drawOpt, map)
                });
                on(map, 'update-end', function () {
                    update++;
                    if (update === 1) {
                        console.log('map in updated end', map);
                        var fakeEvt = {};
                        fakeEvt.mapPoint = map.extent.getCenter();
                        createBuffer(fakeEvt, buffOpt, drawOpt, map);
                    }
                });
                var drawPolygon = new Draw(map, {showTooltips: true});


                function createBuffer(evt, buffOpt, drawOpt, map) {
                    // console.log('creating buffer map: ', map);
                    if (buffOpt.checked) {
                        map.graphics.clear();
                        map.disableMapNavigation();
                        var centerPt = evt.mapPoint;
                        //Get buffer of map click point
                        buffGeom = geometryEngine.geodesicBuffer(centerPt, 10, "miles");

                        //check if buffer is completely within Utah
                        var within = geometryEngine.within(buffGeom, utahLyr.graphics[0].geometry);
                        //check if buffer overlaps Utah
                        var overlaps = geometryEngine.overlaps(buffGeom, utahLyr.graphics[0].geometry);

                        if (!within && overlaps) {
                            //If buffer overlaps Utah, then only get the portion within Utah
                            buffGeom = geometryEngine.intersect(buffGeom, utahLyr.graphics[0].geometry);
                        }
                        if (!within && !overlaps) {
                            //If buffer is completely outside Utah, then warn the user
                            console.log("outside of utah!");
                            return;
                        }
                        map.graphics.add(new Graphic(buffGeom, buffSymFade));
                        var privateLand = getPrivateLand(buffGeom);
                        var publicLand = getPublicLand(buffGeom, privateLand.geom);
                        generateChart(privateLand, publicLand);
                    }
                    // if (!drawOpt.checked) {
                    //     map.graphics.clear();
                    // }
                    else {
                        return;
                    }
                }

                function getPrivateLand(geom) {
                    var privateLandGraphics = landLyr.graphics;
                    var privateLandGeoms = graphicsUtils.getGeometries(privateLandGraphics);
                    //Only work with private land that intersects the buffer (essentially a select by location)
                    var priInBuffer = array.filter(privateLandGeoms, function (item, i) {
                        return geometryEngine.intersects(item, geom);
                    });
                    if (priInBuffer.length > 0) {
                        //merge all the private land features that intersects buffer into one feature

                        var privateUnion = geometryEngine.union(priInBuffer);
                        //get intersection of buffer and merge (cookie cutter)
                        var privateIntersect = geometryEngine.intersect(privateUnion, geom);
                        return {
                            geom: privateIntersect,
                            area: calcArea(privateIntersect)  //get the area of the private land
                        }
                    }
                    else {
                        return {
                            geom: null,
                            area: 0
                        }
                    }
                }

                function getPublicLand(buffer, privateLand) {
                    if (privateLand) {
                        //most land that isn't private is public (city, county, state, or federally owned)
                        var publicLand = geometryEngine.difference(buffer, privateLand);
                        return {
                            geom: publicLand,
                            area: calcArea(publicLand)
                        }
                    } else {
                        return {
                            geom: buffer,
                            area: calcArea(buffer)
                        }
                    }
                }

                function calcArea(geom) {
                    return (Math.round(geometryEngine.geodesicArea(geom, "square-miles") * 100) / 100);
                }

                function generateChart(pvtData, pubData) {
                    if (pvtData.geom)
                        map.graphics.add(new Graphic(pvtData.geom, privateSym));
                    if (pubData.geom)
                        map.graphics.add(new Graphic(pubData.geom, publicSym));
                    if (!drawOpt.checked)
                        map.graphics.add(new Graphic(buffGeom, buffSym));
                    if (!pieChart) {
                        var data = {
                            labels: ["Private (sq mi)", "Government (sq mi)"],
                            datasets: [
                                {
                                    data: [pvtData.area, pubData.area],
                                    backgroundColor: [
                                        "#8A8A8A",
                                        "#99F095"
                                    ],
                                    hoverBackgroundColor: [
                                        "#B5B5B5",
                                        "#A1FF9C"
                                    ]
                                }

                            ]
                        };

                        var opts = {
                            segmentShowStroke: true,
                            segmentStrokeColor: "#fff",
                            segmentStrokeWidth: 2,
                            percentageInnerCutout: 0,
                            animationSteps: 100,
                            animationEasing: "easeOutBounce",
                            animateRotate: true,
                            animateScale: false
                        };

                        var ctx = document.getElementById("myChart").getContext("2d");
                        pieChart = new Chart(ctx, {type: 'pie', data: data, options: opts});
                        pvtPer.innerHTML = Math.round(10000 * pvtData.area / (pubData.area + pvtData.area)) / 100 + "%";
                        pubPer.innerHTML = Math.round(10000 * pubData.area / (pubData.area + pvtData.area)) / 100 + "%";
                    }
                    else {
                        pieChart.data.datasets[0].data = [pvtData.area, pubData.area];
                        pvtPer.innerHTML = Math.round(10000 * pvtData.area / (pubData.area + pvtData.area)) / 100 + "%";
                        pubPer.innerHTML = Math.round(10000 * pubData.area / (pubData.area + pvtData.area)) / 100 + "%";
                        pieChart.update();
                    }
                }

                on(this.buffOpt, "click", function (evt) {
                    map.graphics.clear();
                    if (buffOpt.checked) {
                        map.disableMapNavigation();
                        drawPolygon.deactivate();
                    }
                });

                on(this.navOpt, "click", function (evt) {
                    map.graphics.clear();
                    if (navOpt.checked) {
                        map.enableMapNavigation();
                        drawPolygon.deactivate();
                    }
                });

                on(this.drawOpt, "click", function (evt) {
                    map.graphics.clear();
                    if (drawOpt.checked) {
                        drawPolygon.activate(Draw.POLYGON);
                    }
                });

                drawPolygon.on("draw-complete", function (evt) {
                    drawPolygon.deactivate();
                    var symbol = new SimpleFillSymbol();
                    var graphic = new Graphic(evt.geometry, symbol);
                    map.graphics.add(graphic);

                    var geom = evt.geometry;
                    if (geom.rings[0].length <= 3) {
                        alert("Polygon must have at least three vertices.");
                        return;
                    }

                    var within = geometryEngine.within(geom, utahLyr.graphics[0].geometry);
                    //check if buffer overlaps Utah
                    var overlaps = geometryEngine.overlaps(geom, utahLyr.graphics[0].geometry);
                    if (!within && overlaps) {
                        //If buffer overlaps Utah, then only get the portion within Utah
                        geom = geometryEngine.intersect(geom, utahLyr.graphics[0].geometry);
                    }
                    if (!within && !overlaps) {
                        //If buffer is completely outside Utah, then warn the user
                        console.log("outside of utah!");
                        return;
                    }
                    var privateLand = getPrivateLand(geom);
                    var publicLand = getPublicLand(geom, privateLand.geom);
                    generateChart(privateLand, publicLand);
                });

                var loading = dom.byId("loadingImg");

                function showLoading() {
                    esri.show(loading);
                }

                function hideLoading(error) {
                    esri.hide(loading);
                }

                hideLoading();

            }

            // onOpen: function(){
            //   console.log('onOpen');
            // },

            // onClose: function(){
            //   console.log('onClose');
            // },

            // onMinimize: function(){
            //   console.log('onMinimize');
            // },

            // onMaximize: function(){
            //   console.log('onMaximize');
            // },

            // onSignIn: function(credential){
            //   /* jshint unused:false*/
            //   console.log('onSignIn');
            // },

            // onSignOut: function(){
            //   console.log('onSignOut');
            // }

            // onPositionChange: function(){
            //   console.log('onPositionChange');
            // },

            // resize: function(){
            //   console.log('resize');
            // }

            //methods to communication between widgets:

        });
    });
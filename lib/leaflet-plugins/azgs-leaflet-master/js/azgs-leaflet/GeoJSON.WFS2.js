L.GeoJSON.WFS2 = L.GeoJSON.extend({
	initialize: function(serviceUrl, options) {
		options = options || {};
		
		var featureType = options.featureType; // required
		
		L.GeoJSON.prototype.initialize.call(this, null, options);
		
		// JL: Added proxy here.
		if (options.proxy || L.GeoJSON.WFS2.proxy) {
			this.proxy = options.proxy || L.GeoJSON.WFS2.proxy || null;
		}
		
		var wfsVersion = options.wfsVersion || "1.1.0";
		this.getFeatureUrl = serviceUrl;   //+ "?request=GetFeature&outputformat=json&version=" + wfsVersion + "&typeName=" + featureType;
		
		this.params = {
				typeName: featureType,
				service: "WFS",
				version: wfsVersion,
				request: "GetFeature",
				srsName: "EPSG:4326",
				format: "text/geojson",
				maxFeatures: 10000,
				outputFormat: "json"
		};
		
//		if (options.filter && options.filter instanceof DateFilter) { this.getFeatureUrl += "&CQL_FILTER=" + options.filter.cql; }
		
		
		this.on("featureparse", function(e) {
			if (e.geometryType != 'Point' && e.geometryType != 'MultiPoint') {
				if (options.style) {
					e.layer._originalStyle = options.style;
					e.layer.setStyle(options.style);
				} else if (options.filteredStyles) {
					var fld = options.filteredStyles.propName;
					var itemVal = e.properties[fld];
					var style = L.Util.extend({}, options.filteredStyles['default'], options.filteredStyles.styles[itemVal]); 
					e.layer._originalStyle = style;
					e.layer.setStyle(style);
				}
			}
			if (options.popupObj && options.popupOptions) {
				e.layer.on("click", function(evt) {
					e.layer._map.openPopup(options.popupObj.generatePopup(e, options.popupOptions));
					if (options.popupFn) { options.popupFn(e); }
				});			
			}
			else if (options.popupFld && e.properties.hasOwnProperty(options.popupFld)) {
				e.layer.bindPopup(e.properties[options.popupFld], { maxWidth: 600 });
			}
			if (options.hoverObj || options.hoverFld) {
				e.layer.on("mouseover", function(evt) {
					hoverContent = options.hoverObj ? options.hoverObj.generateContent(e) : e.properties[options.hoverFld] || "Invalid field name" ;
					hoverPoint = e.layer._map.latLngToContainerPoint(evt.target._latlng);
					e.layer._hoverControl = new L.Control.Hover(hoverPoint, hoverContent);
					e.layer._map.addControl(e.layer._hoverControl);	
				});
				e.layer.on("mouseout", function(evt) {
					e.layer._map.removeControl(e.layer._hoverControl);
				});
			}
			if (options.hoverColor) {
				e.layer.on("mouseover", function(evt) {
					var hoverStyle = L.Util.extend({}, e.layer._originalStyle, { stroke: true, color: options.hoverColor, weight: 3 });
					e.layer.setStyle(hoverStyle);
				});
				e.layer.on("mouseout", function(evt) {
					e.layer.setStyle(e.layer._originalStyle);
				});
			}
			if (e.layer instanceof L.Marker.AttributeFilter) { e.layer.setIcon(e); }
		});
	},
	
	onAdd: function(map) {
		L.LayerGroup.prototype.onAdd.call(this, map);
		var self = this;
		this._refresh();
		this._map.on("zoomend dragend", function() {
			self._refresh();
		});
	},
	
	_refresh: function() {
		var self = this;
		if (!this._map) {
			return false;
		}
		var bounds = this._map.getBounds();
		this.getFeature(bounds, function() {
			self.clearLayers();
			self.addData(self.jsonData);
		});
	},
	
	/**
	 * Code borrowed from OpenLayers 2.13.1
	 * @param bounds {Leaflet bounds}
	 * @param reverseAxisOrder {Boolean}
	 * @returns {String}
	 */
	_boundsToBbox: function(bounds, reverseAxisOrder) {
    	var decimal = 6; 
        var mult = Math.pow(10, decimal);
        var xmin = Math.round(bounds.getWest() * mult) / mult;
        var ymin = Math.round(bounds.getSouth() * mult) / mult;
        var xmax = Math.round(bounds.getEast() * mult) / mult;
        var ymax = Math.round(bounds.getNorth() * mult) / mult;
        if (reverseAxisOrder === true) {
            return ymin + "," + xmin + "," + ymax + "," + xmax;
        } else {
            return xmin + "," + ymin + "," + xmax + "," + ymax;
        }
    },
    
    _projectBounds: function(bounds, fromEpsg, toEpsg) {
    	this.centerLonLat = null;
    	
    	var sw = proj4(fromEpsg, toEpsg, [bounds.getWest(), bounds.getSouth()]),
    		se = proj4(fromEpsg, toEpsg, [bounds.getEast(), bounds.getSouth()]),
    		ne = proj4(fromEpsg, toEpsg, [bounds.getEast(), bounds.getNorth()]),
    		nw = proj4(fromEpsg, toEpsg, [bounds.getWest(), bounds.getNorth()]);

        var left   = Math.min(sw[0], se[0]);
        var bottom = Math.min(sw[1], se[1]);
        var right  = Math.max(nw[0], ne[0]);
        var top    = Math.max(nw[1], ne[1]);
        
        bounds = L.latLngBounds(L.latLng(bottom, left), L.latLng(top, right));
        return bounds;
    },
	
	getFeature: function(bounds, callback) {
		var that = this;
		var version = "1.1.0";
		
		if (bounds) {
			// Make a filter so that we only fetch features within current viewport.
			
			if (this.options.inputCrs) {
				bounds = this._projectBounds(bounds, "EPSG:4326", this.options.inputCrs);
				this.params.srsName = this.options.inputCrs;
			}
			this.params.bbox = this._boundsToBbox(bounds, this.options.reverseAxis);
		}
		
		var url = this.proxy ? this.proxy + encodeURIComponent(this.getFeatureUrl) : this.getFeatureUrl;
		$.ajax({
			url: url,
			type: "POST",
			data: this.params,
			context: this,
			success: function(response) {
				if (response.type && response.type == "FeatureCollection") {
					that.jsonData = response;
					that.toGeographicCoords(that.options.inputCrs || "EPSG:3857");
					callback();
					this.fire("load", {layer: this});
				}				
			},
			dataType: "json"
		});
	},
	
	swapCoords: function(coords) {
		coords = [coords[1], coords[0]];
		return coords;
	},
	
	toGeographicCoords: function(inputCrs) {
		function projectPoint(coordinates /*[easting, northing]*/, inputCrs) {
			var source = inputCrs || "EPSG:3857",
				dest = "EPSG:4326",
				x = coordinates[0], 
				y = coordinates[1];
			return proj4(source, dest, [x, y]); // [easting, northing]
		};
		
		var coords, projectedCoords, i, p, geom,
			features = this.jsonData.features || [];
		for (i=0,len=features.length; i<len; i++) {
			geom = features[i].geometry;
			switch (geom.type) {
				case "Point":
					coords = geom.coordinates;
					if (!this.options.reverseAxis) {
						coords = this.swapCoords(coords);
					}
					projectedCoords = projectPoint(coords, inputCrs);
					geom.coordinates = projectedCoords;
					break;
				case "MultiPoint":
					for (p=0, len2=geom.coordinates.length; p<len2; p++) {
						coords = geom.coordinates[p];
//						if (this.options.reverseAxis) {
//							coords = this.swapCoords(coords);
//						}
						projectedCoords = projectPoint(coords, inputCrs);
						features[i].geometry.coordinates[p] = projectedCoords;
					}
					break;
				case "MultiLineString":
					var coordsArr = [], pp, ii, newCoords = [];
					for (p=0, len2=geom.coordinates.length; p<len2; p++) {
						coordsArr = geom.coordinates[p];
						for (pp=0, len3=coordsArr.length; pp<len3; pp++) {
							coords = coordsArr[pp];
							if (!this.options.reverseAxis) {
								coords = this.swapCoords( coords );								
							}
							projectedCoords = projectPoint(coords, inputCrs);
							coordsArr[pp] = projectedCoords;
						}
						geom.coordinates[p] = coordsArr; // needed?
					}
					break;
			}
		}
	}
});
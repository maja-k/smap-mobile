L.Control.Template = L.Control.extend({
	options: {
		position: 'bottomright' // just an example
	},
	
	_lang: {
		"sv": {
			exampleLabel: "Ett exempel"
		},
		"en": {
			exampleLabel: "An example"
		}
	},
	
	_setLang: function(langCode) {
		langCode = langCode || smap.config.langCode || navigator.language.split("-")[0] || "en";
		if (this._lang) {
			this.lang = this._lang ? this._lang[langCode] : null;			
		}
	},

	initialize: function(options) {
		L.setOptions(this, options);
		this._setLang(options.langCode);
	},

	onAdd: function(map) {
		this.map = map;
		
		this._container = L.DomUtil.create('div', 'leaflet-control-template'); // second parameter is class name
		L.DomEvent.disableClickPropagation(this._container);
		
		// Use $ prefix for all jQuery objects to make it easier to sort out all
		// jQuery dependencies when sharing the code in future.
		this.$container = $(this._container);
		
		// Binding an event (example)
		// this.map.on('layeradd', this._onLayerAdd, this).on('layerremove', this._onLayerRemove, this);

		return this._container;
	},

	onRemove: function(map) {
		// Do everything "opposite" of onAdd – e.g. unbind events and destroy things
		// map.off('layeradd', this._onLayerAdd).off('layerremove', this._onLayerRemove);
	}
});


// Do something when the map initializes
//L.Map.addInitHook(function () {
//	if (this.options.attributionControl) {
//		this.attributionControl = (new L.Control.Template()).addTo(this);
//	}
//});


/*
 * This code just makes removes the need for
 * using "new" when instantiating the class. It
 * is a Leaflet convention and should be there.
 */
L.control.template = function (options) {
	return new L.Control.Template(options);
};
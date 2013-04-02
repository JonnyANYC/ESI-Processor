var EsiProcessorOverlay = {

    enabledisable: function( event ) {
        // TODO: Define constants somewhere for the three enabled states.
        var enabled = Application.prefs.get("extensions.esi_processor.enabled").value;
        if ( enabled == "off" ) { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "session");
        } else { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "off");
        }        
    },

    configure: function( event ) {

        var params;

        if (null == this._preferencesWindow || this._preferencesWindow.closed) {
            let instantApply =
              Application.prefs.get("browser.preferences.instantApply");
            let features =
              "chrome,resizable=yes,titlebar,toolbar,centerscreen" +
              (instantApply.value ? ",dialog=no" : ",modal");

            this._preferencesWindow =
              window.openDialog(
                "chrome://esi_processor/content/preferences/preferences.xul",
                "", features);
        }

        this._preferencesWindow.focus();
    },

};


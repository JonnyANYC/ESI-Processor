var EsiProcessorOverlay = {

    enabledisable: function( event ) {
        // TODO: initialize just once when enabled. 
        // See: https://developer.mozilla.org/en-US/docs/Toolkit_API/extIPreference 
        
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

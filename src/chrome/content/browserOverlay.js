var EsiProcessorOverlay = {

    enabledisable: function( event ) {
        // FIXME: Only updates the current window!
        // Consider removing this menu option if it's not super-easy to update the menu automatically in all windows.
        // TODO: Define constants somewhere for the three enabled states.
        var enabled = Application.prefs.get("extensions.esi_processor.enabled").value;
        if ( enabled == "off" ) { 
            // TODO: Extract method.
            Application.prefs.setValue("extensions.esi_processor.enabled", "session");
            var menuItem = event.target;
            menuItem.setAttribute("checked", "true");
        } else { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "off");
            var menuItem = event.target;
            menuItem.setAttribute("checked", "false");
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


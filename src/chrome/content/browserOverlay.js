var EsiProcessorOverlay = {

    enabledisable: function( event ) {
        // TODO: Define constants somewhere for the three enabled states.
        var enabled = Application.prefs.get("extensions.esi_processor.enabled").value;
        if ( enabled == "off" ) { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "session");
            this._toggleMenus( true );
        } else { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "off");
            this._toggleMenus( false );
        }        
    },


    _toggleMenus: function( enable ) {

        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
            .getService(Components.interfaces.nsIWindowMediator);
        var enumerator = wm.getEnumerator("navigator:browser");

        while(enumerator.hasMoreElements()) {
            var win = enumerator.getNext();
            var menuItem1 = win.document.getElementById("esi_processor-enabledisable");
            menuItem1.setAttribute("checked", enable? "true" : "false");
            var menuItem2 = win.document.getElementById("esi_processor-enabledisable-2");
            menuItem2.setAttribute("checked", enable? "true" : "false");
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


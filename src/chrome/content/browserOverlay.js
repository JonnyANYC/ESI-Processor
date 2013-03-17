// Helper functions
if (typeof Cc == "undefined") {
    var Cc = Components.classes;
    var Ci = Components.interfaces;
};
if (typeof CCIN == "undefined") {
    function CCIN(cName, ifaceName){
        return Cc[cName].createInstance(Ci[ifaceName]);
    }
};

var EsiProcessorOverlay = {

    enabledisable: function( event ) {
        // TODO: initialize just once when enabled. 
        // TODO: Consider using Application.prefs.lock(true) to prevent other code from changing enable/disable flag
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

            let hostList = Application.prefs.get("extensions.esi_processor.hostlist").value.split(",", 25);
            params = { 
                inn: {
                    enabled: true,
                    hostList: hostList
                }, 
                out: null
            };

            this._preferencesWindow =
              window.openDialog(
                "chrome://esi_processor/content/configure.xul",
                "", features, params);
        }

        this._preferencesWindow.focus();

        if (params && params.out) {
            // FIXME: Implement an enable/disable feature and let users toggle it here.
            // FIXME: When disabled, also consider disabling the listener on the hostlist pref, and any other shutdown / sleep actions.
            Application.prefs.setValue(
                "extensions.esi_processor.hostlist", 
                // this._sanitizeHostList( params.out.hostList.split("\n", 25) ).join(",") );
                params.out.hostList.split("\n", 25).join(",") );
            Components.utils.reportError("Configure dialog saved. new host list: " + params.out.hostList);
        } else {
            Components.utils.reportError("Configure dialog cancelled.");
        }
    },

};

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


// main() for the script. Wrap in anon function to avoid name-clobbering or namespacing.
(function() {

    EsiProcessorObserver.enabledisable();

    // FIXME: Move to an enable() method. And remove the observer when the extension is disabled.
    var observerService = Cc["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

    observerService.addObserver(EsiProcessorObserver,
        "http-on-examine-response", false);

    var prefService = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefService)
        .getBranch("extensions.esi_processor."); // do we need the branch yet?
    prefService.QueryInterface(Ci.nsIPrefBranch2);
    prefService.addObserver("", EsiProcessorObserver, false);
    prefService.QueryInterface(Ci.nsIPrefBranch);

    window.addEventListener("unload", function(event) { EsiProcessorObserver.shutdown(); }, false);
})();

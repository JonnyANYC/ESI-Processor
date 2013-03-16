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
function dontrunme() {

    var esiProcessorObserver = new EsiProcessorObserver();
    esiProcessorObserver.enabledisable();

    // FIXME: Move to an enable() method. And remove the observer when the extension is disabled.
    var observerService = Cc["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

    observerService.addObserver(esiProcessorObserver,
        "http-on-examine-response", false);

    esiProcessorObserver.prefService = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefService)
        .getBranch("extensions.esi_processor."); // do we need the branch yet?

    // Gecko prior to v13 requires the use of nsIPrefBranch2.
    if (!("addObserver" in esiProcessorObserver.prefService)) { 
        esiProcessorObserver.prefService.QueryInterface(Ci.nsIPrefBranch2);
    }

    esiProcessorObserver.prefService.addObserver("", esiProcessorObserver, false);
    esiProcessorObserver.prefService.QueryInterface(Ci.nsIPrefBranch);

    window.addEventListener("unload", function(event) { esiProcessorObserver.shutdown(); }, false);
}

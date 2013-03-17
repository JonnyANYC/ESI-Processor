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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Components.utils.import("chrome://esi_processor/content/EsiProcessorStreamDecorator.js");

function EsiProcessor() {

    _initialized = false;
    hostList = null;
    numTimesCalled = 0;
    prefService = null;
}

EsiProcessor.prototype = { 

    classDescription: "ESI Processor Observer Javascript XPCOM Component",
    classID:          Components.ID("{12345678-1234-4321-1234-1234567890AB}"),
    contractID:       "@angelajonhome.com/esiprocessor;1",

    startup: function() {

        // TODO Consider moving all of this to the constuctor, as long as the observers are available at that point.

        if ( this._initialized )  { 
            // TODO: change to a warning, or accept repeated calls to this as usual process.
            Components.utils.reportError('WARNING: already initialized.');
            return;
        }

        // TODO: Consider using FUEL if it's easier to be consistent with the overlay: https://developer.mozilla.org/en-US/docs/Toolkit_API/FUEL#XPCOM 
        this.prefService = Cc["@mozilla.org/preferences-service;1"]
            .getService(Ci.nsIPrefService)
            .getBranch("extensions.esi_processor."); // do we need the branch yet?

        // Gecko prior to v13 requires the use of nsIPrefBranch2.
        if (!("addObserver" in this.prefService)) { 
            this.prefService.QueryInterface(Ci.nsIPrefBranch2);
        }

        this.prefService.addObserver("", this, false);
        this.prefService.QueryInterface(Ci.nsIPrefBranch);

        // FIXME The following line throws an error if the pref doesn't exist. 
        // Do I really need to wrap this in a try...catch block?
        var hostListPref = this.prefService.getCharPref("hostlist");
        if ( hostListPref != null && hostListPref.length > 0 )
        {
            this.hostList = this._sanitizeHostList( hostListPref.split(",", 25) );
        } else
        {
            this.hostList = new Array(0);
        }

        var os = Cc["@mozilla.org/observer-service;1"]
            .getService(Ci.nsIObserverService);

        os.addObserver(this, "http-on-examine-response", false);

        this._initialized = true;
    },

    shutdown: function() {
        // FIXME: Remove any remaining observers on window shutdown.
        var observerService = Cc["@mozilla.org/observer-service;1"]
            .getService(Ci.nsIObserverService);

        observerService.removeObserver(this, "http-on-examine-response");
        this.prefService.removeObserver("", this);
    },


    observe: function(aSubject, aTopic, aData) {

        if (aTopic == "http-on-examine-response") {

            try {
                // FIXME check for host match here
                // FIXME need to identify cached pages ([xpconnect wrapped nsIURI]) and process them too
                // TODO: Do I need to check for chrome:// url and skip it?
                // TODO: Consider skipping file: requests. Or make it a config option. First test if I can make Ajax requests from a file: page.
                // TODO: check for all other legal protocols supported by Firefox.

                var channel = aSubject.QueryInterface(Ci.nsIHttpChannel);

                if (channel.URI && channel.URI.scheme && channel.responseStatus && channel.originalURI   
                    && (channel.URI.scheme == "http" || channel.URI.scheme == "file")
                    && (channel.responseStatus != 301 && channel.responseStatus < 500)
                    && (channel.originalURI.path != "/favicon.ico") 
                    && this.isHostNameMatch( channel.URI.host ) ) { 

                    // TODO Also handle some or all HTTP error codes as valid responses. But skip 301s at least.
                    // TODO Skip sensitive URLs, such as to Firefox update servers, browser XUL, etc.
                    // TODO Consider removing cookies, since they won't be set on a proper ESI processor.
                    Components.utils.reportError("host name matched for " + channel.URI.path + " and resp status " + channel.responseStatus);
                    const EsiProcessorStreamDecorator = Components.Constructor("@angelajonhome.com/esiprocessorstreamdecorator;1");
                    var esiProcessorStreamDecorator = EsiProcessorStreamDecorator().wrappedJSObject;
                    channel.QueryInterface(Ci.nsITraceableChannel);
                    esiProcessorStreamDecorator.originalListener = channel.setNewListener(esiProcessorStreamDecorator);
                } 
                // DEBUG
                else { 
                    Components.utils.reportError("skipping for response " + channel.responseStatus + " from URL " + channel.URI.host + channel.URI.path );
                }

            } catch (e) {
                Components.utils.reportError("\nEsiProcessor error: \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            }

        } else if (aTopic == "nsPref:changed") {

            // FIXME: instantiate the prefs service, then fetch the latest data.
            // TODO: Should I try to ignore this call if the current object is what triggered the update?
            Components.utils.reportError("Prefs were updated somewhere. Noticed by instance# " + this._rndNum);
            Components.utils.reportError("New prefs name: " + aData + " and value: " + aSubject.getCharPref(aData) );

            this.hostList = this._sanitizeHostList( aSubject.getCharPref(aData).split(",", 25) );
            Components.utils.reportError("hostlist now: " + this.hostList);

            // FIXME: Check for disable, and if so, call: observerService.removeObserver(EsiProcessor, "http-on-examine-response");


        } else if (aTopic == "profile-after-change") {

            this.startup();

        } else {
            Components.utils.reportError("Received unexpected observer event for: " + aTopic);
        }
    },
    
    QueryInterface: function(aIID){
        if (aIID.equals(Ci.nsIObserver) || aIID.equals(Ci.nsISupports)) {
            return this;
        }

        // DEBUG This function apparently isn't needed to observe preferences changes. Remove this eventually.
        if (aIID.equals(Ci.nsIPrefBranch2)) { 
            Components.utils.reportError("Received interface query for branch2.");
        } else if (aIID.equals(Ci.nsIPrefService)) { 
            Components.utils.reportError("Received interface query for prefs svc.");
        } else if (aIID.equals(Ci.nsIClassInfo)) { 
            // No-op; this gets called once for the nsIClassInfo interface.
        } else { 
            Components.utils.reportError("Received unexpected interface query for :" + aIID);
        }

        throw Components.results.NS_NOINTERFACE;
        
    },

    isHostNameMatch: function( hostName ) {
        var hostNameLowerCase = hostName.toLocaleLowerCase();

        for ( var hl = 0; hl < this.hostList.length; hl++ )
        {
            if ( hostNameLowerCase.indexOf( this.hostList[hl] ) != -1 )
            {
                return true;
            }
        }

        return false;
    }, 


    urlHostMatchPattern: /^http:\/\/([\w\.-]+)/i,

    extractHostNameFromUrl: function( url ) {
        var urlHostMatch = url.match( this.urlHostMatchPattern );
        return urlHostMatch ? urlHostMatch[1] : null;
    },

    urlDomainMatchPattern: /^http:\/\/([\w-]\.)+([\w-])/i,

    extractDomainFromUrl: function( url ) {
        var urlDomainMatch = url.match( this.urlDomainMatchPattern );
        
        var domain = null;
        
        var matchLength = urlDomainMatch.length;
        
        if ( matchLength )
        {
            domain = urlDomainMatch[ matchLength-1 ] + urlDomainMatch[ matchLength ] 
        }
        return domain;
    },

    allowedHostPattern: /^[\w-]*\.*[\w-]+\.[\w-]+$/,

    _sanitizeHostList: function( dirtyHostList ) {

        var hostList = new Array();
        // A host entry is allowed if it contains alphanumerics, periods, and dashes.
        // FIXME: This needs to support Unicode host names.
        // FIXME: Reject host lists that are dangerously short, such as e.com, etc.
        // FIXME: Update the pattern to ignore leading and trailing spaces. AFAIK, JS doesn't have a trim() method.
        // FIXME: If possible, reject host entries that include an underscore, which is included in \w.

Components.utils.reportError("in host list length: " + dirtyHostList.length + " and list: " + dirtyHostList);
        for ( var hl = 0; hl < dirtyHostList.length; hl++)
        {
            if ( dirtyHostList[hl] == null || dirtyHostList[hl].length == 0  )  continue;
            if ( dirtyHostList[hl].toLocaleLowerCase() == 'localhost' || 
                 this.allowedHostPattern.test( dirtyHostList[hl] ) )
                { hostList.push( dirtyHostList[hl].toLocaleLowerCase() );  }
        }

        return hostList;
    },

};

var components = [EsiProcessor];
if ("generateNSGetFactory" in XPCOMUtils)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);  // Firefox 4.0 and higher
else
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);    // Firefox 3.x




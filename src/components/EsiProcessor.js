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

function EsiProcessor() {

    _initialized = false;
    hostList = null;
    numTimesCalled = 0;
    prefService = null;
    listening = false;
}

// irc irc.mozilla.org or irc://irc.mozilla.org/mozilla; /join #developers; /msg firebot uuid
EsiProcessor.prototype = { 

    classDescription: "ESI Processor Javascript XPCOM Component",
    classID:          Components.ID("{df654bc7-b3b5-49af-bc6d-355841e506ad}"),
    contractID:       "@angelajonhome.com/esiprocessor;1",

    startup: function() {

        // TODO Consider moving all of this to the constuctor, as long as the observers are available at that point.

        if ( this._initialized )  { 
            // TODO: change to a warning, or accept repeated calls to this as usual process.
            Components.utils.reportError("WARNING: already initialized.");
            return;
        }

        // TODO: Consider using FUEL if it's easier to be consistent with the overlay: https://developer.mozilla.org/en-US/docs/Toolkit_API/FUEL#XPCOM 
        this.prefService = Cc["@mozilla.org/preferences-service;1"]
            .getService(Ci.nsIPrefService)
            .getBranch("extensions.esi_processor."); // do we need the branch yet?

        // FIXME The following line throws an error if the pref doesn't exist. 
        // Do I really need to wrap this in a try...catch block?
        var hostListPref = this.prefService.getCharPref("hostlist");
        if ( hostListPref != null && hostListPref.length > 0 )
        {
            this.hostList = this._sanitizeHostList( hostListPref.split("\n", 25) );
        } else
        {
            this.hostList = new Array(0);
        }

        var enabledPref = this.prefService.getCharPref("enabled");
        if ( enabledPref != null && enabledPref == "permanent" ) { 

            var os = Cc["@mozilla.org/observer-service;1"]
                .getService(Ci.nsIObserverService);

            os.addObserver(this, "http-on-examine-response", false);
            this.listening = true;

        } else if ( enabledPref != null && enabledPref == "off" ) { 
            // Do nothing.
        } else { 
            // Handle cases where the pref is set to "session", or anything else, or is null.
            this.prefService.setCharPref("enabled", "off");
        }

        // Gecko prior to v13 requires the use of nsIPrefBranch2.
        if (!("addObserver" in this.prefService)) { 
            this.prefService.QueryInterface(Ci.nsIPrefBranch2);
        }

        this.prefService.addObserver("", this, false);
        this.prefService.QueryInterface(Ci.nsIPrefBranch);

        this._initialized = true;
    },


    shutdown: function() {
        // FIXME: Remove any remaining observers on window shutdown, and nullify all member variables.
        var observerService = Cc["@mozilla.org/observer-service;1"]
            .getService(Ci.nsIObserverService);

        observerService.removeObserver(this, "http-on-examine-response");
        this.listening = false;
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
                // TODO: Confirm the rqeuest is fired from a viewable browser window. See: https://developer.mozilla.org/en-US/docs/Code_snippets/Tabbed_browser#Getting_the_browser_that_fires_the_http-on-modify-request_notification

                var channel = aSubject.QueryInterface(Ci.nsIHttpChannel);

                if (channel.URI && channel.URI.scheme && channel.responseStatus && channel.originalURI   
                    && (channel.URI.scheme == "http" || channel.URI.scheme == "file")
                    && (channel.responseStatus != 301 && channel.responseStatus < 500)
                    && (channel.originalURI.path != "/favicon.ico") 
                    && this.isHostNameMatch( channel.URI.host ) ) { 

                    // TODO Also handle some or all HTTP error codes as valid responses. But skip 301s at least.
                    // TODO Skip sensitive URLs, such as to Firefox update servers, browser XUL, etc.
                    // TODO Consider removing cookies, since they won't be set on a proper ESI processor.
                    const EsiProcessorStreamDecorator = Components.Constructor("@angelajonhome.com/esiprocessorstreamdecorator;1");
                    var esiProcessorStreamDecorator = EsiProcessorStreamDecorator().wrappedJSObject;
                    channel.QueryInterface(Ci.nsITraceableChannel);
                    esiProcessorStreamDecorator.originalListener = channel.setNewListener(esiProcessorStreamDecorator);
                } 
                // DEBUG
                else { 
                }

            } catch (e) {
                Components.utils.reportError("\nEsiProcessor error: \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            }

        } else if (aTopic == "nsPref:changed") {

            // FIXME: instantiate the prefs service, then fetch the latest data.
            // TODO: Should I try to ignore this call if the current object is what triggered the update?

            if ( aData == "hostlist" ) { 
                this.hostList = this._sanitizeHostList( aSubject.getCharPref(aData).split("\n", 25) );

            } else if ( aData == "enabled" ) {

                if ( aSubject.getCharPref(aData) == "permanent" 
                    || aSubject.getCharPref(aData) == "session" ) { 

                    if ( !this.listening ) { 
                        var os = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);

                        os.addObserver(this, "http-on-examine-response", false);
                        this.listening = true;

                        this._toggleMenus(true);
                    }
                } else { 

                    if ( this.listening ) { 
                        var observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);

                        observerService.removeObserver(this, "http-on-examine-response");
                        this.listening = false;

                        this._toggleMenus(false);
                    }
                }
            }

        } else if (aTopic == "profile-after-change") {

            this.startup();

        } else {
            Components.utils.reportError("Received unexpected observer event for: " + aTopic);
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


    QueryInterface: function(aIID){
        if (aIID.equals(Ci.nsIObserver) || aIID.equals(Ci.nsISupports)) {
            return this;
        }

        // DEBUG This function apparently isn't needed to observe preferences changes. Remove this eventually.
        if (aIID.equals(Ci.nsIPrefBranch2) 
            || aIID.equals(Ci.nsIPrefService) 
            || aIID.equals(Ci.nsIClassInfo)) { 
            // No-op
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

    allowedHostPattern: /^[\w-\.]*[\w-]+\.[\w-]+$/,

    _sanitizeHostList: function( dirtyHostList ) {

        var hostList = new Array();
        // A host entry is allowed if it contains alphanumerics, periods, and dashes.
        // FIXME: This needs to support Unicode host names.
        // FIXME: Reject host lists that are dangerously short, such as e.com, etc.
        // FIXME: Update the pattern to ignore leading and trailing spaces. AFAIK, JS doesn't have a trim() method.
        // FIXME: If possible, reject host entries that include an underscore, which is included in \w.

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




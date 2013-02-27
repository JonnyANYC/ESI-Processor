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


EsiProcessorObserver = {

    startup: function() {

        if ( this._initialized )  { 
            // TODO: change to a warning, or accept repeated calls to this as usual process.
            Components.utils.reportError('WARNING: already initialized.');
            return;
        }

        this.hostList = null;
        this.numTimesCalled = 0;

        var hostListPref = Application.prefs.getValue("extensions.esi_processor.hostlist", null);        
        if ( hostListPref != null && hostListPref.length > 0 )
        {
            this.hostList = this._sanitizeHostList( hostListPref.split(",", 25) );
        } else
        {
            this.hostList = new Array(0);
        }

        // FIXME: set up a listener on the prefs.

        this._initialized = true;
        Components.utils.reportError("init done. hostlist len: " + this.hostList.length);
    },

    shutdown: function() {
        // FIXME: Remove any remaining observers on window shutdown.
        Components.utils.reportError("shutdown: not implemented yet.");
    },


    enabledisable: function( event ) {
        // FIXME: Maybe this should be moved to a different object that handles prefs.
        // TODO: initialize just once when enabled. 
        this.startup();
        // observerService.removeObserver(EsiProcessorObserver, "http-on-examine-response");
    },


    observe: function(aSubject, aTopic, aData) {

        if (aTopic == "http-on-examine-response") {

            try {
                // FIXME check for host match here
                // FIXME need to identify cached pages ([xpconnect wrapped nsIURI]) and process them too
                // TODO: Do I need to check for chrome:// url and skip it?
                // TODO: Consider skipping file: requests. Or make it a config option. First test if I can make Ajax requests from a file: page.
                // TODO: check for all other legal protocols supported by Firefox.

                var request = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);

                if (request.URI && request.URI.scheme && request.originalURI   
                    && (request.URI.scheme == "http" || request.URI.scheme == "file")
                    && (request.originalURI.path != "/favicon.ico") 
                    && this.isHostNameMatch( request.URI.host ) ) { 

                    var esiProcessorStreamDecorator = new EsiProcessorStreamDecorator();
                    request.QueryInterface(Components.interfaces.nsITraceableChannel);
                    esiProcessorStreamDecorator.originalListener = request.setNewListener(esiProcessorStreamDecorator);
                }

            } catch (e) {
                Components.utils.reportError("\nEsiProcessorObserver error: \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            }

        } else if (aTopic == "nsPref:changed") {

            // FIXME: instantiate the prefs service, then fetch the latest data.
            // TODO: Should I try to ignore this call if the current object is what triggered the update?
            Components.utils.reportError("Prefs were updated somewhere.");

        } else {
            Components.utils.reportError("Received unexpected observer event for: " + aTopic);
        }
    },
    
    QueryInterface: function(aIID){
        if (aIID.equals(Components.interfaces.nsIObserver) ||
        aIID.equals(Components.interfaces.nsISupports)) {
            return this;
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


    configure: function( event ) {

        var params = { 
            inn: {
                enabled: true,
                hostList: this.hostList
            }, 
            out: null
        };

        window.openDialog(  "chrome://esi_processor/content/configure.xul", 
                            "",
                            "chrome, dialog, modal, resizable=yes", 
                            params ).focus();

        if (params.out) {
            // FIXME: Implement an enable/disable feature and let users toggle it here.
            // FIXME: When disabled, also consider disabling the listener on the hostlist pref, and any other shutdown / sleep actions.
            this.hostList = this._sanitizeHostList( params.out.hostList.split("\n", 25) );
            Application.prefs.setValue("extensions.esi_processor.hostlist", this.hostList.join(","));
            Components.utils.reportError("Configure dialog saved. new host list: " + params.out.hostList);
        } else {
            Components.utils.reportError("Configure dialog cancelled.");
        }
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


    _sanitizeHostList: function( dirtyHostList ) {

        var hostList = new Array();
        // A host entry is allowed if it contains alphanumerics, periods, and dashes.
        // FIXME: This needs to support Unicode host names.
        // FIXME: Reject host lists that are dangerously short, such as e.com, etc.
        // FIXME: Update the pattern to ignore leading and trailing spaces. AFAIK, JS doesn't have a trim() method.
        // FIXME: If possible, reject host entries that include an underscore, which is included in \w.
        var allowedHostPattern = /^[\w-]*\.*[\w-]+\.[\w-]+$/;

        for ( var hl = 0; hl < dirtyHostList.length; hl++)
        {
            if ( dirtyHostList[hl] == null || dirtyHostList[hl].length == 0  )  continue;
            if ( dirtyHostList[hl].toLocaleLowerCase() == 'localhost' || 
                 allowedHostPattern.test( dirtyHostList[hl] ) )
                { hostList.push( dirtyHostList[hl].toLocaleLowerCase() );  }
        }

        return hostList;
    },


};

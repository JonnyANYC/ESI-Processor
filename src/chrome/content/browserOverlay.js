// Helper functions, from Firebug
if (typeof Cc == "undefined") {
    var Cc = Components.classes;
    var Ci = Components.interfaces;
};
if (typeof CCIN == "undefined") {
    function CCIN(cName, ifaceName){
        return Cc[cName].createInstance(Ci[ifaceName]);
    }
};

function EsiBrowserOverlay() {
    this.requestContext = { 
        request: null, 
        context: null,
        inputStream: null,
        receivedData: []
    };

    this._init();
};

EsiBrowserOverlay.prototype = {
    originalListener: null,
    requestContext: null,
    bypass: null,
    acceptedMimeTypes: ["beavis"],

    onStartRequest: function(request, context) {
        try {
            if ( request.contentType 
                && ( request.contentType.indexOf("text") >= 0 || request.contentType.indexOf("xml") >= 0 || request.contentType.indexOf("html") >= 0 ) 
                || this.acceptedMimeTypes.indexOf( request.contentType ) >= 0 ) {

                Components.utils.reportError("STARTING request for mime: " + request.contentType + " on URL: "+ request.name);
                bypass = false;
                this.requestContext.request = request;
                this.requestContext.context = context;
                this.originalListener.onStartRequest(request, context);
            } else {

                Components.utils.reportError("Skipping request for mime: " + request.contentType + " on URL: "+ request.name);
                bypass = true;
                this.originalListener.onStartRequest(request, context);
            }
        } catch (e) {
            Components.utils.reportError("\nOnStartRequest error on " + request.name +" : \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            throw e;
        }
    },

    onDataAvailable: function(request, context, inputStream, offset, count) {

        try {

            if ( bypass ) {
                this.originalListener.onDataAvailable( request, context, inputStream, offset, count );
                return;
            }

            if (this.requestContext.request != request)  Components.utils.reportError("request objs don't match");
            if (this.requestContext.context != context)  Components.utils.reportError("context objs don't match");
            
            if (this.requestContext.inputStream && this.requestContext.inputStream != inputStream)  
                Components.utils.reportError("inputStream objs don't match");

            this.requestContext.inputStream = inputStream;

            var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
            binaryInputStream.setInputStream(inputStream);

            // Copy received data as they come.
            var data = binaryInputStream.readBytes(count);
            //var data = inputStream.readBytes(count);
            
            this.requestContext.receivedData.push(data);
        } catch (e) {
            Components.utils.reportError("\nOnDataAvailable error on " + request.name +": \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            throw e;
        }
    },

    onStopRequest: function(request, context, statusCode) {
        try {

            if ( bypass ) {
                this.originalListener.onStopRequest( request, context, statusCode );
                return;
            }

            var responseSource = this.requestContext.receivedData.join('');
            responseSource = this.processEsiBlocks(responseSource);

            var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
            storageStream.init(8192, responseSource.length *3, null);

            var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1",
                    "nsIBinaryOutputStream");

            binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));
            binaryOutputStream.writeBytes(responseSource, responseSource.length);
            this.originalListener.onDataAvailable(
                this.requestContext.request, 
                this.requestContext.context,
                storageStream.newInputStream(0), 
                0, 
                storageStream.length);

            this.originalListener.onStopRequest(
                this.requestContext.request, 
                this.requestContext.context, 
                statusCode);
        } catch (e) {
            Components.utils.reportError("\nOnStopRequest error on " + request.name +": \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            throw e;
        }
    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Components.results.NS_NOINTERFACE;
    },


    isHostNameMatch: function( hostName ) {
            var hostNameMatch = false;
            var hostNameLowerCase = hostName.toLocaleLowerCase();

            for ( var hl = 0; hl < this.hostList.length; hl++ )
            {
                if ( hostNameLowerCase.indexOf( this.hostList[hl] ) != -1 )
                {
                    hostNameMatch = true;
                    break;
                }
            }

            Components.utils.reportError(" host match: " + hostNameMatch);

            return hostNameMatch;
    }, 


    esiTagPattern: /\<esi:include src="([\w\d\.:\/\-,]+)"\s?\/\>/ig,

    processEsiBlocks: function(page) {
        // TODO: Extract method!!!
        Components.utils.reportError("in pageLoad Hdlr. hostlist: " + this.hostList + ". called: " + this.numTimesCalled++);

        // TODO: Remove if not needed.
        var insertedEsiContent = false;

        var esiTags = Array();  // FIXME not used?
        var aTag;
        while ( aTag = this.esiTagPattern.exec(page) ) { 

            Components.utils.reportError("Found: " + aTag);

            // FIXME: Fix the DOM and then bail if there's no src attribute.
            // TODO: Try using netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead")
            // This should work for FF v3 and 4.
            // TODO: Find out if esi src attributes can be relative URLs.

            var esiRequest = new XMLHttpRequest();
            
            // FIXME: Check the usefulness of this feature, and then cast vendorSub to a float.
            /*
            if ( true || window.navigator.vendorSub >= 3.5 )
            {
                // Check if req.onerror = onError works for FF v3.0 and 3.1, or maybe the below works w/ FF3.1
                esiRequests[i].addEventListener("error", function( event ) {
                    Components.utils.reportError("XHR error! status, errortext: " +
                        event.target.status + ", " + event.target.errorText ); },
                    false);
            }
            */

            esiRequest.open('GET', aTag[1], false);
            esiRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
            esiRequest.send();

            // TODO: If the ESI spec can't send cookies, then try to disable them in the request.
            // Use req.sendCredentials = false if it works, or maybe a channel flag.
            // TODO: Consider adding a user option to enable browser caching of ESI content.

            // FIXME: create an extension config param for security level.
            // FIXME: extract method!
            // FIXME: no way to confirm the old tag was removed. split up the page at the sstart into
            //  esi tags and the remaining chunks, fire off async requests for each esi tag, and then assemble when done.
            page = page.replace(aTag[0], esiRequest.responseText);

            insertedEsiContent = true;
        }
        return page;

        Components.utils.reportError("Done!");
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

    observe_PREFS: function() {
        Components.utils.reportError("reloadPrefs: not implemented yet.");
        // FIXME: set up a listener on the prefs. 
        // FIXME: can this coexist with an observe method for the page load? Or is that observe method in a different object?
        // Would it make sense to move the prefs observer to another object?
    },

    enabledisable: function( event ) {
        // FIXME: Maybe this should be moved to a different object that handles prefs.
        alert("enabledisable: not implemented yet.");
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

    _initialized: null,

    _init: function() {

        if ( this._initialized )  { 
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

};


HttpRequestObject = {

    observe: function(request, aTopic, aData){
        try {

            if (aTopic == "http-on-examine-response") {
                request.QueryInterface(Components.interfaces.nsIHttpChannel);

                // FIXME check for host match here
                // FIXME need to identify cached pages ([xpconnect wrapped nsIURI]) and process them too
                // TODO: Do I need to check for chrome:// url and skip it?
                // TODO: Consider skipping file: requests. Or make it a config option. First test if I can make Ajax requests from a file: page.
                // TODO: check for all other legal protocols supported by Firefox.
                if (request.URI && request.URI.scheme && request.originalURI   
                    && (request.URI.scheme == "http" || request.URI.scheme == "file")
                    && (request.originalURI.path != "/favicon.ico") ) { 
                    var esiBrowserOverlay = new EsiBrowserOverlay();
                    request.QueryInterface(Components.interfaces.nsITraceableChannel);
                    esiBrowserOverlay.originalListener = request.setNewListener(esiBrowserOverlay);
                } else { 
                    Components.utils.reportError("No match on URL: " + request.URI + ", originalURI " + request.originalURI);
                }
            } 
        } catch (e) {
            Components.utils.reportError("\nhRO error: \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
        }
    },
    
    QueryInterface: function(aIID){
        if (aIID.equals(Components.interfaces.nsIObserver) ||
        aIID.equals(Components.interfaces.nsISupports)) {
            return this;
        }
        
        throw Components.results.NS_NOINTERFACE;
        
    },
};
    

// FIXME: Move to an enable() method. And remove the observer when the extension is disabled.
var observerService = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

observerService.addObserver(HttpRequestObject,
    "http-on-examine-response", false);

Components.utils.reportError('overlay script run.');

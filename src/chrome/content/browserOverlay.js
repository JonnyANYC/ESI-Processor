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
                this.requestContext.request = request; //temp
                this.requestContext.context = context; // temp
                this.originalListener.onStartRequest(request, context);
            }
        } catch (e) {
            Components.utils.reportError("\nOnStartRequest error on " + request.name +" : \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            throw e;
        }
    },

    onDataAvailable: function(request, context, inputStream, offset, count) {

        try {

            // FIXME : just passthru if bypass is true.

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

            // FIXME : just passthru if bypass is true.

            var responseSource = this.requestContext.receivedData.join();

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


    onPageLoad: function(event) {
        // TODO: Extract method!!!
        // TODO: Do I need to check for chrome:// url and skip it?
        // TODO: Consider skipping file: requests. Or make it a config option. First test if I can make Ajax requests from a file: page.
        // TODO: check for all other legal protocols supported by Firefox.
        if (event.originalTarget instanceof HTMLDocument &&
            event.originalTarget.defaultView.location.protocol != 'about:' && 
            event.originalTarget.defaultView.location.protocol != 'chrome:' )
        {
            Components.utils.reportError("in pageLoad Hdlr. hostlist: " + this.hostList + ". url proto is " + event.originalTarget.defaultView.location.protocol + ". called: " + this.numTimesCalled++);

            var freshDoc = event.originalTarget;
            
            var hostNameMatch = false;
            var requestHostNameLowerCase = freshDoc.domain.toLocaleLowerCase();

            for ( var hl = 0; hl < this.hostList.length; hl++ )
            {
                if ( requestHostNameLowerCase.indexOf( this.hostList[hl] ) != -1 )
                {
                    hostNameMatch = true;
                    break;
                }
            }

            if (!hostNameMatch)  { Components.utils.reportError("didn't match host."); return; }

            Components.utils.reportError("matched host: " + requestHostNameLowerCase);

            // TODO: Remove if not needed.
            var insertedEsiContent = false;

            var esiTags = freshDoc.getElementsByTagName("esi:include");

            // FIXME: Remove this if it won't be used.
            // if ( esiTags.length )  this.checkForHostNameMismatches( esiTags );

            var esiRequests = new Array(esiTags.length);
            for (var i = esiTags.length -1; i >= 0; i--)
            {
                // FIXME: Fix the DOM and then bail if there's no src attribute.
                
                // TODO: Try using netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead")
                // This should work for FF v3 and 4.
                
                // TODO: Find out if esi src attributes can be relative URLs.

                // FIXME: Remove this if it won't be used.
                // var esiHostName = this.extractHostNameFromUrl( esiTags[i].getAttribute('src') );

                esiRequests[i] = new XMLHttpRequest();
                
                // FIXME: Check the usefulness of this feature, and then cast vendorSub to a float.
                if ( true || window.navigator.vendorSub >= 3.5 )
                {
                    // Check if req.onerror = onError works for FF v3.0 and 3.1, or maybe the below works w/ FF3.1
                    esiRequests[i].addEventListener("error", function( event ) {
                        Components.utils.reportError("XHR error! status, errortext: " +
                            event.target.status + ", " + event.target.errorText ); },
                        false);
                }

                esiRequests[i].open('GET', esiTags[i].getAttribute('src'), true);
                
                // TODO: If the ESI spec can't send cookies, then try to disable them in the request.
                // Use req.sendCredentials = false if it works, or maybe a channel flag.
                // TODO: Consider adding a user option to enable browser caching of ESI content.
                esiRequests[i].channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;

                let j = i;

                esiRequests[i].onreadystatechange = function( event ) {

                    if (this.readyState != 4)  { Components.utils.reportError("XHR readystate: " + this.readyState); return; }

                    let esiContent = this.responseText;
                    if(this.status != 200)
                    {
                        esiContent = 'ESI error for URL ' + esiTags[j].getAttribute('src') + ': ' + this.statusText;
                    }

                    let esiContentElement;
                    //FIXME: create an extension config param for security level.
                    let esiConfigSecurityLevel = "unprivelidged";
                    if (esiConfigSecurityLevel == "self_contained_only")
                    {
                        // FIXME: find something that will execute code, but only unprivelidged.
                        // FIXME: find a way to render iframes or similar as an inline block.
                    } else if (esiConfigSecurityLevel == "unprivelidged") {
                        // FIXME: confirm that any code in an inline like this is not privelidged.
                        esiContentElement = freshDoc.createElement("script");
                        // TODO: Consider embedding a div as a wrapper of the content, and label that div instead of the script tag.
                        esiContentElement.className = "esi_processor-injected";
                        esiContentElement.id = "esi_processor-injected-" + j;

                        esiContent = esiContent.replace(/(\r\n)|(\n)/g,'\\n').replace(/\"/g,'\\"');
                        esiContent = 'document.write("' + esiContent + '");';
                        esiContentElement.setAttribute("src", "data:text/html," + encodeURIComponent(esiContent));
                    } else {
                        esiContentElement = freshDoc.createElement("div");
                        esiContentElement.style.position = "static";
                        esiContentElement.style.display = "inline";
                        esiContentElement.className = "esi_processor-injected";
                        esiContentElement.id = "esi_processor-injected-" + j;
                        esiContentElement.innerHTML = esiContent;
                    }

                    // TODO: try removing the esi tag entirely and replacing it with the results
                    //esiTags[j].appendChild(esiContentElement);
                    esiTags[j].parentNode.insertBefore(esiContentElement, esiTags[j]);                    
                    insertedEsiContent = true;

                    while (esiTags[j].hasChildNodes())
                    {
                        esiTags[j].parentNode.insertBefore(esiTags[j].childNodes[0], esiTags[j]);
                    }

                    esiTags[j].parentNode.removeChild(esiTags[j]);
                }
                esiRequests[i].send(null);
            }

            // Components.utils.reportError("Done!");

        // FIXME: remove handler now? or needed for reloads?
        }
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

    _initialized: false,

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


// FIXME: call     this._init();

HttpRequestObject = {

    observe: function(request, aTopic, aData){
        try {

            if (aTopic == "http-on-examine-response") {
                request.QueryInterface(Components.interfaces.nsIHttpChannel);
                
                if (request.URI && request.URI.scheme &&
                    (request.URI.scheme == "http" || request.URI.scheme == "file")
                 ) { // FIXME check for host match here
                    var esiBrowserOverlay = new EsiBrowserOverlay();
                    request.QueryInterface(Components.interfaces.nsITraceableChannel);
                    esiBrowserOverlay.originalListener = request.setNewListener(esiBrowserOverlay);
                } else { 
                    Components.utils.reportError("No match on URL: " + request.URI);
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

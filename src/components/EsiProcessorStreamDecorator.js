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


// TODO: It might be cleaner (and maybe faster?) to implement this object as a JSM. See: https://developer.mozilla.org/en-US/docs/XUL/School_tutorial/JavaScript_Object_Management
function EsiProcessorStreamDecorator() {
    this.requestContext = { 
        request: null, 
        context: null,
        inputStream: null,
        receivedData: [], 
        finalStatusCode: null
    };

    decoratedPage = [];
    completedRequests = [];

    this.wrappedJSObject = this;
};

EsiProcessorStreamDecorator.prototype = {

    classDescription: "ESI Processor Stream Decorator Javascript XPCOM Component",
    classID:          Components.ID("{12345678-1234-4321-1234-1234567890AC}"),
    contractID:       "@angelajonhome.com/esiprocessorstreamdecorator;1",
    receivedData: null,


    originalListener: null,
    requestContext: null,
    bypass: null,
    acceptedMimeTypes: ["beavis"], // FIXME: add as a config param.
    decoratedPage: null,
    completedRequests: null,

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

            Components.utils.reportError("\nraw response complete. Final status code: " + statusCode);
            this.requestContext.finalStatusCode = statusCode;

            var responseSource = this.requestContext.receivedData.join('');
            this.processEsiBlocks(responseSource);

        } catch (e) {
            Components.utils.reportError("\nOnStopRequest error on " + request.name +": \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
            throw e;
        }
    },

    sendDecoratedResponse: function(page, esiBlocks) {
            try {
                var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
                // FIXME: Why do I run out of space unless I init the stream to 3x length? Multi-byte characters?
                storageStream.init(8192, page.length, null);

                var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1",
                        "nsIBinaryOutputStream");

                binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));
                binaryOutputStream.writeBytes(page, page.length);
                this.originalListener.onDataAvailable(
                    this.requestContext.request, 
                    this.requestContext.context,
                    storageStream.newInputStream(0), 
                    0, 
                    storageStream.length);

                this.originalListener.onStopRequest(
                    this.requestContext.request, 
                    this.requestContext.context, 
                    this.requestContext.finalStatusCode);

                binaryOutputStream.close();
                storageStream.close();

                // TODO Nullify the member properties as well.
                this.requestContext = null;

            } catch (e) {
                Components.utils.reportError("\nError on final send to client for " + this.requestContext.request.name +": \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
                if (binaryOutputStream) { binaryOutputStream.close(); }
                if (storageStream) { storageStream.close(); }
                throw e;
            }

            if ( esiBlocks ) {

                var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
                alertsService.showAlertNotification(
                    "chrome://mozapps/skin/extensions/alerticon-info-positive.png", // TODO find a better icon
                    "ESI Processor notification", 
                    esiBlocks + " ESI include(s) were processed on this page.", 
                    false, 
                    null,
                    null,
                    "esi-processor-notification");
            }

    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Components.results.NS_NOINTERFACE;
    },

    // TODO Needs to be UTF-8 compatible. Also needs to support other supported punctuation in URLs.
    esiTagPatternAll: /\<esi:include src="([\w\d\.:\/\-,]+)"[\w\s="]?\/\>/ig,
    esiTagPatternSingle: /\<esi:include src="([\w\d\.:\/\-,]+)"[\w\s="]?\/\>/i,

    processEsiBlocks: function(page) {
        // TODO: Extract method!!!

        var esiTags = page.match( this.esiTagPatternAll );

        if (esiTags == null) { 
            // No ESI tags found on this page. Bail quickly, and don't display the ESI notification.
            this.sendDecoratedResponse(page, 0);
            return;
        }

        this.decoratedPage = new Array( (esiTags.length *2) +1 );
        this.completedRequests = new Array(esiTags.length);

        var esiRequests = new Array(esiTags.length);
        var esiUrl;
        var cursor = 0;
        var prevCursor = 0;
        for ( var i=0; i < esiTags.length; i++ ) {
            
            cursor = page.indexOf( esiTags[i], cursor );
            this.decoratedPage[i*2] = page.substring(prevCursor, cursor);
            prevCursor = cursor + esiTags[i].length;
            cursor = prevCursor;

            esiUrl = this.esiTagPatternSingle.exec(esiTags[i])[1];
            Components.utils.reportError("Found an ESI include at position " + cursor + " with tag " + esiTags[i] + " and tag components " + esiUrl);

            // TODO Do some sanity checking on the URL ((/https:/// only, etc.))
            // COMPAT: Gecko 16+  See: https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest#Using_XMLHttpRequest_from_JavaScript_modules_.2F_XPCOM_components
            const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
            esiRequests[i] = XMLHttpRequest();
            //COMPAT: Gecko 12+
            esiRequests[i].timeout = 60000; // TODO Make this a config param.
            esiRequests[i].open('GET', esiUrl, true);

            // FIXME: Check the usefulness of this feature, and then cast vendorSub to a float.
            /*
            if ( true || window.navigator.vendorSub >= 3.5 )
            {
                // Check if req.onerror = onError works for FF v3.0 and 3.1, or maybe the below works w/ FF3.1
                esiRequest.addEventListener("error", function( event ) {
                    Components.utils.reportError("XHR error! status, errortext: " +
                        event.target.status + ", " + event.target.errorText ); },
                    false);
            }
            */

            let j = i;
            let that = this;
            esiRequests[i].onreadystatechange = function( event ) {

                if (this.readyState != 4)  { return; }

                var esiContent = this.responseText;
                if(this.status != 200)
                {
                    esiContent = 'ESI error for request' + j + ': ' + this.statusText;
                }

                that.handleEsiResponse(j, esiContent);
            }

            esiRequests[i].send(null);

/*
            // FIXME: Fix the DOM and then bail if there's no src attribute.
            // TODO: Try using netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead")
            // This should work for FF v3 and 4.
            // TODO: Check the spec to determine if esi src attributes can be relative URLs. I think they can.
            esiRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;

            // TODO: If the ESI spec can't send cookies, then try to disable them in the request.
            // Use req.sendCredentials = false if it works, or maybe a channel flag.
            // TODO: Consider adding a user option to enable browser caching of ESI content.
*/
            // FIXME: create an extension config param for security level.
        }

        this.decoratedPage[this.decoratedPage.length-1] = page.substr(cursor);
    },


    handleEsiResponse: function(esiIndex, esiContent) {

        this.decoratedPage[(esiIndex*2) +1] = 
            '<!-- ESI tag processed by ESI Processor. -->' + 
            esiContent + 
            '<!-- End ESI tag. -->';
        this.completedRequests[esiIndex] = true;

        var esiRequestsComplete = true;
        for (var i = 0; i < this.completedRequests.length; i++) { 

            if ( !this.completedRequests[i] ) {
                esiRequestsComplete = false;
                break;
            }
        }

        if (esiRequestsComplete) {
            this.sendDecoratedResponse( this.decoratedPage.join(''), this.completedRequests.length );
        }
    },

};


var components = [EsiProcessorStreamDecorator];
if ("generateNSGetFactory" in XPCOMUtils)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);  // Firefox 4.0 and higher
else
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);    // Firefox 3.x




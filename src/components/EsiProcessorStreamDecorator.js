/*
 *   ESI Processor Firefox Extension
 * 
 *   Copyright 2013 Jonathan Atkinson
 * 
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 * 
 *       http://www.apache.org/licenses/LICENSE-2.0
 * 
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */


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

    this.decoratedPage = [];
    this.completedRequests = [];
    this.errorRequests = 0;

    this.idnum = Math.random();

    this.httpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");

    this.wrappedJSObject = this;
};

EsiProcessorStreamDecorator.prototype = {

    classDescription: "ESI Processor Stream Decorator Javascript XPCOM Component",
    classID:          Components.ID("{adc38abe-a417-4f20-8e73-c2907b30c8be}"),
    contractID:       "@angelajonhome.com/esiprocessorstreamdecorator;1",
    receivedData: null,


    originalListener: null,
    requestContext: null,
    bypass: null,
    decoratedPage: null,
    completedRequests: null,
    errorRequests: null,

    httpRequest: null,

    onStartRequest: function(request, context) {
        try {

            // TODO: Consider expanding the list of accepted MIME types as a config param.
            if ( request.contentType 
                && ( request.contentType.indexOf("text") >= 0 
                  || request.contentType.indexOf("xml") >= 0 
                  || request.contentType.indexOf("html") >= 0 ) ) {

                bypass = false;
                this.requestContext.request = request;
                this.requestContext.context = context;
                this.originalListener.onStartRequest(request, context);
            } else {

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

            if (this.requestContext.request != request)  {Components.utils.reportError("ESI Processor ERROR: request objs don't match");}
            if (this.requestContext.context != context)  {Components.utils.reportError("ESI Processor ERROR: context objs don't match");}
            
            if (this.requestContext.inputStream && this.requestContext.inputStream != inputStream) {
                Components.utils.reportError("ESI Processor ERROR: inputStream objs don't match"); }

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

                // TODO: Localize the alert text.
                // TODO: Consider using alerticon-error.png if there was an error processing the ESI tag.
                // TODO: Find a better icon.
                var alertMessage = esiBlocks + " ESI include(s) were processed on this page.";
                var alertIcon = "chrome://mozapps/skin/extensions/alerticon-info-positive.png";
                if ( this.errorRequests ) {
                    alertMessage += " " + this.errorRequests + " of these ESI includes returned an error.";
                    alertIcon = "chrome://mozapps/skin/extensions/alerticon-info-negative.png";
                } 

                var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
                alertsService.showAlertNotification(
                    alertIcon,
                    "ESI Processor notification", 
                    alertMessage, 
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

    // TODO Needs to be UTF-8 compatible.
    // FIXME: Needs to support all other valid punctuation in URLs.
    // FIXME: Need to support relative URLs, but still filter for bad URLs, such as javascript: or chrome:.
    esiTagPatternAll: /\<esi:include src="(https?:\/\/[\w\d\.:\/\-,]+)"[\w\s="]?\/\>/ig,
    esiTagPatternSingle: /\<esi:include src="(https?:\/\/[\w\d\.:\/\-,]+)"[\w\s="]?\/\>/i,

    processEsiBlocks: function(page) {

        var esiTags = page.match( this.esiTagPatternAll );

        if (esiTags == null) { 
            // No ESI tags found on this page. Bail quickly, and don't display the ESI notification.
            this.sendDecoratedResponse(page, 0);
            return;
        }

        // FIXME: Limit the number of concurrent requests.
        // How best to do this? Perhaps for now allow excessive ones to be unprocessed or synchronous?
        // TODO: Extract method!!!

        this.decoratedPage = new Array( (esiTags.length *2) +1 );
        this.completedRequests = new Array(esiTags.length);

        var esiUrl;
        var cursor = 0;
        var prevCursor = 0;
        for ( var i=0; i < esiTags.length; i++ ) {

            cursor = page.indexOf( esiTags[i], cursor );
            this.decoratedPage[i*2] = page.substring(prevCursor, cursor);
            prevCursor = cursor + esiTags[i].length;
            cursor = prevCursor;

            esiUrl = this.esiTagPatternSingle.exec(esiTags[i])[1];

            // NEXT: Test if objParameters do anything in this context.
            // COMPAT: Gecko 16+  See: https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest#Using_XMLHttpRequest_from_JavaScript_modules_.2F_XPCOM_components
            let esiRequest = this.httpRequest( {mozAnon: true, mozSystem: true, } );
            //COMPAT: Gecko 12+
            esiRequest.timeout = 60000; // TODO Make this a config param.

            // NEXT: Fix the async bottleneck
            // Current theory: Firefox only allows one concurrent request per host name. check if this is the case
            // for unprivelidged Ajax as well. or check the docs.
            // Prev theory: the requests are getting held up by soem shared resource. 
            // Also, the requests for the .html esi files arne't showing up in the log. are they handled by browser cache?
            // A bad option:Count requests by host, and synchronize every third per host? That's messy, and not phase 1.
            // Just get it to work sustainably. If time permits, try this in client-side code, outside of a component, etc.

            // TODO: Is there an easy way to 
            // prevent recursive scanning of requests, such as by adding something to the XHR object that supporesses 
            // the esi scanning? perhaps adding an "ESI-Processor: requestor" header will suffice.

            if ( (i%10 == 9) && (i != esiTags.length-1) ) { 

                // Avoid spawning too many concurrent requests by sending every tenth request synchronously.
                // But don't do that on the last request, because we want this function to complete first.
                esiRequest.open("GET", esiUrl, false);
                esiRequest.send();

                let esiContent = esiRequest.responseText;
                if( esiRequest.status != 200 )
                {
                    esiContent = "ESI timeout or error for request " + i + 
                        ". Status code: " + esiRequest.status + ". Error text, if any: {" + 
                        esiRequest.statusText + "} {" + esiRequest.responseText + "}";
                    this.errorRequests++;
                }

                this.handleEsiResponse(i, esiContent);

            } else {

                // Send most requests asynchronously.
                esiRequest.open("GET", esiUrl, true);

                let j = i;
                let that = this;
                esiRequest.onreadystatechange = function( event ) {

                    if (this.readyState != 4)  { return; }

                    var esiContent = this.responseText;
                    if( this.status != 200 )
                    {
                        esiContent = "ESI timeout or error for request " + j + 
                            ". Status code: " + this.status + ". Error text, if any: {" + 
                            this.statusText + "} {" + this.responseText + "}";
                        that.errorRequests++;
                    }

                    that.handleEsiResponse(j, esiContent);
                }

                esiRequest.send(null);
            }

            // TODO: Is the check of the status code adequate? Or do I need to handle errors explicitly?
            /*
            if ( window.navigator.vendorSub >= 3.5 )
            {
                // Check if req.onerror = onError works for FF v3.0 and 3.1, or maybe the below works w/ FF3.1
                esiRequest.addEventListener("error", function( event ) {
                    Components.utils.reportError("XHR error! status, errortext: " +
                        event.target.status + ", " + event.target.errorText ); },
                    false);
            }
            */

            // TODO: If the ESI spec can't send cookies, then try to disable them in the request.
            // One possible cookie-blocking solution: https://developer.mozilla.org/en-US/docs/Creating_Sandboxed_HTTP_Connections
            // Use req.sendCredentials = false if it works, or maybe a channel flag somehow.
            // esiRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
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

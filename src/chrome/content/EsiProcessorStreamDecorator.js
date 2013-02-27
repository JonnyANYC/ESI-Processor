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
};

EsiProcessorStreamDecorator.prototype = {
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

    sendDecoratedResponse: function(page) {
            try {
                var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
                // FIXME: Why do I run out of space unless I init the stream to 3x length? Multi-byte characters?
                storageStream.init(8192, page.length *3, null);

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
            } catch (e) {
                Components.utils.reportError("\nError on final send to client for " + request.name +": \n\tMessage: " + e.message + "\n\tFile: " + e.fileName + "  line: " + e.lineNumber + "\n");
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

    // TODO Needs to be UTF-8 compatible. Also needs to support other supported punctuation in URLs.
    esiTagPatternAll: /\<esi:include src="([\w\d\.:\/\-,]+)"[\w\s="]?\/\>/ig,
    esiTagPatternSingle: /\<esi:include src="([\w\d\.:\/\-,]+)"[\w\s="]?\/\>/i,

    processEsiBlocks: function(page) {
        // TODO: Extract method!!!

        var esiTags = page.match( this.esiTagPatternAll );

        if (esiTags == null) { 
            // No ESI tags found on this page. Bail quickly.
            this.sendDecoratedResponse(page);
            return;
        }

        this.decoratedPage = new Array( (esiTags.length *2) +2 );
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

            esiRequests[i] = new XMLHttpRequest();
            esiRequests[i].open('GET', esiUrl, true);

            let j = i;

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

            // TODO This looks messy. Consider alternatives, or at least make the approach more generic.
            esiRequests[i].EsiProcessorStreamDecorator_handle = this;
            esiRequests[i].onreadystatechange = function( event ) {

                if (this.readyState != 4)  { return; }

                var esiContent = this.responseText;
                if(this.status != 200)
                {
                    esiContent = 'ESI error for request' + j + ': ' + this.statusText;
                }

                this.EsiProcessorStreamDecorator_handle.handleEsiResponse(j, esiContent);
            }

            esiRequests[i].send(null);

/*
            // FIXME: Fix the DOM and then bail if there's no src attribute.
            // TODO: Try using netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead")
            // This should work for FF v3 and 4.
            // TODO: Find out if esi src attributes can be relative URLs.
            esiRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;

            // TODO: If the ESI spec can't send cookies, then try to disable them in the request.
            // Use req.sendCredentials = false if it works, or maybe a channel flag.
            // TODO: Consider adding a user option to enable browser caching of ESI content.
*/
            // FIXME: create an extension config param for security level.
        }

        this.decoratedPage[this.decoratedPage.length-2] = page.substr(cursor);
        this.decoratedPage[this.decoratedPage.length-1] = this.getEsiCss();
    },


    handleEsiResponse: function(esiIndex, esiContent) {

        annotatedEsiContent = new Array(4);
        annotatedEsiContent[0] = '<!-- ESI tag processed by ESI Processor. -->';
        annotatedEsiContent[1] = '<div class="esi_processor-injected" onmouseover="esi_processor_highlight(this)" onmouseout="esi_processor_unhighlight(this)">';
        annotatedEsiContent[2] = esiContent;
        annotatedEsiContent[3] = '</div><!-- End ESI tag. -->';

        this.decoratedPage[(esiIndex*2) +1] = annotatedEsiContent.join('');
        this.completedRequests[esiIndex] = true;

        // TODO extract method.
        var esiRequestsComplete = true;
        for (var i = 0; i < this.completedRequests.length; i++) { 

            if ( !this.completedRequests[i] ) {
                esiRequestsComplete = false;
                break;
            }
        }

        if (esiRequestsComplete) {
            this.sendDecoratedResponse( this.decoratedPage.join('') );
        }
    },

    getEsiCss: function() {
        // FIXME Handle this in a browser overlay. The end-user's DOM shouldn't change from what they'd expect.
        return '<style type="text/css"> \n\
.esi_processor-injected { \n\
    display: inline-block; \n\
    padding: 0px; \n\
    margin: 0px; \n\
} \n\
\n\
.esi_processor_alertbar { \n\
    position: fixed;\n\
    bottom: 0px;\n\
    font-size: 24px;\n\
    color: blue;\n\
    text-align: center;\n\
}\n\
</style>\n\
<script type="text/javascript">\n\
function esi_processor_highlight(esiBlock) {\n\
  esiBlock.style.border = "2px dashed blue";\n\
  esiBlock.style.margin = "-1px";\n\
}\n\
\n\
function esi_processor_unhighlight(esiBlock) {\n\
  esiBlock.style.border = "none";\n\
  esiBlock.style.margin = "0px";\n\
}\n\
\n\
(function() {\n\
\n\
    var alertbar = document.createElement("div");\n\
    alertbar.className = "esi_processor_alertbar";\n\
    alertbar.appendChild(document.createTextNode("ESI blocks were processed on this page."));\n\
    document.body.appendChild(alertbar);\n\
\n\
    function removeAlertbar() {\n\
        document.body.removeChild(alertbar);\n\
    };\n\
\n\
    window.setTimeout(removeAlertbar, 10000);\n\
})();\n\
\n\
</script>\n\
';
    }
    

};

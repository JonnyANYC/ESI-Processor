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
        receivedData: []
    };
};

EsiProcessorStreamDecorator.prototype = {
    originalListener: null,
    requestContext: null,
    bypass: null,
    acceptedMimeTypes: ["beavis"], // FIXME: add as a config param.

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
            // FIXME: Why do I run out of space unless I init the strem to 3x length? Multi-byte characters?
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


    esiTagPattern: /\<esi:include src="([\w\d\.:\/\-,]+)"[\w\s="]?\/\>/ig,

    processEsiBlocks: function(page) {
        // TODO: Extract method!!!
        var insertedEsiContent = false;

        var esiTags = page.match( this.esiTagPattern );
        var decoratedPage = new Array( (esiTags.length *2) +1 );
        var esiRequests = new Array(esiTags.length);
        var tag;
        var cursor = 0;
        var prevCursor = 0;
        for ( var i=0; i < esiTags.length; i++ ) {
            
            cursor = page.indexOf( esiTags[i], cursor );
            Components.utils.reportError("Found an ESI include at position " + cursor + " with tag " + esiTags[i]);
            decoratedPage[i*2] = page.substring(prevCursor, cursor);
            prevCursor = cursor + esiTags[i].length;
            cursor = prevCursor;

            insertedEsiContent = true;

            // Add a new array entry.
            // TODO
            // page = 

            // Extract the ESI source.
            // TODO ( aTag = this.esiTagPattern.exec(page) ) { 

            // Fire off the request asynchronously.
            // TODO


            esiRequests[i] = new XMLHttpRequest();
            esiRequests[i].open('GET', 'http://localhost/esi1.html', true);

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

            esiRequests[i].onreadystatechange = function( event ) {

                if (this.readyState != 4)  { return; }

                var esiContent = this.responseText;
                if(this.status != 200)
                {
                    esiContent = 'ESI error for request' + j + ': ' + this.statusText;
                }

                decoratedPage[(j*2)+1] = esiContent;

                Components.utils.reportError("found content: " + esiContent);

            }

            esiRequests[i].send(null);

/*
            // FIXME: Fix the DOM and then bail if there's no src attribute.
            // TODO: Try using netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead")
            // This should work for FF v3 and 4.
            // TODO: Find out if esi src attributes can be relative URLs.
            var esiRequest = new XMLHttpRequest();
            
            esiRequest.open('GET', aTag[1], false);
            esiRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
            esiRequest.send();

            // TODO: If the ESI spec can't send cookies, then try to disable them in the request.
            // Use req.sendCredentials = false if it works, or maybe a channel flag.
            // TODO: Consider adding a user option to enable browser caching of ESI content.
*/
            // FIXME: create an extension config param for security level.
            // FIXME: extract method!
            // FIXME: no way to confirm the old tag was removed, which risks an infinite loop. 
            // split up the page at the sstart into
            //  esi tags and the remaining chunks, fire off async requests for each esi tag, and then assemble when done.
/*            var esiContent = '<!-- ESI tag processed by ESI Processor. -->\n';
            esiContent += '<div class="esi_processor-injected" onmouseover="esi_processor_highlight(this)" onmouseout="esi_processor_unhighlight(this)">';
            esiContent += esiRequest.responseText;
            esiContent += '\n</div>'
            esiContent += '\n<!-- End ESI tag. -->';
*/
        //    page = page.replace(aTag[0], esiContent);
        }

        if (insertedEsiContent) { 
            decoratedPage[decoratedPage.length-1] = page.substr(cursor);

            decoratedPage[3] = "found content: <div class='esi1'>\
ESI 1 or 3.\
</div>";
            page = decoratedPage.join();
            page = this.addEsiCss(page);
        }

        return page;

    },


    addEsiCss: function(page) {
        page += '<style type="text/css"> \n\
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
        return page;
    }
    

};

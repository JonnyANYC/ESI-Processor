function EsiBrowserOverlay() {

     this.reloadPrefs = function() {
        Components.utils.reportError("reloadPrefs: not implemented yet.");
    };

    /*
     Not in use. Retained only for future debugging needs.
    */
    this.reporter = function(event) {
        if (!event)
        {
            Components.utils.reportError("in reporter. chg: " + this.allowDomainValueChange + " and len: " + this.hostList + ". called: " + this.numTimesCalled++);
        } else if (event && event.originalTarget instanceof HTMLDocument)
        {
            Components.utils.reportError("in reporter. chg: " + this.allowDomainValueChange + " and len: " + this.hostList + ". url is " + event.originalTarget.defaultView.location + ". called: " + this.numTimesCalled++);
        }
    };

    this.onPageLoad = function(event) {
        // TODO: Extract method!!!
        // TODO: Do I need to check for chrome:// url and skip it?
        // TODO: Consider skipping file: requests. Or make it a config option. First test if I can make Ajax requests from a file: page.
        // TODO: check for all other legal protocols supported by Firefox.
        if (event.originalTarget instanceof HTMLDocument &&
            event.originalTarget.defaultView.location.protocol != 'about:' && 
            event.originalTarget.defaultView.location.protocol != 'chrome:' )
        {
            Components.utils.reportError("in pageLoad Hdlr. chg: " + this.allowDomainValueChange + " and hostlist: " + this.hostList + ". url proto is " + event.originalTarget.defaultView.location.protocol + ". called: " + this.numTimesCalled++);

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

                    let esiContentElement = freshDoc.createElement("span");
                    esiContentElement.id = "esi_processor-" + j;
                    esiContentElement.innerHTML = esiContent;
                    // TODO: try removing the esi tag entirely and replacing it with the results
                    //esiTags[j].appendChild(esiContentElement);
                    esiTags[j].parentNode.insertBefore(esiContentElement, esiTags[j]);

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
    };
    
    this.checkForHostNameMismatches = function( esiTags ) {
        Components.utils.reportError("checkForHostNameMismatches: not implemented yet.");
    };

    this.urlHostMatchPattern = /^http:\/\/([\w\.-]+)/i;

    this.extractHostNameFromUrl = function( url ) {
        var urlHostMatch = url.match( this.urlHostMatchPattern );
        return urlHostMatch ? urlHostMatch[1] : null;
    };

    this.urlDomainMatchPattern = /^http:\/\/([\w-]\.)+([\w-])/i;

    this.extractDomainFromUrl = function( url ) {
        var urlDomainMatch = url.match( this.urlDomainMatchPattern );
        
        var domain = null;
        
        var matchLength = urlDomainMatch.length;
        
        if ( matchLength )
        {
            domain = urlDomainMatch[ matchLength-1 ] + urlDomainMatch[ matchLength ] 
        }
        return domain;
    };


    this._initialized = false;

    this._init = function() {

        if ( this._initialized )  return;

        this.documentHost = null;
        this.hostList = null;
        this.allowDomainValueChange = false;
        this.numTimesCalled = 0;


        var hostListPref = Application.prefs.get("extensions.esi_processor.hostlist");        
        if ( hostListPref != null && hostListPref.value.length > 0 )
        {
            // Break up the host list into individual hosts. A comma, spaces, or both are accepted delimiters.
            var hostListPrefArray = hostListPref.value.split( /,+|\s+|,\s+/, 100);

            this.hostList = new Array();
            // A host entry is allowed if it contains alphanumerics, periods, and dashes.
            // FIXME: If possible, reject host entries that include an underscore, which is included in \w.
            var allowedHostPattern = /^[\w\.-]+$/;

            for ( var hl = 0; hl < hostListPrefArray.length; hl++)
            {
                if ( hostListPrefArray[hl].length > 0 &&
                     allowedHostPattern.test( hostListPrefArray[hl] ) )
                    { this.hostList[hl] = hostListPrefArray[hl].toLocaleLowerCase();  } // FIXME: Shouldn't we append to this.hostList[this.hostList.length]?
            }

        } else
        {
            this.hostList = new Array(0);
        }

        var domainChangePref = Application.prefs.get("extensions.esi_processor.allowdomainvaluechange");
        if ( domainChangePref != null )
        {
            this.allowDomainValueChange = domainChangePref.value;
        } else
        {
            this.allowDomainValueChange = false;
        }
        
        this.documentHost = this.extractHostNameFromUrl( window.location.toString() );

        this._initialized = true;
        Components.utils.reportError("init: chg: " + this.allowDomainValueChange +
            "; len: " + this.hostList.length + "; host: " + this.documentHost );

    };

    this._init();

};


var esiBrowserOverlay;

esiBrowserOverlayPageLoadHandler = function( event ) {

    if ("undefined" == typeof( esiBrowserOverlay )) {
        Components.utils.reportError('creating a new ESI overlay object.');
        esiBrowserOverlay = new EsiBrowserOverlay();
    };
    
    esiBrowserOverlay.onPageLoad( event );
};

window.addEventListener("load", function () {
    Components.utils.reportError('about to set gbrowser handler.');
    gBrowser.addEventListener("load", esiBrowserOverlayPageLoadHandler, true);
    Components.utils.reportError('done with setting gbrowser handler.');
}, false);

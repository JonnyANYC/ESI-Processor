function EsiBrowserOverlay() {
   this.init();
}

// TODO: Get this class to be shared by all tabs in each browser window.
EsiBrowserOverlay.prototype =  // class
{
    documentHost : null,
    
    hostList : null,
    
    allowDomainValueChange : false,
    
    numTimesCalled : 0,

     reloadPrefs : function()
    {
        Components.utils.reportError("reloadPrefs: not implemented yet.");
    },

    /*
     Not in use. Retained only for future debugging needs.
    */
    reporter : function(event)
    {
        if (!event)
        {
            Components.utils.reportError("in reporter. chg: " + this.allowDomainValueChange + " and len: " + this.hostList + ". called: " + this.numTimesCalled++);
        } else if (event && event.originalTarget instanceof HTMLDocument)
        {
            Components.utils.reportError("in reporter. chg: " + this.allowDomainValueChange + " and len: " + this.hostList + ". url is " + event.originalTarget.defaultView.location + ". called: " + this.numTimesCalled++);
        }
    },

    pageLoadHandler : function(event)
    {
        // TODO: Extract method!!!
        // TODO: Do I need to check for chrome:// url and skip it?
        if (event.originalTarget instanceof HTMLDocument &&
            event.originalTarget.defaultView.location.protocol != 'about:')
        {
            Components.utils.reportError("in pageLoad Hdlr. chg: " + this.allowDomainValueChange + " and len: " + this.hostList + ". url proto is " + event.originalTarget.defaultView.location.protocol + ". called: " + this.numTimesCalled++);

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

            if (!hostNameMatch)  { return; }

            var esiTags = freshDoc.getElementsByTagName("esi:include");

            if ( esiTags.length )  this.checkForHostNameMismatches( esiTags );

            var esiRequests = new Array(esiTags.length);
            for (var i = esiTags.length -1; i >= 0; i--)
            {
                // compaer host names
                
                
                esiRequests[i] = new XMLHttpRequest();
                esiRequests[i].open('GET', esiTags[i].getAttribute('src'), true);

                let j = i;

                esiRequests[i].onreadystatechange = function( event ) {

                    if (this.readyState != 4)  { return; }

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
    },
    
    checkForHostNameMismatches : function( esiTags )
    {
        Components.utils.reportError("checkForHostNameMismatches: not implemented yet.");
    },
    
    initialized : false,

    init : function()
    {
        if ( this.initialized )  return;

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
                    { this.hostList[hl] = hostListPrefArray[hl].toLocaleLowerCase(); }
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

        this.initialized = true;
        Components.utils.reportError("init: chg: " + this.allowDomainValueChange + " and len: " + this.hostList.length );

    },

    extractHostNameFromUrl : function( url )
    {
        var urlHostMatch = url.match(/^http:\/\/([\w\.-]+)/i);
        return urlHostMatch ? urlHostMatch[1] : null;
    }

};

function pageLoadHandler( event )
{
    // TODO: Try to set a global overlay instance, and then reference it here.
    /*
    if ("undefined" == typeof( overlay )) {
        var overlay = new EsiBrowserOverlay();
    };
    */
    
    var overlay = new EsiBrowserOverlay();
    overlay.pageLoadHandler( event );
}

window.addEventListener("load", function () {
    Components.utils.reportError('about to set gbrowser handler.');
    gBrowser.addEventListener("load", pageLoadHandler, true);
    Components.utils.reportError('done with setting gbrowser handler.');
}, false);
     
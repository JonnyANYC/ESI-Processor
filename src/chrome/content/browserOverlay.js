function EsiBrowserOverlay() {
   //this.init();
        var hostListPref = Application.prefs.get("extensions.esi_processor.hostlist");        
        if ( hostListPref != null && hostListPref.value.length > 0 )
        {
            this.hostList = hostListPref.value.split( /,*\s+/, 100);
        } else
        {
            this.hostList = null;
        }

        var domainChangePref = Application.prefs.get("extensions.esi_processor.allowdomainvaluechange");
        if ( domainChangePref != null )
        {
            this.allowDomainValueChange = domainChangePref.value;
        } else
        {
            this.allowDomainValueChange = false;
        }

        Components.utils.reportError("init: chg: " + this.allowDomainValueChange + " and len: " + this.hostList.length );
}

// TODO: Get this class to be shared by all tabs in each browser window.
EsiBrowserOverlay.prototype =  // class
{
    hostList : null,
    
    allowDomainValueChange : false,
    
    numTimesCalled : 0,

    init2 : function()
    {
        var hostListPref = Application.prefs.get("extensions.esi_processor.hostlist");        
        if ( hostListPref != null && hostListPref.value.length > 0 )
        {
            this.hostList = hostListPref.value.split( /,*\s+/, 100);
        } else
        {
            this.hostList = null;
        }

        var domainChangePref = Application.prefs.get("extensions.esi_processor.allowdomainvaluechange");
        if ( domainChangePref != null )
        {
            this.allowDomainValueChange = domainChangePref.value;
        } else
        {
            this.allowDomainValueChange = false;
        }
        
        alert("init2: chg: " + this.allowDomainValueChange + " and len: " + this.hostList.length );
    },

     reloadPrefs : function()
    {
        window.alert("not yet implemented.");
    },

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
        // TODO: check for chrome:// url and skip it
        if (event.originalTarget instanceof HTMLDocument &&
            event.originalTarget.defaultView.location.protocol != 'about:')
        {
            Components.utils.reportError("in pageLoad Hdlr. chg: " + this.allowDomainValueChange + " and len: " + this.hostList + ". url proto is " + event.originalTarget.defaultView.location.protocol + ". called: " + this.numTimesCalled++);

            var freshDoc = event.originalTarget; // we don't care about defaultView property
            
            if (freshDoc.domain != 'jonatkinson.home.mindspring.com')  { return; }
            
            Components.utils.reportError("inhandler. chg: " + this.allowDomainValueChange);
            Components.utils.reportError("inhandler. and len: " + this.hostList );

            var esiTags = freshDoc.getElementsByTagName("esi:include");

            var esiRequests = new Array(esiTags.length);
            for (var i = esiTags.length -1; i >= 0; i--)
            {
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
    }

};

/*
    if ("undefined" == typeof(EsiBrowserOverlay))
    {
        overlay = new EsiBrowserOverlay();
    };
*/

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
     
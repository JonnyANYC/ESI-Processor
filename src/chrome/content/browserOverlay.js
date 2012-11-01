function EsiBrowserOverlay() {

    this.onPageLoad = function(event) {
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
                    let esiConfigSecurityLevel = "paranoid";
                    if (esiConfigSecurityLevel == "open")
                    {
                        // FIXME: find something that will execute code, but only unprivelidged.
                    } else if (esiConfigSecurityLevel == "self_contained_only") {
                        // FIXME: find a way to render iframes or similar as an inline block.
                        // FIXME: confirm that any code in an inline like this is not privelidged.
                        esiContentElement = freshDoc.createElement("iframe");
                        esiContentElement.style.position = "static";
                        esiContentElement.style.display = "inline";
                        esiContentElement.className = "esi_processor";
                        esiContentElement.id = "esi_processor-" + j;
                        //esiContentElement.setAttribute("type", "content");
                        esiContentElement.setAttribute("src", "data:text/html," + encodeURIComponent(esiContent));
                    } else {
                        esiContentElement = freshDoc.createElement("div");
                        esiContentElement.style.position = "static";
                        esiContentElement.style.display = "inline";
                        esiContentElement.className = "esi_processor";
                        esiContentElement.id = "esi_processor-" + j;
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
    };
    

    this.configure = function( event ) {

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
            this.hostList = this._sanitizeHostList( params.out.hostList.split("\n") );
            Application.prefs.setValue("extensions.esi_processor.hostlist", this.hostList.join(","));
            Components.utils.reportError("Configure dialog saved. new host list: " + params.out.hostList);
        } else {
            Components.utils.reportError("Configure dialog cancelled.");
        }
    };

    this.observe = function() {
        Components.utils.reportError("reloadPrefs: not implemented yet.");
        // FIXME: set up a listener on the prefs. 
    };

    this.enabledisable = function( event ) {
        alert("enabledisable: not implemented yet.");
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

    this._sanitizeHostList = function( dirtyHostList ) {

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
    }

    this._initialized = false;

    this._init = function() {

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
    gBrowser.addEventListener("load", esiBrowserOverlayPageLoadHandler, true);
}, false);

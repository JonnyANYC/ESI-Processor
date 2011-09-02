window.addEventListener("load", function () {
  gBrowser.addEventListener("load", EsiProcessor.BrowserOverlay.pageLoadHandler, true);
}, false);




if ("undefined" == typeof(EsiProcessor)) {
    var EsiProcessor = {};
};

EsiProcessor.BrowserOverlay =  // class
{

    pageLoadHandler: function(event)
    {
        if (event.originalTarget instanceof HTMLDocument)
        {
            var freshDoc = event.originalTarget; // we don't care about defaultView property
            
            //TODO: only proceed if the domain matches a list of domains to filter.
            // If preferred, we can use document.URL and then grab the host name.
            // That's better if we need a read-only param, or if we want to match against a full URL.
            if (freshDoc.domain != 'jonatkinson.home.mindspring.com')
                return;
            
            // scan for ESI tags.
            //TODO: Confirm that we don't ned to use getElementsByTagNameNS() here.
            // If neither works, I can use document.createTreeWalker() to iterate thru nodes and filter the ESIs.
            // but that will perform horribly.
            var esiTags = freshDoc.getElementsByTagName("esi:include");
                        
            // TODO: fetchthe code, and add it as a node after each ESI tag.
            // Should I fetch the content via XMLHttpRequest, and write its output? Any other option?
            
            for (var i = 0; i < esiTags.length; ++i)
            {
                let esiSrcUrl = esiTags[i].getAttribute('src');

                let request = new XMLHttpRequest();
                request.open('GET', esiSrcUrl, true);
                request.onreadystatechange = function (aEvt) {
                    if (request.readyState == 4) {
                        if(request.status == 200)
                        {
                            esiTags[i].insertAdjacentHTML('afterend', request.responseText);
                            //let esiResultsElement = freshDoc.createElement('div');
                            //esiResultsElement.createTextNode(request.responseText);
                            //esiTags[i].parent.insertBefore(esiResultsElement, esiTags[i]);
                            //freshDoc.body.appendChild(esiResultsElement);
                        } else
                            alert('Error: ' + request.statusText);
                    }
                }
                
                request.send(null);
            }
            
            
            // TODO: Add a param to disable browser cache w/ ESIs. Then add this:
            // request.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE; 
            
            // TODO: Silly nice-to-have: use req.addEventListener("progress", ...) to calc an overall progress meter.
            // I think this is FF3.5+.
            // Use req.addEventListener("loadend", ...) (FF5+) or the individual end load events to clear this status.
            
            window.dump("done!");
            dump("done");

            // TODO: Also handle esi:remove 
            
        // TODO: remoce handler ow? or needed for rloads?
        }
    }

};

if ("undefined" == typeof(EsiProcessor)) {
    var EsiProcessor = {};
};

// This class is shared by all tabs in each browser window.
EsiProcessor.BrowserOverlay =  // class
{
    pageLoadHandler: function(event)
    {
        if (event.originalTarget instanceof HTMLDocument)
        {
            var freshDoc = event.originalTarget; // we don't care about defaultView property
            
            if (freshDoc.domain != 'jonatkinson.home.mindspring.com')  { return; }

            var esiTags = freshDoc.getElementsByTagName("esi:include");
            var esiRequests = new Array(esiTags.length);

            for (var i = 0; i < esiTags.length; i++)
            {
                let j = i;

                esiRequests[j] = new XMLHttpRequest();
                esiRequests[j].open('GET', esiTags[j].getAttribute('src'), true);
                esiRequests[j].onreadystatechange = function(event) {
                    if (this.readyState != 4)  { return; }

                    var esiContent;
                    if(this.status == 200)
                    {
                        esiContent = this.responseText;
                    } else
                    {
                        esiContent = 'ESI error for URL ' + esiTags[j].getAttribute('src') + ': ' + this.statusText;
                    }

                    var esiContentElement = freshDoc.createElement("div");
                    esiContentElement.innerHTML = esiContent;
                    // FIXME: Add the content as a direct child of the ESI tag.
                    // Or as the next sibling of the ESI tag, if it is a node itself.
                    //esiTags[j].insertBefore(esiContentElement, null);
                    esiTags[j].appendChild(esiContentElement);
                }
                esiRequests[j].send(null);
            }
 
            // Components.utils.reportError("Done!");
            
        // FIXME: remove handler now? or needed for reloads?
        }
    }

};



window.addEventListener("load", function () {
  gBrowser.addEventListener("load", EsiProcessor.BrowserOverlay.pageLoadHandler, true);
}, false);

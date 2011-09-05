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
                esiRequests[i] = new XMLHttpRequest();
                esiRequests[i].open('GET', esiTags[i].getAttribute('src'), true);
                
                let j = i;
                esiRequests[i].onreadystatechange = function(event) {
                    if (this.readyState != 4)  { return; }

                    let esiContent = this.responseText;
                    if(this.status != 200)
                    {
                        esiContent = 'ESI error for URL ' + esiTags[j].getAttribute('src') + ': ' + this.statusText;
                    }

                    let esiContentElement = freshDoc.createElement("span");
                    esiContentElement.id = "esi_processor-" + j;
                    esiContentElement.innerHTML = esiContent;
                    // FIXME: Add the content as a direct child of the ESI tag.
                    // Or as the next sibling of the ESI tag, if it is a node itself.
                    //esiTags[j].insertBefore(esiContentElement, null);
                    esiTags[j].appendChild(esiContentElement);
                    //esiTags[j].parentNode.insertBefore(esiContentElement, esiTags[j].nextSibling);
                }
                esiRequests[i].send(null);
            }

            // Components.utils.reportError("Done!");
            
        // FIXME: remove handler now? or needed for reloads?
        }
    }

};



window.addEventListener("load", function () {
  gBrowser.addEventListener("load", EsiProcessor.BrowserOverlay.pageLoadHandler, true);
}, false);

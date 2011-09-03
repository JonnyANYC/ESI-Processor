if ("undefined" == typeof(EsiProcessor)) {
    var EsiProcessor = {};
};

EsiProcessor.BrowserOverlay =  // class
{
    // This class is shared by all tabs in each browser window.

    pageLoadHandler: function(event)
    {
        if (event.originalTarget instanceof HTMLDocument)
        {
            var freshDoc = event.originalTarget; // we don't care about defaultView property
            
            if (freshDoc.domain != 'jonatkinson.home.mindspring.com')
                return;

            // scan for ESI tags.
            var esiTags = freshDoc.getElementsByTagName("esi:include");
            var esiRequests = new Array(esiTags.length);

            for (var i = 0; i < esiTags.length; i++)
            {
                let j = i;

                esiRequests[j] = new XMLHttpRequest();
                esiRequests[j].open('GET', esiTags[j].getAttribute('src'), true);
                esiRequests[j].onreadystatechange = function(event) {
                    if (this.readyState != 4)  { return; }
                    
                    if(this.status == 200)
                    {
                        let newText = document.createElement("span");
                        newText.appendChild(document.createTextNode(this.responseText))
                        esiTags[j].insertBefore(newText, null);
                     //   esiTags[j].insertAdjacentHTML('afterend', this.responseText);
                        //let esiResultsElement = freshDoc.createElement('div');
                        //esiResultsElement.createTextNode(request.responseText);
                        //esiTags[i].parent.insertBefore(esiResultsElement, esiTags[i]);
                        //freshDoc.body.appendChild(esiResultsElement);
                    } else
                    {
                        let errorText = 'ESI error for URL ' + esiSrcUrl + ': ' + this.statusText;
                        esiTags[j].insertAdjacentHTML('afterend', errorText );
                    } 
                }
                esiRequests[j].send(null);
            }
            
            window.dump("done!");
            dump("done");
            
        // FIXME: remove handler now? or needed for reloads?
        }
    }

};



window.addEventListener("load", function () {
  gBrowser.addEventListener("load", EsiProcessor.BrowserOverlay.pageLoadHandler, true);
}, false);

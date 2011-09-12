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
            //FIXME: fix the odd nested behavior of esi tags in the DOM.
            // things to try: 1) confirm that Firfox does this for this tag w/o this js code.
            // if so, research why. dos it do it with block tags and inline tags? (<div />)
            // does it do it with any tag that it doesnt know specifically can be a single tag?
            // 2) double-check there isn't a bug w/ the use of esiTags.length or anything else live
            // 3) try setting up a non-live nodelist for use by the main XHR code
            // 4) try removing the esi tag entirely and replacing it with the results
            // if any children, move them up. perhaps go in reverse order for this.
            // try just moving the children up in reverse order.

            var esiRequests = new Array(esiTags.length);
            for (var i = esiTags.length -1; i >= 0; i--)
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



window.addEventListener("load", function () {
  gBrowser.addEventListener("load", EsiProcessor.BrowserOverlay.pageLoadHandler, true);
}, false);

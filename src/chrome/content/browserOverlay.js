/*
 *   ESI Processor Firefox Extension
 * 
 *   Copyright 2013 Jonathan Atkinson
 * 
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 * 
 *       http://www.apache.org/licenses/LICENSE-2.0
 * 
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */


var EsiProcessorOverlay = {

    enabledisable: function( event ) {
        // TODO: Define constants somewhere for the three enabled states.
        var enabled = Application.prefs.get("extensions.esi_processor.enabled").value;
        if ( enabled == null || enabled == "" || enabled == "off" ) { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "session");
        } else { 
            Application.prefs.setValue("extensions.esi_processor.enabled", "off");
        }        
    },

    configure: function( event ) {

        var params;

        if (null == this._preferencesWindow || this._preferencesWindow.closed) {
            let instantApply =
              Application.prefs.get("browser.preferences.instantApply");
            let features =
              "chrome,resizable=yes,titlebar,toolbar,centerscreen" +
              (instantApply.value ? ",dialog=no" : ",modal");

            this._preferencesWindow =
              window.openDialog(
                "chrome://esi_processor/content/preferences/preferences.xul",
                "", features);
        }

        this._preferencesWindow.focus();
    },

};

(function() { 
    function esiProcessorOverlayLoad( event ) {

        var enabled = Application.prefs.get("extensions.esi_processor.enabled").value;
        if ( enabled == "permanent" || enabled == "session" ) {
            document.getElementById("esi_processor-enabledisable").setAttribute("checked", "true");
            document.getElementById("esi_processor-enabledisable-2").setAttribute("checked", "true");
        }

        // The listener is only needed to set the initial menu state at window startup.
        window.removeEventListener("load", esiProcessorOverlayLoad, false);
    };

    window.addEventListener( "load", esiProcessorOverlayLoad, false );
})();

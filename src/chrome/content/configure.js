function onLoad() {
    document.getElementById("esi_processor-configure-enabled").checked = window.arguments[0].inn.enabled;
    document.getElementById("esi_processor-configure-hostList").value = window.arguments[0].inn.hostList;
    document.getElementById("esi_processor-configure-allowDomainValueChange").checked = window.arguments[0].inn.allowDomainValueChange;
}

function onAccept() {
    window.arguments[0].out = {
        enabled: document.getElementById("esi_processor-configure-enabled").checked,
        hostList: document.getElementById("esi_processor-configure-hostList").value,
        allowDomainValueChange: document.getElementById("esi_processor-configure-allowDomainValueChange").checked
    };

    return true;
}

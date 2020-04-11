
/// <summary>
/// Creates a full-screen overlay with the given message, button text, and button function.
/// </summary>
function overlay(message, buttonText, buttonFunc, dismissable=true)
{
    buildOverlay(dismissable,
        buildNode("div", {}, message),
        buildNode(
            "input",
            {
                "type" : "button",
                "id" : "overlayBtn",
                "value" : buttonText,
                "style" : "width: 100px"
            },
            0,
            {
                "click" : buttonFunc
            }
        )
    );
}

/// <summary>
/// Generic overlay builder
/// </summary>
/// <param name="dismissable">Determines whether the overlay can be dismissed</param>
/// <param name="...children">The list of nodes to append to the overaly.</param>
function buildOverlay(dismissable, ...children)
{
    let overlay = buildNode("div",
        {
            "id" : "mainOverlay",
            "style" : "opacity: 0",
            "dismissable" : dismissable
        },
        0,
        {
            "click" : function(e)
            {
                let overlay = $("#mainOverlay");
                if (overlay &&
                    !!overlay.getAttribute("dismissable") &&
                    e.target.id == "mainOverlay" &&
                    e.target.style.opacity == 1)
                {
                    Animation.queue({"opacity": 0}, overlay, 250, true /*deleteAfterTransition*/);
                }
            }
        });

    let container = buildNode("div", {"id" : "overlayContainer"});
    children.forEach(function(element)
    {
        container.appendChild(element);
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);
    Animation.queue({"opacity" : 1}, overlay, 250);
}
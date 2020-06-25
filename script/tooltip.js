/// <summary>
/// Implements common functionality for on-hover tooltips. Better
/// than setting 'title' because it also works on touch/mobile browsers
/// </summary>

/* exported setTooltip, showTooltip, dismissTooltip */

/// <summary>
/// Contains the setTimeout id of a scroll event, which will hide the tooltip when expired
/// </summary>
let hideTooltipTimer = null;

window.addEventListener("load", function()
{
    let frame = $("#plexFrame");
    frame.appendChild(buildNode("div", { id : "tooltip" }));
    frame.addEventListener("scroll", function()
    {
        // On scroll, hide the tooltip (mainly for mobile devices)
        // Add a bit of delay, as it is a bit jarring to have it immediately go away
        if (hideTooltipTimer)
        {
            clearTimeout(hideTooltipTimer);
        }

        hideTooltipTimer = setTimeout(() => { $("#tooltip").style.display = "none"; }, 100);
    });
});

/// <summary>
/// Sets up tooltip handlers for basic use cases
/// </summary>
function setTooltip(element, tooltip, delay=250)
{
    setTooltipText(element, tooltip);
    element.setAttribute("ttDelay", delay);
    element.addEventListener("mousemove", function(e)
    {
        showTooltip(e, this.getAttribute("tt"), this.getAttribute("ttDelay"));
    });

    element.addEventListener("mouseleave", function()
    {
        dismissTooltip();
    });
}

/// <summary>
/// Sets the tooltip text for the given element
/// If the tooltip for this element is currently showing, adjust that as well
/// </summary>
function setTooltipText(element, tooltip)
{
    element.setAttribute("tt", tooltip);
    if (showingTooltip && ttElement == element)
    {
        $("#tooltip").innerHTML = tooltip;
    }
}


let tooltipTimer;
let showingTooltip = false;
let ttElement = null;

/// <summary>
/// Show a tooltip with the given text at a position relative to clientX/Y in event e
/// </summary>
function showTooltip(e, text, delay=250)
{
    if (showingTooltip)
    {
        showTooltipCore(e, text);
        return;
    }

    if (tooltipTimer)
    {
        clearTimeout(tooltipTimer);
    }

    tooltipTimer = setTimeout(showTooltipCore, delay, e, text);
}

/// <summary>
/// Core routine to show a tooltip and update its position
/// Should not be called outside of this file
/// </summary>
function showTooltipCore(e, text)
{
    ttElement = e.target;
    showingTooltip = true;
    const top = (e.clientY + 20) + "px";
    let tooltip = $("#tooltip");
    tooltip.style.top = top;

    tooltip.innerHTML = text;
    tooltip.style.display = "inline";

    let max = $("#plexFrame").clientWidth - tooltip.clientWidth - 10;
    tooltip.style.left = Math.min(e.clientX, max) + "px";
}

/// <summary>
/// Dismisses the tooltip
/// </summary>
function dismissTooltip()
{
    $("#tooltip").style.display = "none";
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
    showingTooltip = false;
}

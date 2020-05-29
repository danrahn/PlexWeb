/// <summary>
/// Implements common functionality for on-hover tooltips. Better
/// than setting 'title' because it also works on touch/mobile browsers
/// </summary>


/// <summary>
/// Contains the setTimeout id of a scroll event, which will hide the tooltip when expired
/// </summary>
let hideTooltipTimer = null;

window.addEventListener('load', function()
{
    let frame = $('#plexFrame');
    frame.appendChild(buildNode('div', { 'id' : 'tooltip' }));
    frame.addEventListener('scroll', function()
    {
        // On scroll, hide the tooltip (mainly for mobile devices)
        // Add a bit of delay, as it is a bit jarring to have it immediately go away
        if (hideTooltipTimer)
        {
            clearTimeout(hideTooltipTimer);
        }

        hideTooltipTimer = setTimeout(() => { $('#tooltip').style.display = 'none' }, 100);
    })
});


let tooltipTimer;
let showingTooltip = false;

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

function showTooltipCore(e, text)
{
    showingTooltip = true;
    let max = $("#plexFrame").clientWidth - 180;
    const left = Math.min(e.clientX, max) + "px";
    const top = (e.clientY + 20) + "px";
    let tooltip = $("#tooltip");
    tooltip.style.left = left;
    tooltip.style.top = top;

    tooltip.innerHTML = text;
    tooltip.style.display = "inline";
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
